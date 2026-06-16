// Vexx AI Copilot — Background Service Worker

let workspaceTabs = [];
let workspaceProject = "Desenvolvimento do App Fitness";
let sessionReplay = [];
let errorLogs = [];
let siteIntelCache = {};

// Carrega o projeto salvo ao inicializar
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(["vexx_workspace_project"], (res) => {
    if (res && res.vexx_workspace_project) {
      workspaceProject = res.vexx_workspace_project;
    }
  });
}

// Injeta dinamicamente os scripts em todas as abas abertas compatíveis após instalação/recarregamento
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.query({ url: ["http://*/*", "https://*/*", "file://*/*"] }, (tabs) => {
      if (!tabs) return;
      tabs.forEach(tab => {
        if (!tab.id || !tab.url) return;
        if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("https://chrome.google.com")) {
          return;
        }
        
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["context-engine.js"]
        }).then(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          }).catch(err => console.warn(`Falha ao injetar content.js na aba ${tab.id}:`, err));
        }).catch(err => console.warn(`Falha ao injetar context-engine.js na aba ${tab.id}:`, err));
      });
    });
  });
}

// Auxiliar para chamar a API de Chat diretamente do Service Worker
function callChatAPIDirectly(payload) {
  return fetch("http://127.0.0.1:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error("Erro no servidor local");
    return res.json();
  })
  .then(data => {
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    throw new Error("Formato inválido na resposta do servidor");
  });
}

function updateWorkspaceTabs() {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) return;
  chrome.tabs.query({}, (tabs) => {
    workspaceTabs = tabs.map(t => {
      let platform = "web";
      const url = t.url || "";
      if (url.includes("github.com")) platform = "github";
      else if (url.includes("figma.com")) platform = "figma";
      else if (url.includes("canva.com")) platform = "canva";
      else if (url.includes("supabase.com") || url.includes("supabase.co")) platform = "supabase";
      else if (url.includes("firebase.google.com") || url.includes("firebaseio.com")) platform = "firebase";
      else if (url.includes("youtube.com")) platform = "youtube";
      else if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) platform = "chatgpt";
      else if (url.includes("whatsapp.com")) platform = "whatsapp";
      else if (url.includes("instagram.com")) platform = "instagram";
      
      return {
        id: t.id,
        title: t.title || "Aba sem título",
        url: url,
        platform: platform,
        favIconUrl: t.favIconUrl || ""
      };
    }).filter(t => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("chrome-extension://"));
  });
}

if (typeof chrome !== "undefined" && chrome.tabs) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" || changeInfo.url) {
      updateWorkspaceTabs();
    }
  });
  chrome.tabs.onActivated.addListener(() => {
    updateWorkspaceTabs();
  });
  chrome.tabs.onRemoved.addListener(() => {
    updateWorkspaceTabs();
  });
  
  // Executa após iniciar
  setTimeout(updateWorkspaceTabs, 1500);
}

