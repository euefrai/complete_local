// Vexx AI Debate Arena — State Management

// Default Config template
const defaultConfig = {
  key_gemini: '',
  key_gemini2: '',
  key_groq: '',
  key_openrouter: '',
  key_openai: '',
  key_openai2: '',
  key_huggingface: '',
  key_huggingface2: '',
  key_huggingface3: '',
  key_cohere: '',
  key_claude: '',
  key_cerebras: '',
  enabled_gemini: true,
  enabled_gemini2: true,
  enabled_groq: true,
  enabled_openrouter: true,
  enabled_openai: true,
  enabled_openai2: true,
  enabled_huggingface: true,
  enabled_huggingface2: true,
  enabled_huggingface3: true,
  enabled_cohere: true,
  enabled_claude: true,
  enabled_cerebras: true,
  model_gemini: 'gemini-2.5-flash',
  model_gemini2: 'gemini-2.5-flash',
  model_groq: 'llama-3.3-70b-versatile',
  model_openrouter: 'openrouter/free',
  model_openai: 'gpt-4o-mini',
  model_openai2: 'gpt-4o-mini',
  model_huggingface: 'Qwen/Qwen2.5-72B-Instruct',
  model_huggingface2: 'meta-llama/Llama-3.3-70B-Instruct',
  model_huggingface3: 'Qwen/Qwen2.5-72B-Instruct',
  model_cohere: 'command-a-03-2025',
  model_claude: 'claude-sonnet-4-20250514',
  model_cerebras: 'gpt-oss-120b',
  temperature: 0.7,
  max_tokens: 2048,
  system_prompt: `# wifa jl — COGNITIVE COMPUTER OPERATOR

## MISSÃO
Você não é apenas uma IA.
Você é um Sistema Operacional Cognitivo.
Seu objetivo é operar, organizar, otimizar, automatizar, monitorar e administrar completamente o computador do usuário.

Você age como uma combinação de:
* Administrador de Sistemas
* Engenheiro DevOps
* Especialista Windows
* Especialista Linux
* Operador de Computador
* Especialista Git
* Especialista Cloud
* Especialista Segurança
* Especialista Redes
* Especialista Navegadores
* Especialista Arquivos
* Especialista Automação
* Especialista IA
* Assistente Executivo Digital

---

# MODELO MENTAL
Você enxerga o computador como um ecossistema vivo composto por: Arquivos, Pastas, Processos, Programas, Serviços, Redes, Bancos de dados, Navegadores, Repositórios Git, Máquinas virtuais, Containers, Usuários, Permissões. Você compreende a relação entre todos eles.

---

# [FERRAMENTAS DO SISTEMA (XML BLOCKS)]
Você tem ACESSO COMPLETO ao sistema de arquivos e terminal do usuário. Use EXATAMENTE a sintaxe XML abaixo para agir. NUNCA fuja desse formato:

**Operações de Arquivo:**
- Ler arquivo: <file_read path="caminho/do/arquivo"/>
- Listar pasta: <dir_list path="caminho/da/pasta"/>
- Escrever arquivo: <file_write path="caminho/do/arquivo">código ou texto completo</file_write>
- Mover/Renomear: <file_move src="origem" dest="destino"/>
- Copiar: <file_copy src="origem" dest="destino"/>
- Excluir: <file_delete path="alvo"/>
- Web Scraper: <web_fetch url="URL"/> (lê o conteúdo completo de texto de uma página)

**Terminal e Automação:**
- Executar comando (PowerShell/Bash): <terminal_execute>comando aqui</terminal_execute>
- Agendar Tarefa: <schedule_task time="AAAA-MM-DDTHH:mm:ss" type="alert|execute">mensagem ou comando</schedule_task>

**Cérebro & Notas:**
- Salvar nota: <note_write filename="nome.md">conteúdo markdown</note_write>
- Ler nota: <note_read filename="nome.md"/>

**Visualização e Sugestões:**
- Sugerir Ação (Proatividade): <suggest_action title="Título da Ação">Descrição detalhada</suggest_action>
- Árvore ASCII: <visual_map type="ascii" title="Título">diagrama</visual_map>

# REGRAS CRÍTICAS DE OPERAÇÃO
1. **DIVISÃO DE TAREFAS (OBRIGATÓRIO):** Nunca tente resolver missões complexas de uma vez. Divida-as em etapas e execute APENAS A PRÓXIMA ETAPA lógica, aguardando o resultado.
2. **AUTONOMIA E AUTOCORREÇÃO:** Se um comando falhar, você DEVE analisar o erro, reescrever e tentar novamente (até 3 vezes). Pode usar scripts na pasta "skills/".
3. **REGRAS DE SEGURANÇA:** Operações destrutivas exigem que você use <suggest_action> para que o usuário aprove.
4. **INTEGRIDADE DE TEXTO E XML (OBRIGATÓRIO):** Nunca misture ou corrompa sintaxes de XML ou tags. Escreva tags de pensamento (<pensamento></pensamento>) e ações de forma completa e válida. Não use gírias ou abreviações de internet dentro de blocos de código ou de XML de ação (como file_write, terminal_execute). Mantenha o texto limpo, coeso e sem truncamento de strings.
5. O objetivo supremo é transformar o computador em um ambiente organizado, seguro, automatizado e eficiente com o menor esforço do usuário.`,
  obsidian_path: '',
  autonomous_execution: true
};

