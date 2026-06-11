// State and configuration constants
const PROVIDERS = {
  gemini: { name: 'Gael', initials: 'GE', bgClass: 'info-bg', model: 'gemini-2.5-flash' },
  gemini2: { name: 'Gabriela', initials: 'G2', bgClass: 'info-bg', model: 'gemini-2.5-flash' },
  groq: { name: 'Gregório', initials: 'GR', bgClass: 'success-bg', model: 'llama-3.3-70b-versatile' },
  openrouter: { name: 'Orlando', initials: 'OR', bgClass: 'neutral-bg', model: 'openrouter/free' },
  openai: { name: 'Olavo', initials: 'OA', bgClass: 'warning-bg', model: 'gpt-4o-mini' },
  openai2: { name: 'Otávio', initials: 'O2', bgClass: 'warning-bg', model: 'gpt-4o-mini' },
  huggingface: { name: 'Hugo', initials: 'HF', bgClass: 'purple-bg', model: 'Qwen/Qwen2.5-72B-Instruct' },
  huggingface2: { name: 'Heitor', initials: 'H2', bgClass: 'purple-bg', model: 'meta-llama/Llama-3.3-70B-Instruct' },
  huggingface3: { name: 'Helena', initials: 'H3', bgClass: 'purple-bg', model: 'Qwen/Qwen2.5-72B-Instruct' },
  cohere: { name: 'Júlia', initials: 'JU', bgClass: 'purple-bg', model: 'command-a-03-2025' },
  claude: { name: 'Clara', initials: 'CL', bgClass: 'info-bg', model: 'claude-sonnet-4-20250514' },
  cerebras: { name: 'Cecília', initials: 'CE', bgClass: 'success-bg', model: 'gpt-oss-120b' }
};

const DEFAULT_SYSTEM_PROMPT = `Você é o VEXX Copilot, um agente inteligente integrado ao ecossistema VEXX (wifa jl OS).
Seu objetivo é ajudar o usuário a responder da melhor forma possível no WhatsApp ou Instagram, atuando como um copilot de conversão de vendas, contorno de objeções e suporte.

Diretrizes:
- Escreva respostas em português brasileiro nativo, espontâneas, fluidas e profissionais.
- Não use emojis em excesso.
- Seja objetivo e conciso. Não estenda o texto a menos que seja estritamente necessário.
- Adapte-se ao contexto do histórico da conversa.
- IMPORTANTE: Você está gerando a resposta que o USUÁRIO (Você) vai enviar para o CONTATO. NUNCA chame o contato pelos nomes/apelidos do próprio usuário (ex: Efraim, Efrain, Fai, etc.). Se for usar o nome do contato, use o nome/username do contato (ex: se o contato é jfelixns, chame-o de jfelixns ou pelo primeiro nome/apelido dele se aplicável, ex: Felix).`;

// Global state variables
let isArenaMode = false;
let selectedAgents = ['claude']; // Solo default
let activeTab = 'copilot';
let pageContext = null;
let serverOnline = false;
let configuredProviders = {};
let usageCount = 0;
let usageLimit = 150;
let systemPromptOverride = DEFAULT_SYSTEM_PROMPT;
let healthCheckIntervalId = null;

// Local storage settings helpers
async function loadSavedSettings() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      const data = await chrome.storage.local.get(['isArenaMode', 'selectedAgents', 'usageCount', 'systemPromptOverride']);
      if (data.isArenaMode !== undefined) isArenaMode = data.isArenaMode;
      if (data.selectedAgents !== undefined) selectedAgents = data.selectedAgents;
      if (data.usageCount !== undefined) usageCount = data.usageCount;
      if (data.systemPromptOverride !== undefined) systemPromptOverride = data.systemPromptOverride;
    } catch (e) {
      console.warn("loadSavedSettings failed:", e.message);
    }
  }
  
  updateModeButtons();
  const promptTextarea = document.getElementById("system-prompt-override");
  if (promptTextarea) promptTextarea.value = systemPromptOverride;
  updateUsageDashboard();
}

async function saveSettingsLocally() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({
        isArenaMode: isArenaMode,
        selectedAgents: selectedAgents,
        usageCount: usageCount,
        systemPromptOverride: systemPromptOverride
      });
    } catch (e) {
      console.warn("saveSettingsLocally failed:", e.message);
    }
  }
}
