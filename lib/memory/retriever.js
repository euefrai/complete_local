const { logInfo, logWarn } = require('../observability');

/**
 * Retriever — Motor de recuperação inteligente de contexto.
 * Combina as 3 camadas de memória para montar o contexto ideal antes de cada resposta.
 */
class Retriever {
  /**
   * @param {object} deps - { shortTerm, longTerm, vectorStore }
   */
  constructor(deps) {
    this.shortTerm = deps.shortTerm;
    this.longTerm = deps.longTerm;
    this.vectorStore = deps.vectorStore;
  }

  /**
   * Monta um ContextPacket completo para injeção no prompt dos agentes.
   * @param {string} query - Consulta ou tema da resposta a ser gerada
   * @param {object} [options] - { maxResults, minScore, categories, priorities }
   * @returns {object} ContextPacket
   */
  buildContext(query, options = {}) {
    const {
      maxResults = 10,
      minScore = 0.05,
      categories = null,
      priorities = null
    } = options;

    const packet = {
      query,
      timestamp: new Date().toISOString(),
      conversation: [],
      currentTask: null,
      shortTermContext: [],
      longTermRelevant: [],
      semanticMatches: [],
      summary: ''
    };

    try {
      // 1. Contexto de conversa (short-term)
      packet.conversation = this.shortTerm.getConversationContext(5);
      packet.currentTask = this.shortTerm.getCurrentTask();

      // 2. Contexto imediato (short-term: outras categorias)
      const stContext = this.shortTerm.getByCategory('context');
      packet.shortTermContext = stContext.slice(-5);

      // 3. Busca semântica no vector store
      const vectorFilters = {};
      if (categories) vectorFilters.category = categories;
      if (priorities) vectorFilters.priority = priorities;
      vectorFilters.minScore = minScore;

      const semanticResults = this.vectorStore.search(query, maxResults * 2, vectorFilters);
      packet.semanticMatches = semanticResults.slice(0, maxResults);

      // 4. Enriquecer com dados de long-term baseado nos IDs semânticos
      const ltIds = new Set();
      packet.semanticMatches.forEach(match => {
        if (match.id && !ltIds.has(match.id)) {
          ltIds.add(match.id);
          const ltEntry = this.longTerm.get(match.id);
          if (ltEntry) {
            packet.longTermRelevant.push(ltEntry);
          }
        }
      });

      // 5. Também buscar memórias CRITICAL/HIGH do long-term diretamente
      const criticalMemories = this.longTerm.getByPriority('CRITICAL');
      const highMemories = this.longTerm.getByPriority('HIGH');

      [...criticalMemories, ...highMemories].forEach(mem => {
        if (!ltIds.has(mem.id)) {
          ltIds.add(mem.id);
          packet.longTermRelevant.push(mem);
        }
      });

      // Limitar resultados de long-term
      packet.longTermRelevant = packet.longTermRelevant.slice(0, maxResults);

      // 6. Ordenar por relevância combinada
      packet.longTermRelevant.sort((a, b) => {
        const priorityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const rankA = priorityRank[a.priority] || 1;
        const rankB = priorityRank[b.priority] || 1;
        if (rankB !== rankA) return rankB - rankA;
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });

      // 7. Gerar resumo do contexto
      packet.summary = this._buildSummaryText(packet);

    } catch (err) {
      logWarn(`[Retriever] Erro ao montar contexto: ${err.message}`);
    }

    return packet;
  }

  /**
   * Busca rápida semântica (sem montar todo o ContextPacket).
   * @param {string} query
   * @param {number} limit
   * @param {object} filters
   * @returns {Array}
   */
  quickSearch(query, limit = 5, filters = {}) {
    try {
      const results = this.vectorStore.search(query, limit, filters);

      // Atualizar accessCount nas memórias encontradas
      results.forEach(r => {
        if (r.id) {
          const ltEntry = this.longTerm.get(r.id);
          // get() já atualiza accessCount automaticamente
        }
      });

      return results;
    } catch (err) {
      logWarn(`[Retriever] Erro na busca rápida: ${err.message}`);
      return [];
    }
  }

  /**
   * Recupera memórias filtradas por prioridade e categoria.
   * @param {object} filters - { category, priority, limit }
   * @returns {Array}
   */
  recall(filters = {}) {
    try {
      const { category, priority, limit = 10 } = filters;
      let results = this.longTerm.find({ category, priority });

      // Ordenar por recência + prioridade
      const priorityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      results.sort((a, b) => {
        const rankDiff = (priorityRank[b.priority] || 1) - (priorityRank[a.priority] || 1);
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.lastAccessedAt || b.createdAt) - new Date(a.lastAccessedAt || a.createdAt);
      });

      return results.slice(0, limit);
    } catch (err) {
      logWarn(`[Retriever] Erro no recall: ${err.message}`);
      return [];
    }
  }

  /**
   * Gera texto resumido para injeção no prompt.
   * @param {object} packet
   * @returns {string}
   */
  _buildSummaryText(packet) {
    const parts = [];

    if (packet.currentTask) {
      parts.push(`[TAREFA ATIVA] ${packet.currentTask.content}`);
    }

    if (packet.conversation.length > 0) {
      const convSummary = packet.conversation
        .map(c => c.content)
        .join(' | ');
      parts.push(`[CONVERSA RECENTE] ${convSummary.substring(0, 300)}`);
    }

    if (packet.longTermRelevant.length > 0) {
      const ltSummary = packet.longTermRelevant
        .slice(0, 5)
        .map(m => `(${m.priority}) ${m.summary || m.content.substring(0, 100)}`)
        .join(' | ');
      parts.push(`[MEMÓRIA LONGA] ${ltSummary}`);
    }

    if (packet.semanticMatches.length > 0) {
      const semSummary = packet.semanticMatches
        .slice(0, 3)
        .map(m => m.text.substring(0, 80))
        .join(' | ');
      parts.push(`[CONTEXTO SEMÂNTICO] ${semSummary}`);
    }

    return parts.join('\n');
  }
}

module.exports = Retriever;
