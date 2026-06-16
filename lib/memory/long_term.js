/**
 * @module LongTermMemory
 * @description Módulo de Memória de Longo Prazo para o sistema hierárquico de memória Vexx AI OS.
 *
 * Armazena entradas persistentes em JSON com categorias, prioridades, controle de acesso
 * e auto-save com debounce. Suporta migração do formato legado (db_long_term_memory.json).
 *
 * @example
 *   const LongTermMemory = require('./memory/long_term');
 *   const ltm = new LongTermMemory();
 *   const entry = ltm.add('Usuário prefere respostas curtas', 'preference', 'HIGH', ['ux']);
 */

const fs = require('fs');
const path = require('path');
const { logInfo, logError } = require('../observability');

const DATA_DIR = path.resolve(__dirname, '../../data/memory');
const STORE_FILE = path.join(DATA_DIR, 'long_term.json');

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Categorias válidas para entradas de memória de longo prazo. */
const VALID_CATEGORIES = [
  'preference', 'project', 'habit', 'goal', 'history',
  'learning', 'conversation', 'document', 'code', 'note'
];

/** Níveis de prioridade válidos (do mais alto ao mais baixo). */
const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** Intervalo mínimo de debounce para auto-save (ms). */
const SAVE_DEBOUNCE_MS = 2000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Gera um ID único para uma entrada de longo prazo.
 * Formato: lt_<timestamp>_<3 caracteres aleatórios>
 * @returns {string}
 */
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 3; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `lt_${Date.now()}_${rand}`;
}

// ─── Classe ──────────────────────────────────────────────────────────────────

class LongTermMemory {
  /**
   * Cria uma instância de LongTermMemory.
   * Garante que o diretório de dados existe e carrega o armazenamento do disco.
   */
  constructor() {
    /** @type {Map<string, object>} Mapa de entradas em memória, indexado por ID. */
    this._entries = new Map();

    /** @type {NodeJS.Timeout|null} Handle do timer de debounce para auto-save. */
    this._saveTimer = null;

    this._ensureDataDir();
    this._load();
  }

  // ─── Persistência ────────────────────────────────────────────────────────