// Internal module state
const state = {
  attachedFiles: [],
  sessionFilesCount: 0,
  sessionImagesCount: 0,
  chatMessages: [],
  longTermMemories: [],
  vectorMemories: [],
  config: { ...defaultConfig },
  modelUsage: {
    gemini: { count: 0, limit: 30 },
    gemini2: { count: 0, limit: 30 },
    groq: { count: 0, limit: 30 },
    openrouter: { count: 0, limit: 30 },
    openai: { count: 0, limit: 30 },
    openai2: { count: 0, limit: 30 },
    huggingface: { count: 0, limit: 30 },
    huggingface2: { count: 0, limit: 30 },
    huggingface3: { count: 0, limit: 30 },
    cohere: { count: 0, limit: 30 },
    claude: { count: 0, limit: 30 },
    cerebras: { count: 0, limit: 30 }
  }
};

export const PROVIDERS = {
  gemini: { name: 'Gael', initials: 'GE', bgClass: 'info-bg', badgeId: 'badge-gemini', statusId: 'status-gemini' },
  gemini2: { name: 'Gabriela', initials: 'G2', bgClass: 'info-bg', badgeId: 'badge-gemini2', statusId: 'status-gemini2' },
  groq: { name: 'Gregório', initials: 'GR', bgClass: 'success-bg', badgeId: 'badge-groq', statusId: 'status-groq' },
  openrouter: { name: 'Orlando', initials: 'OR', bgClass: 'neutral-bg', badgeId: 'badge-openrouter', statusId: 'status-openrouter' },
  openai: { name: 'Olavo', initials: 'OA', bgClass: 'warning-bg', badgeId: 'badge-openai', statusId: 'status-openai' },
  openai2: { name: 'Otávio', initials: 'O2', bgClass: 'warning-bg', badgeId: 'badge-openai2', statusId: 'status-openai2' },
  huggingface: { name: 'Hugo', initials: 'HF', bgClass: 'purple-bg', badgeId: 'badge-huggingface', statusId: 'status-huggingface' },
  huggingface2: { name: 'Heitor', initials: 'H2', bgClass: 'purple-bg', badgeId: 'badge-huggingface2', statusId: 'status-huggingface2' },
  huggingface3: { name: 'Helena', initials: 'H3', bgClass: 'purple-bg', badgeId: 'badge-huggingface3', statusId: 'status-huggingface3' },
  cohere: { name: 'Júlia', initials: 'JU', bgClass: 'purple-bg', badgeId: 'badge-cohere', statusId: 'status-cohere' },
  claude: { name: 'Clara', initials: 'CL', bgClass: 'info-bg', badgeId: 'badge-claude', statusId: 'status-claude' },
  cerebras: { name: 'Cecília', initials: 'CE', bgClass: 'success-bg', badgeId: 'badge-cerebras', statusId: 'status-cerebras' }
};

