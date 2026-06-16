const { logInfo, logWarn, logError } = require('../observability');

/**
 * AutoLearner — Detecta padrões repetidos e promove memórias automaticamente.
 * Analisa a camada short-term periodicamente e identifica conteúdos recorrentes
 * para promoção à camada long-term.
 */
class AutoLearner {
  /**
   * @param {object} deps - { shortTerm, longTerm, vectorStore }
   */
  constructor(deps) {
    this.shortTerm = deps.shortTerm;
    this.longTerm = deps.longTerm;
    this.vectorStore = deps.vectorStore;
    this._intervalId = null;
    this._patternLog = [];

    // Contadores de padrões detectados entre ciclos
    this._tagFrequency = new Map();     // tag → { count, sessions }
    this._topicFrequency = new Map();   // tópico → { count, sessions, content }
    this._sessionId = 0;
  }

  /**
   * Inicia análise periódica.
   * @param {number} intervalMs - Intervalo em ms (padrão: 10 min)
   */
  startPeriodicAnalysis(intervalMs = 10 * 60 * 1000) {
    if (this._intervalId) return;
    this._sessionId++;
    this._intervalId = setInterval(() => {
      this._sessionId++;
      this.analyzeAndPromote();
    }, intervalMs);
    logInfo(`[AutoLearner] Análise periódica ativada (${intervalMs / 60000}min).`);
  }

