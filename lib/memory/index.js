const path = require('path');
const fs = require('fs');

const ShortTermMemory = require('./short_term');
const LongTermMemory = require('./long_term');
const VectorStore = require('./vector_store');
const Consolidator = require('./consolidator');
const Retriever = require('./retriever');
const AutoLearner = require('./auto_learner');

const { logInfo, logError, logWarn } = require('../observability');

class HierarchicalMemory {
  constructor() {
    this.shortTerm = new ShortTermMemory();
    this.longTerm = new LongTermMemory();
    this.vectorStore = new VectorStore();
    
    // Inicializar motores de inteligência vinculados às instâncias das camadas de base
    const deps = {
      shortTerm: this.shortTerm,
      longTerm: this.longTerm,
      vectorStore: this.vectorStore
    };
    
    this.consolidator = new Consolidator(deps);
    this.retriever = new Retriever(deps);
    this.autoLearner = new AutoLearner(deps);
    
    this._initialized = false;
  }

  /**
   * Inicializa o sistema de memória completo, migrando dados se necessário
   * e ativando loops de consolidação e auto-aprendizado periódicos.
   */
  initialize() {
    if (this._initialized) return;

    try {
      logInfo('[HierarchicalMemory] Inicializando sistema de memória hierárquica...');
      
      // 1. Carregar/Inicializar camadas de dados
      this.vectorStore.load(); // Carrega o índice do vetor do disco

      // 2. Verificar se o índice vetorial está vazio e precisa ser populado a partir da LTM
      const docCount = this.vectorStore.getDocumentCount();
      const ltEntries = this.longTerm.getAll();
      
      if (docCount === 0 && ltEntries.length > 0) {
        logInfo('[HierarchicalMemory] Índice vetorial vazio. Populando a partir da memória de longo prazo...');
        ltEntries.forEach(entry => {
          this.vectorStore.addDocument(entry.id, entry.content, {
            category: entry.category,
            priority: entry.priority,
            tags: entry.tags,
            source: entry.source,
            createdAt: entry.createdAt
          });
        });
        this.vectorStore.save();
      }

      // 3. Executar migração do arquivo legado db_long_term_memory.json se ele existir
      this._migrateLegacyData();

      // 4. Iniciar os motores periódicos (consolidador a cada 30min, auto-learner a cada 10min)
      this.consolidator.startPeriodicConsolidation(30 * 60 * 1000);
      this.autoLearner.startPeriodicAnalysis(10 * 60 * 1000);

      this._initialized = true;
      logInfo('[HierarchicalMemory] Sistema de memória hierárquica inicializado com sucesso.');
    } catch (err) {
      logError('[HierarchicalMemory] Falha ao inicializar sistema de memória', err);
    }
  }

  /**
   * Encerra todos os timers e salva dados pendentes
   */
  destroy() {
    try {
      this.consolidator.stopPeriodicConsolidation();
      this.autoLearner.stopPeriodicAnalysis();
      this.vectorStore.destroy(); // Para timers internos e faz flush final
      this.longTerm.flush(); // Força gravação em lote pendente do LTM
      logInfo('[HierarchicalMemory] Sistema de memória encerrado e sincronizado.');
    } catch (err) {
      logError('[HierarchicalMemory] Erro ao encerrar sistema de memória', err);
    }
  }

  /**
   * Registra uma nova memória, roteando-a automaticamente para as camadas
   * corretas baseada em categoria e prioridade.
   * 
   * @param {string} content - Conteúdo textual
   * @param {string} category - Categoria (preference, task, conversation, etc.)
   * @param {string} priority - Prioridade (CRITICAL, HIGH, MEDIUM, LOW)
   * @param {string[]} tags - Marcadores para indexação
   * @param {string} source - Origem (chat, agent, user, scraper)
   * @param {number} [ttlMs] - TTL opcional (apenas para short-term)
   * @returns {object} Entrada de memória salva
   */
  remember(content, category, priority = 'MEDIUM', tags = [], source = 'system', ttlMs = null) {
    if (!content || typeof content !== 'string') {
      throw new Error('[HierarchicalMemory] Conteúdo inválido para gravação de memória.');
    }

    try {
      // 1. Sempre salvar na camada short-term (RAM)
      const stEntry = this.shortTerm.add(content, category, priority, tags, source, ttlMs);

      // 2. Se for uma categoria de persistência de longo prazo ou prioridade crítica/alta, salvar na LTM e VectorStore
      const ltmCategories = ['preference', 'project', 'habit', 'goal', 'history', 'learning', 'document', 'code', 'note'];
      
      if (ltmCategories.includes(category) || priority === 'CRITICAL' || priority === 'HIGH') {
        const ltEntry = this.longTerm.add(content, category, priority, tags, source);
        
        // Indexar no VectorStore
        this.vectorStore.addDocument(ltEntry.id, content, {
          category,
          priority,
          tags,
          source,
          createdAt: ltEntry.createdAt
        });
        
        return ltEntry;
      }

      return stEntry;
    } catch (err) {
      logError(`[HierarchicalMemory] Erro ao registrar memória (${category})`, err);
      throw err;
    }
  }