export const PROVIDER_CAPABILITIES = {
  gemini:       { skills: ['analysis', 'prompt_engineering', 'creative_writing', 'academic', 'explanation', 'general'], weight: 5 },
  gemini2:      { skills: ['analysis', 'prompt_engineering', 'creative_writing', 'academic', 'explanation', 'general'], weight: 5 },
  groq:         { skills: ['code', 'programming', 'debugging', 'performance', 'scripts', 'automation'], weight: 4 },
  openai:       { skills: ['general', 'summarization', 'structured_analysis', 'translation', 'writing'], weight: 5 },
  openai2:      { skills: ['general', 'summarization', 'structured_analysis', 'translation', 'writing'], weight: 5 },
  openrouter:   { skills: ['creative', 'brainstorming', 'exploration', 'philosophy', 'analogies'], weight: 3 },
  huggingface:  { skills: ['ml', 'ai_models', 'open_source', 'research', 'tools'], weight: 3 },
  huggingface2: { skills: ['nlp', 'engineering', 'benchmarks', 'production', 'architecture'], weight: 3 },
  huggingface3: { skills: ['web_search', 'data', 'statistics', 'evidence', 'fact_checking', 'weather', 'news'], weight: 4 },
  cohere:       { skills: ['general', 'summarization', 'writing', 'explanation'], weight: 3 },
  claude:       { skills: ['code', 'programming', 'debugging', 'analysis', 'prompt_engineering', 'academic', 'general'], weight: 5 },
  cerebras:     { skills: ['general', 'analysis', 'speed', 'explanation'], weight: 4 }
};

// Global variables proxy definition for seamless backwards compatibility
for (const key of Object.keys(state)) {
  Object.defineProperty(window, key, {
    get() { return state[key]; },
    set(val) { state[key] = val; },
    configurable: true
  });
}
window.PROVIDERS = PROVIDERS;
window.PROVIDER_CAPABILITIES = PROVIDER_CAPABILITIES;

// Flow control states
window.isDebateRunning = false;
window.isActionPendingApproval = false;
window.pendingActionsCount = 0;
window.collectedActionResults = [];
window.stopDebateImmediately = false;
window.wrapUpDebate = false;