  stopPeriodicAnalysis() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Executa um ciclo de análise e promoção.
   * @returns {{ promoted: number, patternsDetected: number }}
   */
  analyzeAndPromote() {
    let promoted = 0;
    let patternsDetected = 0;

    try {
      const stEntries = this.shortTerm.getAll();
      if (stEntries.length === 0) return { promoted, patternsDetected };

      // 1. Analisar tags recorrentes
      patternsDetected += this._analyzeTagPatterns(stEntries);

      // 2. Analisar tópicos/conteúdos recorrentes
      patternsDetected += this._analyzeTopicPatterns(stEntries);

      // 3. Detectar preferências implícitas
      promoted += this._detectPreferences(stEntries);

      // 4. Detectar projetos recorrentes
      promoted += this._detectProjects();

      // 5. Detectar hábitos
      promoted += this._detectHabits();

      if (promoted > 0 || patternsDetected > 0) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          session: this._sessionId,
          promoted,
          patternsDetected
        };
        this._patternLog.push(logEntry);

        // Manter apenas os últimos 50 logs
        if (this._patternLog.length > 50) {
          this._patternLog = this._patternLog.slice(-50);
        }

        logInfo(`[AutoLearner] Ciclo concluído: ${patternsDetected} padrões, ${promoted} promoções.`);
      }
    } catch (err) {
      logError('[AutoLearner] Erro durante análise', err);
    }

    return { promoted, patternsDetected };
  }

  /**
   * Analisa frequência de tags nos dados de short-term.
   */
  _analyzeTagPatterns(entries) {
    let count = 0;
    entries.forEach(entry => {
      if (!entry.tags) return;
      entry.tags.forEach(tag => {
        const existing = this._tagFrequency.get(tag) || { count: 0, sessions: new Set() };
        existing.count++;
        existing.sessions.add(this._sessionId);
        this._tagFrequency.set(tag, existing);
        if (existing.sessions.size >= 3) count++;
      });
    });
    return count;
  }

  /**
   * Analisa frequência de tópicos/palavras-chave no conteúdo.
   */
  _analyzeTopicPatterns(entries) {
    let count = 0;
    entries.forEach(entry => {
      const keywords = this._extractKeywords(entry.content);
      keywords.forEach(keyword => {
        const existing = this._topicFrequency.get(keyword) || {
          count: 0,
          sessions: new Set(),
          content: entry.content
        };
        existing.count++;
        existing.sessions.add(this._sessionId);
        if (existing.count > 1) existing.content = entry.content; // Atualiza com versão mais recente
        this._topicFrequency.set(keyword, existing);
        if (existing.sessions.size >= 3) count++;
      });
    });
    return count;
  }

  /**
   * Detecta preferências implícitas e promove para long-term.
   */
  _detectPreferences(entries) {
    let promoted = 0;

    // Padrão: categorias 'preference' que aparecem 2+ vezes
    const preferences = entries.filter(e => e.category === 'preference');
    const seen = new Map();

    preferences.forEach(entry => {
      const key = this._extractKeywords(entry.content).slice(0, 3).join('_');
      if (!key) return;

      const existing = seen.get(key);
      if (existing) {
        // Segunda vez → promover
        const alreadyStored = this._isAlreadyInLongTerm(entry.content, 'preference');
        if (!alreadyStored) {
          this.longTerm.add(
            entry.content,
            'preference',
            'MEDIUM',
            entry.tags || [],
            'auto_learner',
            `Preferência detectada automaticamente: ${entry.content.substring(0, 100)}`
          );

          this.vectorStore.addDocument(
            `pref_auto_${Date.now()}`,
            entry.content,
            { category: 'preference', priority: 'MEDIUM', source: 'auto_learner' }
          );

          promoted++;
          logInfo(`[AutoLearner] Preferência promovida: "${entry.content.substring(0, 60)}..."`);
        }
      } else {
        seen.set(key, entry);
      }
    });

    return promoted;
  }

  /**
   * Detecta projetos recorrentes (tópicos mencionados 5+ vezes).
   */
  _detectProjects() {
    let promoted = 0;

    for (const [topic, data] of this._topicFrequency.entries()) {
      if (data.count >= 5 && data.sessions.size >= 2) {
        const alreadyStored = this._isAlreadyInLongTerm(topic, 'project');
        if (!alreadyStored) {
          const content = `Projeto recorrente: ${topic}. Contexto: ${data.content.substring(0, 200)}`;

          this.longTerm.add(
            content,
            'project',
            'HIGH',
            [topic],
            'auto_learner',
            `Projeto detectado por padrão de recorrência (${data.count}x em ${data.sessions.size} sessões)`
          );

          this.vectorStore.addDocument(
            `project_auto_${Date.now()}`,
            content,
            { category: 'project', priority: 'HIGH', source: 'auto_learner' }
          );

          promoted++;
          logInfo(`[AutoLearner] Projeto promovido: "${topic}"`);

          // Reset do contador para não re-promover
          data.count = 0;
          data.sessions.clear();
        }
      }
    }

    return promoted;
  }

  /**
   * Detecta hábitos (tags que aparecem em 3+ sessões diferentes).
   */
  _detectHabits() {
    let promoted = 0;

    for (const [tag, data] of this._tagFrequency.entries()) {
      if (data.sessions.size >= 3) {
        const alreadyStored = this._isAlreadyInLongTerm(tag, 'habit');
        if (!alreadyStored) {
          const content = `Hábito detectado: uso recorrente de "${tag}" em ${data.sessions.size} sessões (${data.count} vezes total)`;

          this.longTerm.add(
            content,
            'habit',
            'MEDIUM',
            [tag, 'habito', 'auto-detectado'],
            'auto_learner',
            `Hábito auto-detectado por recorrência`
          );

          promoted++;
          logInfo(`[AutoLearner] Hábito promovido: "${tag}"`);

          // Reset
          data.sessions.clear();
          data.count = 0;
        }
      }
    }

    return promoted;
  }

  /**
   * Verifica se um conteúdo já existe em long-term para evitar duplicação.
   */
  _isAlreadyInLongTerm(content, category) {
    try {
      const existing = this.longTerm.find({ category });
      return existing.some(e => {
        const similarity = this._quickSimilarity(e.content, content);
        return similarity > 0.7;
      });
    } catch {
      return false;
    }
  }

  /**
   * Calcula similaridade rápida entre dois textos (Jaccard nos tokens).
   */
  _quickSimilarity(textA, textB) {
    const tokensA = new Set(this._extractKeywords(textA));
    const tokensB = new Set(this._extractKeywords(textB));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = tokensA.size + tokensB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Extrai palavras-chave de um texto (tokens significativos).
   */
  _extractKeywords(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
  }

  getPatternLog() {
    return this._patternLog;
  }

  getDetectedPatterns() {
    return {
      tags: Object.fromEntries(
        [...this._tagFrequency.entries()]
          .filter(([, v]) => v.count >= 2)
          .map(([k, v]) => [k, { count: v.count, sessions: v.sessions.size }])
      ),
      topics: Object.fromEntries(
        [...this._topicFrequency.entries()]
          .filter(([, v]) => v.count >= 3)
          .map(([k, v]) => [k, { count: v.count, sessions: v.sessions.size }])
      )
    };
  }
}

module.exports = AutoLearner;