  /**
   * Recupera memórias relevantes com filtros e ordenação inteligente.
   * @param {string} query 
   * @param {object} [filters] 
   * @param {number} [limit]
   */
  recall(query, limit = 5, filters = {}) {
    return this.retriever.quickSearch(query, limit, filters);
  }

  /**
   * Constrói o ContextPacket ideal para alimentar um prompt de agente.
   * @param {string} query - Consulta de busca ou tema atual da conversa
   * @param {object} [options] - Filtros adicionais de categoria/prioridade
   * @returns {object}
   */
  getContext(query, options = {}) {
    return this.retriever.buildContext(query, options);
  }

  /**
   * Registra um aprendizado de longo prazo diretamente.
   * @param {string} topic - Tópico ou assunto do aprendizado
   * @param {string} content - Detalhes do aprendizado
   */
  learn(topic, content) {
    try {
      const fullText = `Aprendizado sobre [${topic}]: ${content}`;
      const entry = this.longTerm.add(fullText, 'learning', 'HIGH', [topic, 'learning'], 'system');
      
      this.vectorStore.addDocument(entry.id, fullText, {
        category: 'learning',
        priority: 'HIGH',
        tags: [topic, 'learning'],
        source: 'system',
        createdAt: entry.createdAt
      });
      
      logInfo(`[HierarchicalMemory] Novo aprendizado catalogado e vetorizado: "${topic}"`);
      return entry;
    } catch (err) {
      logError(`[HierarchicalMemory] Erro ao gravar aprendizado`, err);
    }
  }

  /**
   * Métodos de compatibilidade retrógrada para a API antiga
   */
  searchSemantic(query, limit = 3) {
    return this.recall(query, limit);
  }

  recordInteraction(contactUsername, text, reply) {
    try {
      const fullText = `Interação com @${contactUsername}: "${text}". Resposta: "${reply}"`;
      const entry = this.longTerm.add(
        fullText,
        'conversation',
        'MEDIUM',
        [contactUsername, 'interaction'],
        'agent'
      );
      this.vectorStore.addDocument(entry.id, fullText, {
        category: 'conversation',
        priority: 'MEDIUM',
        tags: [contactUsername, 'interaction'],
        source: 'agent',
        createdAt: entry.createdAt
      });
      logInfo(`[HierarchicalMemory] Interação registrada para @${contactUsername}.`);
      return entry;
    } catch (err) {
      logError(`[HierarchicalMemory] Erro ao registrar interação`, err);
    }
  }

  addLearning(learningText) {
    return this.learn('geral', learningText);
  }


  /**
   * Executa a consolidação das memórias sob demanda.
   */
  consolidate() {
    logInfo('[HierarchicalMemory] Iniciando consolidação manual de memória...');
    const result = this.consolidator.runConsolidation();
    logInfo('[HierarchicalMemory] Consolidação concluída.', result);
    return result;
  }

  /**
   * Retorna estatísticas completas e o estado de saúde do sistema de memória.
   */
  getStats() {
    return {
      initialized: this._initialized,
      shortTerm: this.shortTerm.getStats(),
      longTerm: this.longTerm.getStats(),
      vectorStore: this.vectorStore.getStats(),
      detectedPatterns: this.autoLearner.getDetectedPatterns(),
      consolidationHistory: this.consolidator.getConsolidationLog()
    };
  }

  /**
   * Migra o formato legado db_long_term_memory.json se ele existir na raiz do data/
   * @private
   */
  _migrateLegacyData() {
    const legacyPath = path.resolve(__dirname, '../../data/db_long_term_memory.json');
    if (!fs.existsSync(legacyPath)) return;

    try {
      logInfo('[HierarchicalMemory] Arquivo de memória legado detectado. Iniciando migração...');
      const raw = fs.readFileSync(legacyPath, 'utf8');
      const legacyData = JSON.parse(raw);

      this.longTerm.migrate(legacyData);
      
      // Reconstruir/re-salvar tudo no VectorStore
      this.longTerm.getAll().forEach(entry => {
        this.vectorStore.addDocument(entry.id, entry.content, {
          category: entry.category,
          priority: entry.priority,
          tags: entry.tags,
          source: entry.source,
          createdAt: entry.createdAt
        });
      });
      
      this.vectorStore.save();

      // Renomear legado para backup
      const backupPath = path.resolve(__dirname, '../../data/db_long_term_memory.json.bak');
      fs.renameSync(legacyPath, backupPath);
      logInfo('[HierarchicalMemory] Migração concluída com sucesso. Backup gerado em db_long_term_memory.json.bak.');
    } catch (err) {
      logError('[HierarchicalMemory] Erro durante migração dos dados legados', err);
    }
  }
}

// Singleton exportado por padrão
const memoryInstance = new HierarchicalMemory();
module.exports = memoryInstance;