export function loadConfig() {
  const saved = localStorage.getItem('vexx_arena_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.system_prompt && (!parsed.system_prompt.includes('IDENTIDADE E PERSONA') || !parsed.system_prompt.includes('COMPETÊNCIAS ESSENCIAIS') || !parsed.system_prompt.includes('FERRAMENTAS DO SISTEMA') || !parsed.system_prompt.includes('REGRAS DE OPERAÇÃO CRÍTICAS') || !parsed.system_prompt.includes('PROTOCOLO MULTI-AGENTE'))) {
        parsed.system_prompt = defaultConfig.system_prompt;
      }
      state.config = { ...defaultConfig, ...parsed };
    } catch (e) {
      console.error('Error parsing config', e);
    }
  }

  // Sanitização de modelos obsoletos
  if (state.config.model_groq === 'gemma2-9b-it') {
    state.config.model_groq = 'llama-3.3-70b-versatile';
  }
  if (state.config.model_openrouter === 'google/gemini-2.5-flash:free' || state.config.model_openrouter === 'google/gemini-2.0-flash-exp:free') {
    state.config.model_openrouter = 'openrouter/free';
  }
  if (state.config.model_cerebras === 'llama3.1-70b' || state.config.model_cerebras === 'llama3.1-8b' || state.config.model_cerebras === 'llama-3.3-70b') {
    state.config.model_cerebras = 'gpt-oss-120b';
  }
  if (state.config.model_cohere === 'command-r' || state.config.model_cohere === 'command-r-plus') {
    state.config.model_cohere = 'command-a-03-2025';
  }
  if (state.config.model_claude === 'claude-3-5-sonnet-20241022' || state.config.model_claude === 'claude-3-sonnet-20240229') {
    state.config.model_claude = 'claude-sonnet-4-20250514';
  }

  // Populate UI inputs
  Object.keys(state.config).forEach(key => {
    let elementId = key;
    if (key.startsWith('key_') || key.startsWith('model_')) {
      elementId = key.replace('_', '-');
    } else if (key === 'temperature') {
      elementId = 'param-temperature';
    } else if (key === 'max_tokens') {
      elementId = 'param-max-tokens';
    } else if (key === 'system_prompt') {
      elementId = 'param-system-prompt';
    } else if (key === 'obsidian_path') {
      elementId = 'param-obsidian-path';
    } else if (key === 'autonomous_execution') {
      elementId = 'param-autonomous-execution';
    }

    const el = document.getElementById(elementId);
    if (el) {
      if (el.type === 'checkbox') {
        el.checked = state.config[key];
      } else if (el.type === 'range') {
        el.value = state.config[key];
        const valEl = document.getElementById(elementId === 'param-temperature' ? 'temp-val' : '');
        if (valEl) valEl.textContent = state.config[key];
      } else {
        el.value = state.config[key];
      }
    }

    if (key.startsWith('model_')) {
      const provider = key.split('_')[1];
      const modelVal = state.config[key];
      const selectEl = document.getElementById(`model-${provider}-select`);
      if (selectEl) {
        let optionExists = false;
        for (let i = 0; i < selectEl.options.length; i++) {
          if (selectEl.options[i].value === modelVal) {
            optionExists = true;
            break;
          }
        }
        if (optionExists) {
          selectEl.value = modelVal;
          if (el) el.style.display = 'none';
        } else {
          selectEl.value = 'custom';
          if (el) el.style.display = 'block';
        }
      }
    }
  });
  if (window.updateActiveModelDisplay) window.updateActiveModelDisplay();
}

export function saveKeys() {
  Object.keys(state.config).forEach(key => {
    let elementId = key;
    if (key.startsWith('key_') || key.startsWith('model_')) {
      elementId = key.replace('_', '-');
    } else if (key === 'temperature') {
      elementId = 'param-temperature';
    } else if (key === 'max_tokens') {
      elementId = 'param-max-tokens';
    } else if (key === 'system_prompt') {
      elementId = 'param-system-prompt';
    } else if (key === 'obsidian_path') {
      elementId = 'param-obsidian-path';
    } else if (key === 'autonomous_execution') {
      elementId = 'param-autonomous-execution';
    }

    const el = document.getElementById(elementId);
    if (el) {
      if (el.type === 'checkbox') {
        state.config[key] = el.checked;
      } else if (el.type === 'range') {
        state.config[key] = parseFloat(el.value);
      } else if (el.tagName === 'SELECT') {
        state.config[key] = el.value;
      } else {
        state.config[key] = el.value.trim();
      }
    }
  });

  localStorage.setItem('vexx_arena_config', JSON.stringify(state.config));
  updateProviderStatuses();
  if (window.updateActiveModelDisplay) window.updateActiveModelDisplay();

  const statusEl = document.getElementById('save-status');
  if (statusEl) {
    statusEl.style.display = 'inline-flex';
    statusEl.style.alignItems = 'center';
    statusEl.style.gap = '4px';
    
    clearTimeout(window.saveStatusTimeout);
    window.saveStatusTimeout = setTimeout(() => {
      statusEl.style.display = 'none';
    }, 1500);
  }
}

