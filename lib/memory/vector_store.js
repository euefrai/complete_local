/**
 * VectorStore — Motor de busca semântica local para o sistema de memória hierárquica Vexx AI OS.
 *
 * Evolução do vector_memory.js original com:
 * - Motor TF-IDF com similaridade de cosseno
 * - Stop words expandidas (Português + Inglês)
 * - Índice persistente em data/memory/vector_index.json
 * - Filtros por categoria, prioridade, tags e pontuação mínima
 * - Auto-save a cada 20 inserções OU 60 segundos
 *
 * @module memory/vector_store
 */

const fs = require('fs');
const path = require('path');
const { logInfo, logError } = require('../observability');

// ── Diretório de dados ──────────────────────────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '../../data/memory');
const INDEX_FILE = path.join(DATA_DIR, 'vector_index.json');

// Garante que o diretório existe
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    logInfo('[VectorStore] Diretório de dados criado', { path: DATA_DIR });
  }
} catch (err) {
  logError('[VectorStore] Falha ao criar diretório de dados', err, { path: DATA_DIR });
}

// ── Stop Words expandidas (Português + Inglês) ─────────────────────────────
const STOP_WORDS = new Set([
  // Português — artigos, preposições, pronomes, conjunções, advérbios comuns
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas',
  'e', 'ou', 'mas', 'se', 'para', 'com', 'por', 'que', 'como',
  'eu', 'tu', 'voce', 'ele', 'ela', 'nos', 'vos', 'eles', 'elas',
  'meu', 'minha', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas',
  'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa', 'nossos', 'nossas',
  'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'isso', 'aquilo',
  'nao', 'sim', 'ja', 'mais', 'menos', 'muito', 'pouco', 'bem', 'mal',
  'tambem', 'ainda', 'so', 'apenas', 'sempre', 'nunca', 'agora', 'aqui',
  'ali', 'la', 'onde', 'quando', 'porque', 'pois', 'entao', 'assim',
  'ser', 'estar', 'ter', 'haver', 'ir', 'vir', 'fazer', 'poder',
  'foi', 'era', 'tem', 'tinha', 'esta', 'sao', 'sobre', 'entre',
  'ate', 'apos', 'desde', 'sem', 'contra', 'ante', 'sob',

  // Inglês — artigos, preposições, pronomes, conjunções, verbos auxiliares
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was',
  'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'shall', 'should',
  'may', 'might', 'must', 'can', 'could',
  'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours',
  'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers',
  'it', 'its', 'they', 'them', 'their', 'theirs',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'not', 'no', 'nor', 'so', 'than', 'too', 'very',
  'just', 'about', 'above', 'after', 'again', 'all', 'also', 'am',
  'any', 'because', 'before', 'below', 'between', 'both', 'during',
  'each', 'few', 'here', 'how', 'into', 'more', 'most', 'now',
  'only', 'other', 'out', 'over', 'own', 'same', 'some', 'such',
  'then', 'there', 'through', 'under', 'until', 'up', 'when',
  'where', 'while', 'why', 'down', 'off'
]);

// ── Funções utilitárias TF-IDF (provadas no vector_memory.js) ───────────────

/**
 * Normaliza e tokeniza um texto, removendo acentos e stop words.
 * @param {string} text - Texto bruto
 * @returns {string[]} Array de tokens filtrados
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '')      // Apenas letras, números, espaços, hifens
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Calcula a frequência dos termos (TF) normalizada para um documento.
 * @param {string[]} tokens - Tokens do documento
 * @returns {Map<string, number>} Mapa termo → frequência normalizada
 */
function getTermFrequency(tokens) {
  const tf = new Map();
  tokens.forEach(token => {
    tf.set(token, (tf.get(token) || 0) + 1);
  });
  // Normaliza pelo total de termos
  for (const [term, count] of tf.entries()) {
    tf.set(term, count / tokens.length);
  }
  return tf;
}