  /**
   * Garante que o diretório de dados existe.
   * @private
   */
  _ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        logInfo('[LongTermMemory] Diretório de dados criado', { path: DATA_DIR });
      }
    } catch (err) {
      logError('[LongTermMemory] Falha ao criar diretório de dados', err, { path: DATA_DIR });
    }
  }

  /**
   * Carrega todas as entradas do arquivo JSON para o Map em memória.
   * @private
   */
  _load() {
    try {
      if (!fs.existsSync(STORE_FILE)) {
        this._entries = new Map();
        logInfo('[LongTermMemory] Nenhum arquivo encontrado — iniciando armazenamento vazio');
        return;
      }

      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const data = JSON.parse(raw);

      this._entries = new Map();
      if (Array.isArray(data)) {
        for (const entry of data) {
          if (entry && entry.id) {
            this._entries.set(entry.id, entry);
          }
        }
      }

      logInfo('[LongTermMemory] Dados carregados do disco', { totalEntries: this._entries.size });
    } catch (err) {
      logError('[LongTermMemory] Falha ao carregar dados — iniciando vazio', err);
      this._entries = new Map();
    }
  }

  /**
   * Persiste todas as entradas no disco de forma síncrona.
   * @private
   */
  _saveToDisk() {
    try {
      this._ensureDataDir();
      const data = Array.from(this._entries.values());
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      logError('[LongTermMemory] Falha ao gravar dados no disco', err);
    }
  }

  /**
   * Agenda um auto-save com debounce. A gravação real ocorre no máximo
   * uma vez a cada {@link SAVE_DEBOUNCE_MS} milissegundos.
   * @private
   */
  _scheduleSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }
    this._saveTimer = setTimeout(() => {
      this._saveToDisk();
      this._saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Adiciona uma nova entrada na memória de longo prazo.
   *
   * @param {string} content - Conteúdo textual da entrada.
   * @param {string} [category='note'] - Categoria (deve ser uma de {@link VALID_CATEGORIES}).
   * @param {string} [priority='MEDIUM'] - Nível de prioridade ({@link VALID_PRIORITIES}).
   * @param {string[]} [tags=[]] - Tags para organização.
   * @param {string} [source=''] - Fonte ou origem da informação.
   * @param {string} [summary=''] - Resumo breve do conteúdo.
   * @param {string[]} [relatedIds=[]] - IDs de entradas relacionadas.
   * @returns {object} A entrada criada.
   */
  add(content, category = 'note', priority = 'MEDIUM', tags = [], source = '', summary = '', relatedIds = []) {
    if (!content || typeof content !== 'string') {
      logError('[LongTermMemory] Conteúdo inválido ao adicionar entrada', null, { content });
      throw new Error('Conteúdo é obrigatório e deve ser uma string');
    }

    const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'note';
    const safePriority = VALID_PRIORITIES.includes(priority) ? priority : 'MEDIUM';

    const now = new Date().toISOString();
    const entry = {
      id: generateId(),
      category: safeCategory,
      priority: safePriority,
      content,
      summary: summary || '',
      tags: Array.isArray(tags) ? tags : [],
      source: source || '',
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: null,
      promotedToLongTerm: true,
      consolidated: false,
      relatedIds: Array.isArray(relatedIds) ? relatedIds : []
    };

    this._entries.set(entry.id, entry);
    this._scheduleSave();

    logInfo('[LongTermMemory] Entrada adicionada', { id: entry.id, category: safeCategory, priority: safePriority });
    return { ...entry };
  }

  /**
   * Recupera uma entrada pelo ID. Atualiza accessCount e lastAccessedAt.
   *
   * @param {string} id - ID da entrada.
   * @returns {object|null} A entrada encontrada ou null.
   */
  get(id) {
    const entry = this._entries.get(id);
    if (!entry) {
      return null;
    }

    // Atualiza estatísticas de acesso
    entry.accessCount = (entry.accessCount || 0) + 1;
    entry.lastAccessedAt = new Date().toISOString();
    this._scheduleSave();

    return { ...entry };
  }

  /**
   * Atualiza campos de uma entrada existente. Faz merge parcial.
   *
   * @param {string} id - ID da entrada a atualizar.
   * @param {object} updates - Campos a mesclar na entrada.
   * @returns {object|null} A entrada atualizada ou null se não encontrada.
   */
  update(id, updates = {}) {
    const entry = this._entries.get(id);
    if (!entry) {
      logError('[LongTermMemory] Entrada não encontrada para atualização', null, { id });
      return null;
    }

    // Campos protegidos que não podem ser sobrescritos externamente
    const protectedKeys = ['id', 'createdAt'];

    for (const [key, value] of Object.entries(updates)) {
      if (protectedKeys.includes(key)) continue;

      // Valida categoria e prioridade se estiverem entre as atualizações
      if (key === 'category' && !VALID_CATEGORIES.includes(value)) continue;
      if (key === 'priority' && !VALID_PRIORITIES.includes(value)) continue;

      entry[key] = value;
    }

    entry.updatedAt = new Date().toISOString();
    this._scheduleSave();

    logInfo('[LongTermMemory] Entrada atualizada', { id });
    return { ...entry };
  }

  /**
   * Remove uma entrada pelo ID.
   *
   * @param {string} id - ID da entrada a remover.
   * @returns {boolean} true se removida, false se não encontrada.
   */
  remove(id) {
    const existed = this._entries.delete(id);
    if (existed) {
      this._scheduleSave();
      logInfo('[LongTermMemory] Entrada removida', { id });
    }
    return existed;
  }

  /**
   * Remove múltiplas entradas de uma vez.
   *
   * @param {string[]} ids - Array de IDs a remover.
   * @returns {number} Quantidade de entradas efetivamente removidas.
   */
  bulkRemove(ids = []) {
    let removedCount = 0;
    for (const id of ids) {
      if (this._entries.delete(id)) {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this._scheduleSave();
      logInfo('[LongTermMemory] Remoção em lote concluída', { solicitados: ids.length, removidos: removedCount });
    }
    return removedCount;
  }

  // ─── Consultas ───────────────────────────────────────────────────────────

  /**
   * Retorna todas as entradas como array.
   *
   * @returns {object[]} Cópia de todas as entradas.
   */
  getAll() {
    return Array.from(this._entries.values()).map(e => ({ ...e }));
  }

  /**
   * Filtra entradas com base em critérios compostos.
   *
   * @param {object} [filters={}] - Critérios de filtragem.
   * @param {string} [filters.category] - Filtrar por categoria.
   * @param {string} [filters.priority] - Filtrar por prioridade.
   * @param {string[]} [filters.tags] - Filtrar por tags (qualquer tag em comum).
   * @param {string|Date} [filters.since] - Retornar apenas entradas criadas após esta data.
   * @param {number} [filters.maxAge] - Idade máxima em dias (relativo a agora).
   * @returns {object[]} Entradas que correspondem a todos os filtros aplicados.
   */
  find(filters = {}) {
    const { category, priority, tags, since, maxAge } = filters;
    const now = Date.now();
    let results = Array.from(this._entries.values());

    if (category) {
      results = results.filter(e => e.category === category);
    }

    if (priority) {
      results = results.filter(e => e.priority === priority);
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      results = results.filter(e =>
        Array.isArray(e.tags) && tags.some(t => e.tags.includes(t))
      );
    }

    if (since) {
      const sinceMs = new Date(since).getTime();
      results = results.filter(e => new Date(e.createdAt).getTime() >= sinceMs);
    }

    if (typeof maxAge === 'number' && maxAge > 0) {
      const cutoff = now - maxAge * 24 * 60 * 60 * 1000;
      results = results.filter(e => new Date(e.createdAt).getTime() >= cutoff);
    }

    return results.map(e => ({ ...e }));
  }

  /**
   * Conveniência: retorna todas as entradas de uma categoria.
   *
   * @param {string} category - Categoria desejada.
   * @returns {object[]}
   */
  getByCategory(category) {
    return this.find({ category });
  }

  /**
   * Conveniência: retorna todas as entradas de uma prioridade.
   *
   * @param {string} priority - Prioridade desejada.
   * @returns {object[]}
   */
  getByPriority(priority) {
    return this.find({ priority });
  }

  /**
   * Retorna entradas obsoletas — mais velhas que N dias e com poucos acessos.
   *
   * @param {number} [maxAgeDays=30] - Idade mínima em dias para considerar obsoleta.
   * @param {number} [maxAccess=0] - Máximo de acessos para considerar obsoleta (≤).
   * @returns {object[]}
   */
  getStale(maxAgeDays = 30, maxAccess = 0) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    return Array.from(this._entries.values())
      .filter(e => {
        const created = new Date(e.createdAt).getTime();
        return created <= cutoff && (e.accessCount || 0) <= maxAccess;
      })
      .map(e => ({ ...e }));
  }

  // ─── Estatísticas ────────────────────────────────────────────────────────

  /**
   * Retorna estatísticas agregadas do armazenamento.
   *
   * @returns {{ totalEntries: number, byCategory: object, byPriority: object, oldestEntry: string|null, newestEntry: string|null }}
   */
  getStats() {
    const entries = Array.from(this._entries.values());

    const byCategory = {};
    for (const cat of VALID_CATEGORIES) {
      byCategory[cat] = 0;
    }

    const byPriority = {};
    for (const pri of VALID_PRIORITIES) {
      byPriority[pri] = 0;
    }

    let oldest = null;
    let newest = null;

    for (const entry of entries) {
      // Contagem por categoria
      if (byCategory[entry.category] !== undefined) {
        byCategory[entry.category]++;
      }

      // Contagem por prioridade
      if (byPriority[entry.priority] !== undefined) {
        byPriority[entry.priority]++;
      }

      // Datas extremas
      const ts = new Date(entry.createdAt).getTime();
      if (oldest === null || ts < new Date(oldest).getTime()) {
        oldest = entry.createdAt;
      }
      if (newest === null || ts > new Date(newest).getTime()) {
        newest = entry.createdAt;
      }
    }

    return {
      totalEntries: entries.length,
      byCategory,
      byPriority,
      oldestEntry: oldest,
      newestEntry: newest
    };
  }

  // ─── Migração ────────────────────────────────────────────────────────────

  /**
   * Importa dados do formato legado (db_long_term_memory.json) para o novo formato.
   *
   * O formato legado contém: { preferences, profiles, past_learnings, interactions }.
   * Cada item é convertido em uma entrada estruturada com categoria e prioridade apropriadas.
   *
   * @param {object} oldData - Dados no formato legado.
   * @returns {{ imported: number, skipped: number }} Contadores de migração.
   */
  migrate(oldData) {
    if (!oldData || typeof oldData !== 'object') {
      logError('[LongTermMemory] Dados de migração inválidos', null, { oldData });
      return { imported: 0, skipped: 0 };
    }

    let imported = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    // Migrar preferências
    if (oldData.preferences && typeof oldData.preferences === 'object') {
      for (const [key, value] of Object.entries(oldData.preferences)) {
        try {
          this.add(
            `${key}: ${value}`,
            'preference',
            'HIGH',
            ['migrado', 'preferencia', key],
            'db_long_term_memory.json',
            `Preferência migrada: ${key}`
          );
          imported++;
        } catch (err) {
          logError('[LongTermMemory] Falha ao migrar preferência', err, { key });
          skipped++;
        }
      }
    }

    // Migrar perfis
    if (oldData.profiles && typeof oldData.profiles === 'object') {
      for (const [username, profileData] of Object.entries(oldData.profiles)) {
        try {
          this.add(
            JSON.stringify(profileData, null, 2),
            'project',
            'MEDIUM',
            ['migrado', 'perfil', username],
            'db_long_term_memory.json',
            `Perfil migrado de @${username}`
          );
          imported++;
        } catch (err) {
          logError('[LongTermMemory] Falha ao migrar perfil', err, { username });
          skipped++;
        }
      }
    }

    // Migrar aprendizados
    if (Array.isArray(oldData.past_learnings)) {
      for (const learning of oldData.past_learnings) {
        if (!learning || typeof learning !== 'string') {
          skipped++;
          continue;
        }
        try {
          this.add(
            learning,
            'learning',
            'MEDIUM',
            ['migrado', 'aprendizado'],
            'db_long_term_memory.json',
            'Aprendizado migrado do formato legado'
          );
          imported++;
        } catch (err) {
          logError('[LongTermMemory] Falha ao migrar aprendizado', err);
          skipped++;
        }
      }
    }

    // Migrar interações
    if (Array.isArray(oldData.interactions)) {
      for (const inter of oldData.interactions) {
        if (!inter || typeof inter !== 'object') {
          skipped++;
          continue;
        }
        try {
          const content = `Interação com @${inter.contactUsername || 'desconhecido'}: "${inter.text || ''}". Resposta: "${inter.reply || ''}"`;
          this.add(
            content,
            'conversation',
            'LOW',
            ['migrado', 'interacao', inter.contactUsername || 'desconhecido'],
            'db_long_term_memory.json',
            `Interação migrada com @${inter.contactUsername || 'desconhecido'}`,
            []
          );
          imported++;
        } catch (err) {
          logError('[LongTermMemory] Falha ao migrar interação', err);
          skipped++;
        }
      }
    }

    logInfo('[LongTermMemory] Migração concluída', { imported, skipped });
    return { imported, skipped };
  }

  // ─── Limpeza ─────────────────────────────────────────────────────────────

  /**
   * Força a gravação imediata no disco (cancela debounce pendente).
   * Útil antes de encerrar o processo.
   */
  flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._saveToDisk();
    logInfo('[LongTermMemory] Flush manual executado');
  }
}

module.exports = LongTermMemory;