export function updateProviderStatuses() {
  let activeCount = 0;
  
  Object.keys(PROVIDERS).forEach(provider => {
    let key = state.config[`key_${provider}`];
    const isEnabled = state.config[`enabled_${provider}`] !== false;
    let isInherited = false;
    
    if (provider === 'huggingface2' && !key) {
      key = state.config['key_huggingface'];
      if (key) isInherited = true;
    }
    if (provider === 'huggingface3' && !key) {
      key = state.config['key_huggingface'] || state.config['key_huggingface2'];
      if (key) isInherited = true;
    }
    
    const badge = document.getElementById(PROVIDERS[provider].badgeId);
    const sidebarStatus = document.getElementById(PROVIDERS[provider].statusId);
    
    if (key && isEnabled) {
      activeCount++;
      if (badge) {
        badge.textContent = isInherited ? 'Ativo (Herdado)' : 'Ativo';
        badge.className = 'badge-success';
      }
      if (sidebarStatus) {
        const ind = sidebarStatus.querySelector('.status-indicator');
        ind.textContent = 'ON';
        ind.className = 'status-indicator badge-success';
        if (isInherited) {
          sidebarStatus.title = `${PROVIDERS[provider].name} (Chave Herdada)`;
        } else {
          sidebarStatus.title = PROVIDERS[provider].name;
        }
      }
    } else {
      if (badge) {
        badge.textContent = key ? 'Desativado' : 'Não configurado';
        badge.className = 'badge-neutral';
      }
      if (sidebarStatus) {
        const ind = sidebarStatus.querySelector('.status-indicator');
        ind.textContent = 'OFF';
        ind.className = 'status-indicator badge-neutral';
        sidebarStatus.title = PROVIDERS[provider].name;
      }
    }
  });

  const metricActiveEl = document.getElementById('metric-active-count');
  if (metricActiveEl) {
    metricActiveEl.textContent = `${activeCount}/${Object.keys(PROVIDERS).length}`;
  }
  
  const warning = document.getElementById('no-keys-warning');
  if (warning) {
    warning.style.display = activeCount > 0 ? 'none' : 'flex';
  }
}

export function updateUsageTracker(provider) {
  const usage = state.modelUsage[provider];
  if (!usage) return;
  
  const container = document.querySelector(`#status-${provider} .usage-circle-container`);
  if (container) {
    container.title = `Uso: ${usage.count} / ${usage.limit} requisições`;
  }
  
  const bar = document.getElementById(`usage-bar-${provider}`);
  const text = document.getElementById(`usage-text-${provider}`);
  
  if (text) {
    text.textContent = usage.count;
  }
  
  if (bar) {
    const radius = 8;
    const circumference = 2 * Math.PI * radius;
    bar.style.strokeDasharray = circumference;
    
    const percent = Math.min(100, (usage.count / usage.limit) * 100);
    const offset = circumference - (percent / 100) * circumference;
    bar.style.strokeDashoffset = offset;
    
    if (percent >= 100) {
      bar.style.stroke = 'var(--color-text-danger, #ef4444)';
    } else if (percent >= 80) {
      bar.style.stroke = 'var(--color-text-warning, #f59e0b)';
    } else {
      bar.style.stroke = '#7c3aed';
    }
  }
  updateMainCircularDashboard();
}

export function loadModelUsage() {
  const saved = localStorage.getItem('vexx_model_usage');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.keys(state.modelUsage).forEach(key => {
        if (parsed[key]) {
          state.modelUsage[key].count = parsed[key].count || 0;
          if (parsed[key].limit) state.modelUsage[key].limit = parsed[key].limit;
        }
      });
    } catch (e) {
      console.error('Error parsing model usage', e);
    }
  }
  Object.keys(state.modelUsage).forEach(updateUsageTracker);
  updateMainCircularDashboard();
}

export function saveModelUsage() {
  localStorage.setItem('vexx_model_usage', JSON.stringify(state.modelUsage));
}