/**
 * Calcula a similaridade de cosseno entre dois vetores de pesos.
 * @param {Map<string, number>} vecA - Vetor A
 * @param {Map<string, number>} vecB - Vetor B
 * @returns {number} Similaridade no intervalo [0, 1]
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of vecA.entries()) {
    normA += valA * valA;
    if (vecB.has(term)) {
      dotProduct += valA * vecB.get(term);
    }
  }

  for (const valB of vecB.values()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Classe VectorStore ──────────────────────────────────────────────────────

class VectorStore {
  /**
   * Cria uma nova instância do VectorStore.
   * @param {object} [options] - Opções de configuração
   * @param {boolean} [options.autoLoad=true] - Carregar índice do disco ao inicializar
   * @param {number} [options.autoSaveInterval=60000] - Intervalo de auto-save em ms
   * @param {number} [options.autoSaveThreshold=20] - Inserções antes de auto-save
   */
  constructor(options = {}) {
    const {
      autoLoad = true,
      autoSaveInterval = 60000,
      autoSaveThreshold = 20
    } = options;

    /** @type {Array<{id: string|number, text: string, metadata: object, tfMap: Map, tokens: string[]}>} */
    this.documents = [];

    /** @type {Map<string, number>} Document Frequency global */
    this.df = new Map();

    /** @private Contador de inserções desde último save */
    this._insertionsSinceSave = 0;

    /** @private Limiar de inserções para auto-save */
    this._autoSaveThreshold = autoSaveThreshold;

    /** @private Timer de auto-save periódico */
    this._autoSaveTimer = null;

    // Carrega índice existente do disco
    if (autoLoad) {
      this.load();
    }

    // Inicia timer de auto-save periódico
    this._startAutoSaveTimer(autoSaveInterval);

    logInfo('[VectorStore] Instância inicializada', {
      documentos: this.documents.length,
      autoSaveInterval: `${autoSaveInterval}ms`,
      autoSaveThreshold
    });
  }

  /**
   * Inicia o timer periódico de auto-save.
   * @private
   * @param {number} intervalMs - Intervalo em milissegundos
   */
  _startAutoSaveTimer(intervalMs) {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
    }
    this._autoSaveTimer = setInterval(() => {
      if (this._insertionsSinceSave > 0) {
        logInfo('[VectorStore] Auto-save periódico disparado', {
          insercoesDesdeUltimoSave: this._insertionsSinceSave
        });
        this.save();
      }
    }, intervalMs);

    // Não impede o processo de encerrar
    if (this._autoSaveTimer.unref) {
      this._autoSaveTimer.unref();
    }
  }

  /**
   * Verifica se o limiar de inserções para auto-save foi atingido.
   * @private
   */
  _checkAutoSave() {
    this._insertionsSinceSave++;
    if (this._insertionsSinceSave >= this._autoSaveThreshold) {
      logInfo('[VectorStore] Auto-save por limiar de inserções', {
        insercoes: this._insertionsSinceSave
      });
      this.save();
    }
  }

  /**
   * Reconstrói os campos computados (tfMap, tokens) e o mapa de DF global
   * a partir dos documentos armazenados.
   * @private
   */
  _rebuildComputedFields() {
    this.df.clear();

    for (const doc of this.documents) {
      doc.tokens = tokenize(doc.text);
      doc.tfMap = getTermFrequency(doc.tokens);

      const uniqueTokens = new Set(doc.tokens);
      uniqueTokens.forEach(token => {
        this.df.set(token, (this.df.get(token) || 0) + 1);
      });
    }
  }

  // ── Métodos Públicos ────────────────────────────────────────────────────

  /**
   * Adiciona um documento ao índice.
   * @param {string|number} id - Identificador único do documento
   * @param {string} text - Conteúdo textual
   * @param {object} [metadata] - Metadados do documento
   * @param {string} [metadata.category] - Categoria do documento
   * @param {number} [metadata.priority] - Prioridade (1-10)
   * @param {string[]} [metadata.tags] - Tags associadas
   * @param {string} [metadata.source] - Fonte do documento
   * @param {string} [metadata.createdAt] - Data de criação (ISO string)
   */
  addDocument(id, text, metadata = {}) {
    // Remove documento existente com o mesmo id (upsert)
    const existingIdx = this.documents.findIndex(d => d.id === id);
    if (existingIdx !== -1) {
      this._removeDocFromDF(this.documents[existingIdx]);
      this.documents.splice(existingIdx, 1);
    }

    const tokens = tokenize(text);
    if (tokens.length === 0) {
      logInfo('[VectorStore] Documento ignorado (sem tokens válidos)', { id });
      return;
    }

    const tfMap = getTermFrequency(tokens);

    // Garante campo createdAt nos metadados
    const fullMetadata = {
      category: metadata.category || null,
      priority: metadata.priority || null,
      tags: metadata.tags || [],
      source: metadata.source || null,
      createdAt: metadata.createdAt || new Date().toISOString(),
      ...metadata
    };

    // Atualiza Document Frequency global
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach(token => {
      this.df.set(token, (this.df.get(token) || 0) + 1);
    });

    this.documents.push({ id, text, metadata: fullMetadata, tfMap, tokens });

    logInfo('[VectorStore] Documento indexado', { id, tokens: tokens.length });

    this._checkAutoSave();
  }

  /**
   * Remove um documento do índice pelo id.
   * @param {string|number} id - Identificador do documento a remover
   * @returns {boolean} true se encontrado e removido, false caso contrário
   */
  removeDocument(id) {
    const idx = this.documents.findIndex(d => d.id === id);
    if (idx === -1) {
      logInfo('[VectorStore] Documento não encontrado para remoção', { id });
      return false;
    }

    this._removeDocFromDF(this.documents[idx]);
    this.documents.splice(idx, 1);

    logInfo('[VectorStore] Documento removido', { id, restantes: this.documents.length });
    return true;
  }

  /**
   * Remove a contribuição de um documento do mapa DF global.
   * @private
   * @param {object} doc - Documento a remover do DF
   */
  _removeDocFromDF(doc) {
    if (!doc.tokens) return;
    const uniqueTokens = new Set(doc.tokens);
    uniqueTokens.forEach(token => {
      const current = this.df.get(token) || 0;
      if (current <= 1) {
        this.df.delete(token);
      } else {
        this.df.set(token, current - 1);
      }
    });
  }

  /**
   * Executa busca semântica com filtros opcionais.
   * @param {string} query - Consulta textual
   * @param {number} [limit=5] - Máximo de resultados
   * @param {object} [filters] - Filtros opcionais
   * @param {string} [filters.category] - Filtrar por categoria
   * @param {number} [filters.priority] - Filtrar por prioridade mínima
   * @param {string[]} [filters.tags] - Filtrar por qualquer uma destas tags
   * @param {number} [filters.minScore] - Pontuação mínima de similaridade
   * @returns {Array<{id, text, metadata, score}>} Resultados ordenados por relevância
   */
  search(query, limit = 5, filters = {}) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.documents.length === 0) {
      return [];
    }

    const queryTf = getTermFrequency(queryTokens);
    const numDocs = this.documents.length;

    // Pré-filtra documentos conforme filtros de metadados
    let candidates = this.documents;

    if (filters.category) {
      candidates = candidates.filter(d =>
        d.metadata && d.metadata.category === filters.category
      );
    }

    if (filters.priority != null) {
      candidates = candidates.filter(d =>
        d.metadata && d.metadata.priority != null && d.metadata.priority >= filters.priority
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      const filterTagSet = new Set(filters.tags);
      candidates = candidates.filter(d =>
        d.metadata && Array.isArray(d.metadata.tags) &&
        d.metadata.tags.some(tag => filterTagSet.has(tag))
      );
    }

    // Calcula TF-IDF + similaridade de cosseno para cada candidato
    const results = candidates.map(doc => {
      const queryWeights = new Map();
      const docWeights = new Map();

      const termUnion = new Set([...queryTokens, ...doc.tokens]);

      termUnion.forEach(term => {
        const docFreq = this.df.get(term) || 0;
        const idf = docFreq > 0 ? Math.log(numDocs / docFreq) + 1 : 1;

        if (queryTf.has(term)) {
          queryWeights.set(term, queryTf.get(term) * idf);
        }
        if (doc.tfMap.has(term)) {
          docWeights.set(term, doc.tfMap.get(term) * idf);
        }
      });

      const score = cosineSimilarity(queryWeights, docWeights);

      return {
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        score: Math.round(score * 10000) / 10000   // 4 casas decimais
      };
    });

    // Aplica filtro de pontuação mínima
    const minScore = filters.minScore || 0;

    return results
      .filter(r => r.score > minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Reconstrói todo o índice TF-IDF a partir dos documentos armazenados.
   * Útil após edições em massa ou quando o índice fica inconsistente.
   */
  rebuildIndex() {
    const count = this.documents.length;
    this._rebuildComputedFields();
    logInfo('[VectorStore] Índice reconstruído', { documentos: count, termos: this.df.size });
  }

  /**
   * Persiste o índice em disco (sem tfMap/tokens).
   */
  save() {
    try {
      const serializable = this.documents.map(doc => ({
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata
      }));

      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      fs.writeFileSync(INDEX_FILE, JSON.stringify(serializable, null, 2), 'utf8');
      this._insertionsSinceSave = 0;

      logInfo('[VectorStore] Índice salvo em disco', {
        arquivo: INDEX_FILE,
        documentos: serializable.length
      });
    } catch (err) {
      logError('[VectorStore] Falha ao salvar índice', err, { arquivo: INDEX_FILE });
    }
  }

  /**
   * Carrega o índice do disco e reconstrói campos computados.
   */
  load() {
    try {
      if (!fs.existsSync(INDEX_FILE)) {
        logInfo('[VectorStore] Nenhum índice encontrado em disco, iniciando vazio', {
          arquivo: INDEX_FILE
        });
        return;
      }

      const raw = fs.readFileSync(INDEX_FILE, 'utf8');
      const data = JSON.parse(raw);

      if (!Array.isArray(data)) {
        logError('[VectorStore] Formato de índice inválido (esperado array)', null, {
          arquivo: INDEX_FILE
        });
        return;
      }

      this.documents = data.map(entry => ({
        id: entry.id,
        text: entry.text,
        metadata: entry.metadata || {},
        tfMap: new Map(),
        tokens: []
      }));

      // Reconstrói TF-IDF
      this._rebuildComputedFields();
      this._insertionsSinceSave = 0;

      logInfo('[VectorStore] Índice carregado do disco', {
        arquivo: INDEX_FILE,
        documentos: this.documents.length,
        termos: this.df.size
      });
    } catch (err) {
      logError('[VectorStore] Falha ao carregar índice', err, { arquivo: INDEX_FILE });
      this.documents = [];
      this.df.clear();
    }
  }

  /**
   * Limpa todos os documentos e o índice.
   */
  clear() {
    const prevCount = this.documents.length;
    this.documents = [];
    this.df.clear();
    this._insertionsSinceSave = 0;

    logInfo('[VectorStore] Índice limpo', { documentosRemovidos: prevCount });
  }

  /**
   * Retorna estatísticas do índice.
   * @returns {{ totalDocuments: number, totalTerms: number, avgDocLength: number }}
   */
  getStats() {
    const totalDocuments = this.documents.length;
    const totalTerms = this.df.size;
    const totalTokens = this.documents.reduce((sum, doc) => sum + (doc.tokens ? doc.tokens.length : 0), 0);
    const avgDocLength = totalDocuments > 0 ? Math.round((totalTokens / totalDocuments) * 100) / 100 : 0;

    return { totalDocuments, totalTerms, avgDocLength };
  }

  /**
   * Retorna a quantidade de documentos indexados.
   * @returns {number}
   */
  getDocumentCount() {
    return this.documents.length;
  }

  /**
   * Encerra o timer de auto-save. Chamar ao destruir a instância.
   */
  destroy() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }

    // Salva pendências antes de encerrar
    if (this._insertionsSinceSave > 0) {
      this.save();
    }

    logInfo('[VectorStore] Instância encerrada');
  }
}

module.exports = VectorStore;
