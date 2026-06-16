const { logInfo, logWarn, logError } = require('../observability');

/**
 * Consolidator — Motor de consolidação automática de memórias.
 * Executa periodicamente: resumo, deduplicação, evição por idade/prioridade.
 */
class Consolidator {
  /**
   * @param {object} deps - { longTerm, vectorStore }
   */
  constructor(deps) {
    this.longTerm = deps.longTerm;
    this.vectorStore = deps.vectorStore;
    this._intervalId = null;
    this._consolidationLog = [];
  }

  /**
   * Inicia consolidação periódica.
   * @param {number} intervalMs - Intervalo em ms (padrão: 30 min)
   */
  startPeriodicConsolidation(intervalMs = 30 * 60 * 1000) {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => {
      this.runConsolidation();
    }, intervalMs);
    logInfo(`[Consolidator] Consolidação periódica ativada (${intervalMs / 60000}min).`);
  }

  stopPeriodicConsolidation() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Executa um ciclo completo de consolidação.
   * @returns {{ summarized: number, deduplicated: number, evicted: number }}
   */
  runConsolidation() {
    const startTime = Date.now();
    let summarized = 0;
    let deduplicated = 0;
    let evicted = 0;

    try {
      // 1. Evição: remover memórias LOW/MEDIUM com >30 dias e 0 acessos
      evicted = this._evictStale();

      // 2. Deduplicação: detectar conteúdos muito similares
      deduplicated = this._deduplicateByContent();

      // 3. Resumo: condensar memórias antigas da mesma categoria
      summarized = this._summarizeOldEntries();

      const elapsed = Date.now() - startTime;
      const logEntry = {
        timestamp: new Date().toISOString(),
        elapsed,
        summarized,
        deduplicated,
        evicted
      };
      this._consolidationLog.push(logEntry);

      // Manter apenas os últimos 50 logs
      if (this._consolidationLog.length > 50) {
        this._consolidationLog = this._consolidationLog.slice(-50);
      }

      if (summarized + deduplicated + evicted > 0) {
        logInfo(`[Consolidator] Ciclo concluído em ${elapsed}ms: ${summarized} resumidas, ${deduplicated} deduplicadas, ${evicted} removidas.`);
      }
    } catch (err) {
      logError('[Consolidator] Erro durante consolidação', err);
    }

    return { summarized, deduplicated, evicted };
  }

  /**
   * Remove memórias obsoletas (LOW/MEDIUM, >30 dias, sem acessos).
   */
  _evictStale() {
    try {
      const stale = this.longTerm.getStale(30, 0);
      const toRemove = stale.filter(e =>
        e.priority === 'LOW' || e.priority === 'MEDIUM'
      );

      if (toRemove.length > 0) {
        const ids = toRemove.map(e => e.id);
        this.longTerm.bulkRemove(ids);
        ids.forEach(id => this.vectorStore.removeDocument(id));
      }

      return toRemove.length;
    } catch (err) {
      logError('[Consolidator] Erro na evição', err);
      return 0;
    }
  }

  /**
   * Detecta e faz merge de entradas com conteúdo muito similar.
   * Usa uma comparação simples de tokens compartilhados (Jaccard > 0.80).
   */
  _deduplicateByContent() {
    try {
      const all = this.longTerm.getAll();
      if (all.length < 2) return 0;

      const toRemoveIds = new Set();
      const processed = new Set();

      for (let i = 0; i < all.length; i++) {
        if (toRemoveIds.has(all[i].id) || processed.has(all[i].id)) continue;
        processed.add(all[i].id);

        const tokensA = this._quickTokenize(all[i].content);
        if (tokensA.size === 0) continue;

        for (let j = i + 1; j < all.length; j++) {
          if (toRemoveIds.has(all[j].id)) continue;
          if (all[i].category !== all[j].category) continue;

          const tokensB = this._quickTokenize(all[j].content);
          if (tokensB.size === 0) continue;

          const jaccard = this._jaccardSimilarity(tokensA, tokensB);

          if (jaccard > 0.80) {
            // Manter a mais recente ou a de maior prioridade
            const priorityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
            const rankA = priorityRank[all[i].priority] || 1;
            const rankB = priorityRank[all[j].priority] || 1;

            if (rankB > rankA) {
              toRemoveIds.add(all[i].id);
              break;
            } else {
              toRemoveIds.add(all[j].id);
            }
          }
        }
      }

      if (toRemoveIds.size > 0) {
        this.longTerm.bulkRemove([...toRemoveIds]);
        toRemoveIds.forEach(id => this.vectorStore.removeDocument(id));
      }

      return toRemoveIds.size;
    } catch (err) {
      logError('[Consolidator] Erro na deduplicação', err);
      return 0;
    }
  }

  /**
   * Resume memórias antigas da mesma categoria em entradas condensadas.
   * Memórias com >7 dias e accessCount <= 2 na mesma categoria são consolidadas.
   */
  _summarizeOldEntries() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const all = this.longTerm.getAll();

      // Agrupar por categoria
      const groups = {};
      all.forEach(entry => {
        if (entry.consolidated) return;
        if (entry.priority === 'CRITICAL') return; // Nunca consolidar críticas
        if (entry.createdAt > sevenDaysAgo) return;
        if (entry.accessCount > 2) return;

        if (!groups[entry.category]) groups[entry.category] = [];
        groups[entry.category].push(entry);
      });

      let summarizedCount = 0;

      for (const [category, entries] of Object.entries(groups)) {
        if (entries.length < 3) continue; // Precisa de pelo menos 3 para consolidar

        // Gerar resumo simples: concatenar os conteúdos e truncar
        const combined = entries.map(e => e.content).join(' | ');
        const summary = combined.length > 500
          ? combined.substring(0, 497) + '...'
          : combined;

        // Criar entrada consolidada
        const allTags = [...new Set(entries.flatMap(e => e.tags || []))];

        this.longTerm.add(
          summary,
          category,
          'MEDIUM',
          allTags,
          'consolidation',
          `Consolidação de ${entries.length} memórias de ${category}`,
          entries.map(e => e.id)
        );

        // Marcar originais como consolidadas
        entries.forEach(e => {
          this.longTerm.update(e.id, { consolidated: true });
        });

        summarizedCount += entries.length;
      }

      return summarizedCount;
    } catch (err) {
      logError('[Consolidator] Erro no resumo', err);
      return 0;
    }
  }

  _quickTokenize(text) {
    if (!text) return new Set();
    return new Set(
      text.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2)
    );
  }

  _jaccardSimilarity(setA, setB) {
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  getConsolidationLog() {
    return this._consolidationLog;
  }
}

module.exports = Consolidator;