// Escuta mensagens vindas do content script ou da sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CAPTURE_SCREENSHOT") {
    chrome.tabs.captureVisibleTab(null, { format: 'png' })
      .then(dataUrl => {
        sendResponse({ success: true, dataUrl: dataUrl });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "HEALTH_CHECK") {
    fetch("http://127.0.0.1:3000/api/health")
      .then(response => {
        if (!response.ok) throw new Error("Server response not OK");
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "GET_PROVIDERS") {
    fetch("http://127.0.0.1:3000/api/chat/providers")
      .then(response => {
        if (!response.ok) throw new Error("Server response not OK");
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "CHAT_REQUEST") {
    const { provider, model, messages, temperature, max_tokens } = request.payload;

    fetch("http://127.0.0.1:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        provider: provider,
        model: model,
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2048
      })
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errData => {
            throw new Error(errData.error || errData.details || "Erro desconhecido no servidor local");
          });
        }
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "GENERATE_IMAGE") {
    const { prompt } = request.payload;
    fetch(`http://127.0.0.1:3000/api/generate-image?prompt=${encodeURIComponent(prompt)}`)
      .then(response => {
        if (!response.ok) throw new Error("Erro ao gerar imagem no servidor local.");
        return response.arrayBuffer();
      })
      .then(buffer => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        sendResponse({ success: true, dataUrl: `data:image/webp;base64,${base64}` });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "TRANSCRIBE_AUDIO") {
    const { audio, mimeType } = request.payload;
    fetch("http://127.0.0.1:3000/api/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        audio: audio,
        mimeType: mimeType || "audio/webm"
      })
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errData => {
            throw new Error(errData.error || "Erro na transcrição");
          });
        }
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, text: data.text || data.transcription || "" });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "GET_WORKSPACE_STATE") {
    sendResponse({
      project: workspaceProject,
      tabs: workspaceTabs,
      sessionReplay: sessionReplay,
      errorLogs: errorLogs
    });
    return false;
  }

  if (request.action === "SET_WORKSPACE_PROJECT") {
    workspaceProject = request.payload.project;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ "vexx_workspace_project": workspaceProject });
    }
    sendResponse({ success: true });
    return false;
  }

  if (request.action === "LOG_USER_ACTION") {
    const { actionText, url } = request.payload;
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    sessionReplay.push({
      timestamp: timestamp,
      text: actionText,
      url: url
    });
    if (sessionReplay.length > 20) sessionReplay.shift();
    sendResponse({ success: true });
    return false;
  }

  if (request.action === "LOG_ERROR") {
    const { message, stack, url, type } = request.payload;
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    errorLogs.push({
      timestamp: timestamp,
      message: message,
      stack: stack || "",
      url: url,
      type: type || "JS"
    });
    if (errorLogs.length > 10) errorLogs.shift();
    
    // Broadcast notification to all extension sidebars/views if needed
    sendResponse({ success: true });
    return false;
  }

  if (request.action === "RESOLVE_SITE_INTELLIGENCE") {
    const { domain, url, title, visibleText, reverseEngineering } = request.payload;
    if (siteIntelCache[domain]) {
      sendResponse({ success: true, data: siteIntelCache[domain] });
      return false;
    }
    
    const prompt = `Você é o Vexx Site Intelligence Engine. Analise a página web e gere informações estruturadas de inteligência.
URL: ${url}
Título: ${title}
Framework/Tech Detectadas: ${JSON.stringify(reverseEngineering)}
Exemplo de texto visível na página: ${visibleText.substring(0, 1500)}

Você deve responder APENAS com um objeto JSON válido. Não inclua blocos de código markdown como \`\`\`json ou explicações antes/depois.

IMPORTANTE: Mantenha todos os campos de texto (resumos, objetivos, explicações) extremamente curtos e objetivos (máximo de 1 a 2 frases por campo) para evitar cortes de limites de tamanho.

Estrutura do JSON:
{
  "siteName": "Nome amigável do site (ex: GitHub, Figma, Supabase, YouTube, ou o nome da empresa/serviço)",
  "category": "Categoria da plataforma (ex: Desenvolvimento de Código, Design de Interfaces, Banco de Dados Relacional, Hospedagem de Vídeos, Portal de Notícias, etc.)",
  "objective": "Objetivo principal da plataforma",
  "technologies": ["Lista de tecnologias detectadas ou prováveis"],
  "targetAudience": "Público-alvo principal",
  "features": ["3 a 5 funcionalidades principais da página"],
  "risks": ["1 a 3 riscos ou desvantagens potenciais para o usuário/desenvolvedor"],
  "shortSummary": "Resumo curto (1 frase)",
  "mediumSummary": "Resumo médio (1 parágrafo)",
  "fullSummary": "Resumo completo (detalhado)",
  "whatIs": "O que é este site/sistema (explicação concisa e resumida)",
  "whatIsFor": "Para que serve (finalidade comercial ou de desenvolvimento principal)",
  "whoUsesIt": "Quem utiliza (tipo de profissional ou público de destino)",
  "howItWorks": "Como funciona (mecanismo operacional básico ou fluxo principal)",
  "knowledgeMap": {
    "modules": ["Módulos principais identificados ou sugeridos do sistema (ex: Dashboard, Cadastro, Relatórios, Configurações)"],
    "flows": ["Fluxos de usuário cruciais (ex: Login > Criar Workspace > Conectar Banco)"],
    "dependencies": ["Bibliotecas e dependências de arquitetura prováveis ou observadas"]
  },
  "reverseEngineering": {
    "framework": "Framework principal (React, Vue, Next.js, Angular, jQuery, Svelte, Django, Laravel, ou Custom HTML/JS)",
    "libraries": ["Bibliotecas CSS/JS detectadas ou prováveis"],
    "architecture": "Arquitetura da aplicação (SPA, SSR, Monolith, Serverless, Jamstack)",
    "apis": ["APIs prováveis"],
    "database": "Banco de dados provável (PostgreSQL, MongoDB, Firebase Firestore, MySQL, Redis, etc.)"
  }
}`;

    callChatAPIDirectly({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
    .then(text => {
      const safeSend = (data) => {
        try {
          sendResponse(data);
        } catch (e) {
          console.warn("Could not send response, port might be closed:", e.message);
        }
      };

      try {
        let cleanText = text.trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanText = jsonMatch[0];
        } else {
          if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7);
          else if (cleanText.startsWith("```")) cleanText = cleanText.substring(3);
          if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        
        let parsed;
        try {
          parsed = JSON.parse(cleanText.trim());
        } catch (initialErr) {
          console.warn("[Vexx Background] Initial JSON parse failed, trying to repair:", initialErr.message);
          try {
            const repairedText = repairTruncatedJSON(cleanText.trim());
            parsed = JSON.parse(repairedText);
          } catch (repairErr) {
            // If repair also fails, throw the original error
            throw new Error(initialErr.message + " (Repair also failed: " + repairErr.message + ")");
          }
        }
        siteIntelCache[domain] = parsed;
        safeSend({ success: true, data: parsed });
      } catch (err) {
        console.error("[Vexx Background] Failed to parse Site Intel JSON:", text, err);
        safeSend({ success: false, error: "Failed to parse JSON: " + err.message });
      }
    })
    .catch(err => {
      try {
        sendResponse({ success: false, error: err.message });
      } catch (e) {}
    });
    return true; // async
  }
});

