/**
 * @module ShortTermMemory
 * @description Módulo de Memória de Curto Prazo para o sistema hierárquico de memória Vexx AI OS.
 * Cache em RAM usando Map — sem I/O de disco.
 * Suporta TTL (padrão 30 min), evicção LRU (máx 200 entradas),
 * categorias, prioridades, busca textual e estatísticas.
 */

'use strict';

// ─── Constantes ──────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutos
const MAX_ENTRIES = 200;

const VALID_CATEGORIES = new Set([
  'conversation',
  'task',
  'context',
  'preference',
  'note',
]);

const VALID_PRIORITIES = new Set([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Gera um ID único no formato `st_<timestamp>_<3 chars aleatórios>`.
 * @returns {string}
 */
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 3; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `st_${Date.now()}_${rand}`;
}

// ─── Classe ──────────────────────────────────────────────────────────────────

class ShortTermMemory {
  constructor() {
    /** @type {Map<string, object>} */
    this._store = new Map();
  }

  // ── Gestão de TTL / LRU ──────────────────────────────────────────────────

  /**
   * Remove todas as entradas cujo TTL já expirou.
   * @returns {number} Quantidade de entradas removidas.
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [id, entry] of this._store) {
      if (now - entry.createdAt > entry.ttl) {
        this._store.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[ShortTermMemory] Limpeza: ${removed} entrada(s) expirada(s) removida(s).`);
    }
    return removed;
  }

  /**
   * Evicta a entrada acessada há mais tempo (LRU) quando o cache
   * atinge o limite máximo de entradas.
   * @private
   */
  _evictIfNeeded() {
    while (this._store.size >= MAX_ENTRIES) {
      let oldestId = null;
      let oldestAccess = Infinity;

      for (const [id, entry] of this._store) {
        if (entry.lastAccessedAt < oldestAccess) {
          oldestAccess = entry.lastAccessedAt;
          oldestId = id;
        }
      }

      if (oldestId) {
        console.log(`[ShortTermMemory] Evicção LRU: removendo entrada "${oldestId}".`);
        this._store.delete(oldestId);
      } else {
        break; // segurança contra loop infinito
      }
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  /**
   * Adiciona uma nova entrada à memória de curto prazo.
   * @param {string}   content  - Conteúdo da entrada.
   * @param {string}   category - Uma das categorias válidas.
   * @param {string}   [priority='MEDIUM'] - Nível de prioridade.
   * @param {string[]} [tags=[]]  - Tags associadas.
   * @param {string}   [source=''] - Origem da informação.
   * @param {number}   [ttlMs]    - Tempo de vida em ms (padrão 30 min).
   * @returns {object} A entrada criada.
   */
  add(content, category, priority = 'MEDIUM', tags = [], source = '', ttlMs) {
    if (!content) {
      throw new Error('O conteúdo da entrada não pode ser vazio.');
    }

    if (!VALID_CATEGORIES.has(category)) {
      throw new Error(
        `Categoria inválida "${category}". Válidas: ${[...VALID_CATEGORIES].join(', ')}`
      );
    }

    if (!VALID_PRIORITIES.has(priority)) {
      throw new Error(
        `Prioridade inválida "${priority}". Válidas: ${[...VALID_PRIORITIES].join(', ')}`
      );
    }

    // Limpar expirados antes de inserir
    this.cleanup();

    // Evicção LRU se necessário
    this._evictIfNeeded();

    const now = Date.now();
    const id = generateId();

    const entry = {
      id,
      category,
      priority,
      content,
      tags: Array.isArray(tags) ? tags : [tags],
      source: source || '',
      createdAt: now,
      accessCount: 0,
      lastAccessedAt: now,
      ttl: typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS,
    };

    this._store.set(id, entry);
    console.log(
      `[ShortTermMemory] Entrada adicionada: id=${id}, categoria=${category}, prioridade=${priority}`
    );
    return { ...entry };
  }

  /**
   * Recupera uma entrada pelo ID. Atualiza accessCount e lastAccessedAt.
   * @param {string} id
   * @returns {object|null} Cópia da entrada ou null se não encontrada / expirada.
   */
  get(id) {
    this.cleanup();

    const entry = this._store.get(id);
    if (!entry) return null;

    entry.accessCount++;
    entry.lastAccessedAt = Date.now();

    return { ...entry };
  }

  /**
   * Retorna todas as entradas de uma determinada categoria (não expiradas).
   * @param {string} category
   * @returns {object[]}
   */
  getByCategory(category) {
    this.cleanup();

    const results = [];
    for (const entry of this._store.values()) {
      if (entry.category === category) {
        results.push({ ...entry });
      }
    }
    return results;
  }

  /**
   * Retorna as últimas N entradas da categoria 'conversation',
   * ordenadas por createdAt (mais recentes primeiro).
   * @param {number} [limit=10]
   * @returns {object[]}
   */
  getConversationContext(limit = 10) {
    const conversations = this.getByCategory('conversation');
    conversations.sort((a, b) => b.createdAt - a.createdAt);
    return conversations.slice(0, limit);
  }

  /**
   * Retorna a entrada mais recente da categoria 'task', ou null.
   * @returns {object|null}
   */
  getCurrentTask() {
    const tasks = this.getByCategory('task');
    if (tasks.length === 0) return null;
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    return tasks[0];
  }

  /**
   * Busca textual simples no campo `content` (case-insensitive).
   * @param {string} query
   * @returns {object[]} Entradas correspondentes.
   */
  search(query) {
    this.cleanup();

    if (!query || typeof query !== 'string') return [];

    const lower = query.toLowerCase();
    const results = [];

    for (const entry of this._store.values()) {
      const text = typeof entry.content === 'string'
        ? entry.content
        : JSON.stringify(entry.content);

      if (text.toLowerCase().includes(lower)) {
        results.push({ ...entry });
      }
    }
    return results;
  }

  /**
   * Remove uma entrada pelo ID.
   * @param {string} id
   * @returns {boolean} true se removida, false se não encontrada.
   */
  remove(id) {
    const deleted = this._store.delete(id);
    if (deleted) {
      console.log(`[ShortTermMemory] Entrada removida: id=${id}`);
    }
    return deleted;
  }

  /**
   * Limpa todas as entradas.
   */
  clear() {
    const size = this._store.size;
    this._store.clear();
    console.log(`[ShortTermMemory] Cache limpo — ${size} entrada(s) removida(s).`);
  }

  /**
   * Retorna todas as entradas não expiradas.
   * @returns {object[]}
   */
  getAll() {
    this.cleanup();

    const all = [];
    for (const entry of this._store.values()) {
      all.push({ ...entry });
    }
    return all;
  }

  /**
   * Retorna estatísticas do cache.
   * @returns {{ totalEntries: number, byCategory: object, byPriority: object }}
   */
  getStats() {
    this.cleanup();

    const byCategory = {};
    const byPriority = {};

    for (const cat of VALID_CATEGORIES) byCategory[cat] = 0;
    for (const pri of VALID_PRIORITIES) byPriority[pri] = 0;

    for (const entry of this._store.values()) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      byPriority[entry.priority] = (byPriority[entry.priority] || 0) + 1;
    }

    return {
      totalEntries: this._store.size,
      byCategory,
      byPriority,
    };
  }
}

module.exports = ShortTermMemory;