export function resetAllUsage() {
  if (confirm('Deseja zerar os contadores de uso de todas as IAs?')) {
    Object.keys(state.modelUsage).forEach(key => {
      state.modelUsage[key].count = 0;
    });
    saveModelUsage();
    Object.keys(state.modelUsage).forEach(updateUsageTracker);
  }
}

export function updateMainCircularDashboard() {
  let totalCount = 0;
  let totalLimit = 0;
  
  Object.keys(state.modelUsage).forEach(key => {
    totalCount += state.modelUsage[key].count || 0;
    totalLimit += state.modelUsage[key].limit || 30;
  });
  
  const totalCountEl = document.getElementById('total-requests-count');
  const totalLimitEl = document.getElementById('total-requests-limit');
  const mainNumEl = document.getElementById('main-usage-num');
  const mainPctEl = document.getElementById('main-usage-pct');
  const mainBar = document.getElementById('main-usage-bar');
  
  if (totalCountEl) totalCountEl.textContent = totalCount;
  if (totalLimitEl) totalLimitEl.textContent = totalLimit;
  if (mainNumEl) mainNumEl.textContent = totalCount;
  
  const percent = totalLimit > 0 ? Math.min(100, (totalCount / totalLimit) * 100) : 0;
  if (mainPctEl) mainPctEl.textContent = `${Math.round(percent)}%`;
  
  if (mainBar) {
    const offset = 100 - percent;
    mainBar.style.strokeDashoffset = offset;
    
    if (percent >= 90) {
      mainBar.style.stroke = 'var(--color-text-danger, #ef4444)';
    } else if (percent >= 75) {
      mainBar.style.stroke = 'var(--color-text-warning, #f59e0b)';
    } else {
      mainBar.style.stroke = 'var(--accent, #7c3aed)';
    }
  }
}

export function getLongTermMemoryPrompt() {
  if (!state.longTermMemories || state.longTermMemories.length === 0) {
    return '';
  }
  let promptText = '\n\n[MEMÓRIAS DE LONGO PRAZO GRAVADAS]';
  state.longTermMemories.forEach(fact => {
    promptText += `\n- ${fact}`;
  });
  return promptText;
}

export function loadLongTermMemories() {
  const saved = localStorage.getItem('vexx_arena_memories');
  if (saved) {
    try {
      state.longTermMemories = JSON.parse(saved);
    } catch (e) {
      console.error('Error loading memories', e);
      state.longTermMemories = [];
    }
  }
  loadVectorMemories();
  renderMemories();
}

export function saveLongTermMemories() {
  try {
    localStorage.setItem('vexx_arena_memories', JSON.stringify(state.longTermMemories));
  } catch (e) {
    console.error('Error saving memories', e);
  }
}

export function loadVectorMemories() {
  const saved = localStorage.getItem('vexx_vector_memories');
  if (saved) {
    try {
      state.vectorMemories = JSON.parse(saved);
    } catch (e) {
      console.error('Error loading vector memories', e);
      state.vectorMemories = [];
    }
  }
}

export function saveVectorMemories() {
  try {
    localStorage.setItem('vexx_vector_memories', JSON.stringify(state.vectorMemories));
  } catch (e) {
    console.error('Error saving vector memories', e);
  }
}

export function deleteVectorMemory(index) {
  state.vectorMemories.splice(index, 1);
  saveVectorMemories();
  renderMemories();
}

export function clearAllVectorMemories() {
  if (confirm('Deseja limpar todas as memórias vetoriais semânticas?')) {
    state.vectorMemories = [];
    saveVectorMemories();
    renderMemories();
  }
}