// Ouvinte para atalhos globais nativos definidos no manifest
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-sidebar") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "TOGGLE_SIDEBAR_FROM_HOTKEY" }, (response) => {
          if (chrome.runtime.lastError) {
            // Silencia erro se a aba ativa não tiver script ou não suportar injeção (ex: chrome://)
          }
        });
      }
    });
  }
});

// Helper function to repair truncated JSON strings by closing unclosed brackets/braces/quotes
function repairTruncatedJSON(jsonString) {
  jsonString = jsonString.trim();
  if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
    return jsonString;
  }

  let current = jsonString;
  const maxIterations = 1000;
  let iterations = 0;

  while (current.length > 0 && iterations < maxIterations) {
    iterations++;
    let inString = false;
    let escape = false;
    const stack = [];

    for (let i = 0; i < current.length; i++) {
      const char = current[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char === '{' ? '}' : ']');
        } else if (char === '}' || char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
    }

    let candidate = current;
    if (inString) {
      candidate += '"';
    } else {
      candidate = candidate.replace(/,\s*$/, '');
    }

    for (let i = stack.length - 1; i >= 0; i--) {
      candidate += stack[i];
    }

    try {
      JSON.parse(candidate);
      return candidate;
    } catch (e) {
      current = current.slice(0, -1);
    }
  }

  return jsonString;
}