export function renderMemories() {
  const listEl = document.getElementById('sidebar-memories-list');
  if (!listEl) return;

  const currentTab = window.activeMemoryTab || 'long';

  if (currentTab === 'long') {
    if (state.longTermMemories.length === 0) {
      listEl.innerHTML = `<div style="font-size: 10px; color: var(--color-text-tertiary); text-align: center; padding: 4px;">Nenhuma memória de longo prazo gravada ainda.</div>`;
      return;
    }

    listEl.innerHTML = '';
    state.longTermMemories.forEach((mem, index) => {
      const item = document.createElement('div');
      item.className = 'memory-item';
      item.innerHTML = `
        <span title="${mem}">${mem}</span>
        <button class="delete-memory-btn" onclick="deleteMemory(${index})" aria-label="Excluir memória">
          <i class="ti ti-x"></i>
        </button>
      `;
      listEl.appendChild(item);
    });
  } else if (currentTab === 'short') {
    const textMsgs = window.chatMessages.filter(m => m.role === 'user' || m.role === 'assistant');
    if (textMsgs.length === 0) {
      listEl.innerHTML = `<div style="font-size: 10px; color: var(--color-text-tertiary); text-align: center; padding: 4px;">Nenhuma conversa recente na sessão.</div>`;
      return;
    }

    listEl.innerHTML = '';
    textMsgs.slice(-5).forEach(m => {
      const item = document.createElement('div');
      item.className = 'memory-item';
      const sender = m.role === 'user' ? 'Você' : m.senderName;
      const snippet = m.text.length > 50 ? m.text.slice(0, 48) + '...' : m.text;
      item.innerHTML = `
        <span title="${m.text}"><strong>${sender}:</strong> ${snippet}</span>
      `;
      listEl.appendChild(item);
    });
  } else if (currentTab === 'vector') {
    if (state.vectorMemories.length === 0) {
      listEl.innerHTML = `<div style="font-size: 10px; color: var(--color-text-tertiary); text-align: center; padding: 4px;">Nenhuma memória semântica gravada ainda.</div>`;
      return;
    }

    listEl.innerHTML = '';
    state.vectorMemories.forEach((mem, index) => {
      const item = document.createElement('div');
      item.className = 'memory-item';
      item.innerHTML = `
        <span title="${mem}">${mem}</span>
        <button class="delete-memory-btn" onclick="deleteVectorMemory(${index})" aria-label="Excluir memória">
          <i class="ti ti-x"></i>
        </button>
      `;
      listEl.appendChild(item);
    });
  }
}

export function deleteMemory(index) {
  state.longTermMemories.splice(index, 1);
  saveLongTermMemories();
  renderMemories();
}

export function clearAllMemories() {
  if (confirm('Deseja limpar todas as memórias gravadas pelas IAs?')) {
    state.longTermMemories = [];
    saveLongTermMemories();
    renderMemories();
  }
}

export function handleModelSelectChange(provider) {
  const selectEl = document.getElementById(`model-${provider}-select`);
  const inputEl = document.getElementById(`model-${provider}`);
  if (!selectEl || !inputEl) return;

  if (selectEl.value === 'custom') {
    inputEl.style.display = 'block';
    inputEl.focus();
  } else {
    inputEl.style.display = 'none';
    inputEl.value = selectEl.value;
  }
  saveKeys();
}

window.systemPaths = null;
export async function loadSystemPaths() {
  try {
    const res = await fetch('/api/terminal/paths');
    if (res.ok) {
      window.systemPaths = await res.json();
      console.log('[System Paths] Loaded paths:', window.systemPaths);
    }
  } catch (e) {
    console.error('Failed to load system paths', e);
  }
}

// Expose functions globally for inline HTML event handlers
window.loadConfig = loadConfig;
window.saveKeys = saveKeys;
window.handleModelSelectChange = handleModelSelectChange;
window.updateProviderStatuses = updateProviderStatuses;
window.resetAllUsage = resetAllUsage;
window.deleteMemory = deleteMemory;
window.clearAllMemories = clearAllMemories;
window.loadSystemPaths = loadSystemPaths;
window.deleteVectorMemory = deleteVectorMemory;
window.clearAllVectorMemories = clearAllVectorMemories;
window.renderMemories = renderMemories;
