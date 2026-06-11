// Logic for general chat debate arena

async function sendArenaMessage() {
  const inputEl = document.getElementById("arena-chat-input");
  const message = inputEl.value ? inputEl.value.trim() : "";
  if (!message) return;

  if (!serverOnline) {
    showToast("Servidor offline.", "danger");
    return;
  }

  inputEl.value = "";
  const chatMessagesDiv = document.getElementById("arena-chat-messages");
  if (!chatMessagesDiv) return;
  
  const welcomeCard = chatMessagesDiv.querySelector(".chat-welcome");
  if (welcomeCard) welcomeCard.remove();

  chatMessagesDiv.innerHTML += `
    <div class="chat-message user">
      <div class="chat-msg-body">${message}</div>
    </div>
  `;
  chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

  const loaderId = "arena-typing-loader";
  chatMessagesDiv.innerHTML += `
    <div class="loader-container" id="${loaderId}" style="padding: 10px; align-self: flex-start; background: var(--color-background-primary); border-radius: var(--border-radius-lg); border: 0.5px solid var(--color-border-tertiary); max-width: 80px; margin-bottom: 8px;">
      <div class="dots-loader" style="margin-bottom:0;">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

  try {
    let systemPrompt = systemPromptOverride;

    // Inject active page context if available
    let pageContextText = "";
    if (typeof pageContext !== "undefined" && pageContext) {
      pageContextText += `\n\n[CONTEXTO ATUAL DA PÁGINA DETECTADA]`;
      pageContextText += `\nTipo de página: ${pageContext.type || "Desconhecido"}`;
      pageContextText += `\nPlataforma: ${pageContext.platform || "Desconhecido"}`;
      if (pageContext.contactUsername) pageContextText += `\nUsername do contato: @${pageContext.contactUsername}`;
      if (pageContext.contactName) pageContextText += `\nNome do contato: ${pageContext.contactName}`;
      if (pageContext.contactBio) pageContextText += `\nBio do contato: "${pageContext.contactBio}"`;
      if (pageContext.followers) pageContextText += `\nSeguidores: ${pageContext.followers}`;
      if (pageContext.engagement) pageContextText += `\nEngajamento/Likes: ${pageContext.engagement}`;
      if (pageContext.sentiment) pageContextText += `\nSentimento geral dos comentários: ${pageContext.sentiment}`;
    }

    // Inject visual audit data if available
    let auditContext = "";
    if (typeof visualAuditManager !== "undefined") {
      if (visualAuditManager.isActive && visualAuditManager.history.length > 0) {
        auditContext += `\n\n[CONTEXTO DE AUDITORIA VISUAL EM ANDAMENTO]\n`;
        visualAuditManager.history.forEach(item => {
          auditContext += `--- Análise da Parte ${item.step} ---\n${item.analysis}\n`;
        });
      } else if (visualAuditManager.lastReport) {
        auditContext += `\n\n[CONTEXTO DA ÚLTIMA AUDITORIA VISUAL CONCLUÍDA]\nRelatório Final da Auditoria:\n${visualAuditManager.lastReport}\n`;
        if (visualAuditManager.lastHistory && visualAuditManager.lastHistory.length > 0) {
          auditContext += `\nObservações Detalhadas por Parte:\n`;
          visualAuditManager.lastHistory.forEach(item => {
            auditContext += `- Parte ${item.step}: ${item.analysis}\n`;
          });
        }
      }
    }

    if (pageContextText || auditContext) {
      systemPrompt += `${pageContextText}${auditContext}`;
    }

    systemPrompt += `

[AUTOMAÇÃO DO BROWSER (RPA)]
Você tem a capacidade de interagir e realizar ações na tela do usuário. Se o usuário pedir para você clicar em algo, pesquisar uma música no Instagram, aplicar filtros/efeitos de cinema, colocar figurinhas de academia ou fazer qualquer edição na tela do Instagram, você deve gerar um bloco de código do tipo "json-automation" com instruções estruturadas em JSON. O interpretador lerá esse bloco e executará a automação na página de forma simulada e precisa.

Formato obrigatório para comandos de tela:
\`\`\`json-automation
[
  { "action": "click", "target": "Nome do botão ou Seletor CSS" },
  { "action": "wait", "delay": 1500 },
  { "action": "type", "target": "seletor ou nome do campo", "value": "Texto a ser digitado" }
]
\`\`\`

Ações suportadas:
1. "click": clica no elemento. O target pode ser um seletor CSS (ex: "div[aria-label='Música']") ou o texto contido/aria-label do elemento de forma flexível (ex: "Música", "Filtros", "Compartilhar", "Avançar", "Adesivos"). O target também pode ser uma coordenada [x, y] normalizada de 0 a 1000 (ex: [500, 250]).
2. "type": foca e digita texto. O target é o elemento e "value" é o texto.
3. "wait": pausa a execução por "delay" milissegundos (default 1200ms). Use sempre após cliques importantes para esperar modais carregarem.
4. "drag_drop": arrasta de uma coordenada "from" (ex: [500, 300]) até "to" (ex: [500, 600]) normalizadas de 0 a 1000. Essencial para mover e ajustar figurinhas ou trechos de música.
5. "upload": abre o uploader de arquivos.

Seja preciso nas instruções de automação para garantir que os botões corretos do Instagram sejam clicados.`;

    let contextMessages = [{ role: "system", content: systemPrompt }];
    
    for (let i = 0; i < selectedAgents.length; i++) {
      const agentId = selectedAgents[i];
      const agent = PROVIDERS[agentId];
      
      let userPrompt = message;
      if (i > 0) {
        let lastSuccessfulResponse = null;
        let lastAgentName = "";
        for (let j = contextMessages.length - 1; j >= 0; j--) {
          if (contextMessages[j].role === "assistant" && !contextMessages[j].failed) {
            lastSuccessfulResponse = contextMessages[j].content;
            lastAgentName = contextMessages[j].agentName || "agente anterior";
            break;
          }
        }
        if (lastSuccessfulResponse) {
          userPrompt = `Minha dúvida inicial foi: "${message}".\nO agente ${lastAgentName} respondeu:\n"${lastSuccessfulResponse}"\n\nAgora debata a ideia dele, aponte melhorias e dê sua resposta complementar.`;
        } else {
          userPrompt = message;
        }
      }

      const currentMessages = [
        ...contextMessages.filter(m => !m.failed).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: userPrompt }
      ];

      const payload = {
        provider: agentId,
        model: agent.model,
        temperature: 0.7,
        messages: currentMessages
      };

      let responseText = "";
      let success = true;

      try {
        responseText = await callChatAPI(payload);
        usageCount++;
        contextMessages.push({ role: "assistant", content: responseText, agentName: agent.name });
      } catch (e) {
        success = false;
        responseText = `Falha ao chamar provedor: ${e.message}`;
        contextMessages.push({ role: "assistant", content: responseText, agentName: agent.name, failed: true });
      }

      const loaderEl = document.getElementById(loaderId);
      if (loaderEl) loaderEl.remove();

      if (success) {
        const formattedBody = formatAssistantResponse(responseText);
        chatMessagesDiv.innerHTML += `
          <div class="chat-message assistant">
            <div class="chat-msg-header">
              <div class="mini-avatar ${agent.bgClass}">${agent.initials}</div>
              <span class="chat-msg-name">${agent.name}</span>
            </div>
            <div class="chat-msg-body">${formattedBody}</div>
          </div>
        `;
      } else {
        chatMessagesDiv.innerHTML += `
          <div class="chat-message assistant" style="border: 0.5px solid var(--color-text-danger); background-color: var(--color-background-danger);">
            <div class="chat-msg-header" style="color: var(--color-text-danger);">
              <div class="mini-avatar ${agent.bgClass}">${agent.initials}</div>
              <span class="chat-msg-name">${agent.name} (Falha)</span>
            </div>
            <div class="chat-msg-body" style="color: var(--color-text-danger); font-style: italic;">${responseText}</div>
          </div>
        `;
      }
      
      if (i < selectedAgents.length - 1) {
        chatMessagesDiv.innerHTML += `
          <div class="loader-container" id="${loaderId}" style="padding: 10px; align-self: flex-start; background: var(--color-background-primary); border-radius: var(--border-radius-lg); border: 0.5px solid var(--color-border-tertiary); max-width: 80px; margin-bottom: 8px;">
            <div class="dots-loader" style="margin-bottom:0;">
              <span></span><span></span><span></span>
            </div>
          </div>
        `;
      }

      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }
    
    saveSettingsLocally();
    updateUsageDashboard();

  } catch (err) {
    const loaderEl = document.getElementById(loaderId);
    if (loaderEl) loaderEl.remove();
    showToast("Erro na arena: " + err.message, "danger");
  }
}

// Formata a resposta da IA para exibir cartões interativos de automação
function formatAssistantResponse(text) {
  const regex = /```json-automation([\s\S]*?)```/g;
  let match;
  let formattedText = text;
  let automationCards = "";

  while ((match = regex.exec(text)) !== null) {
    try {
      const steps = JSON.parse(match[1].trim());
      const encodedSteps = encodeURIComponent(JSON.stringify(steps));
      
      const cardHtml = `
        <div class="automation-card" style="margin-top: 10px; padding: 12px; background: rgba(167, 139, 250, 0.08); border: 0.5px solid var(--color-accent-amethyst); border-radius: 8px; display: flex; flex-direction: column; gap: 8px; text-align: left;">
          <div style="font-size: 11px; color: var(--color-accent-amethyst); font-weight: bold; display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-cpu"></i> Automação Vexx Bot Detectada
          </div>
          <p style="font-size: 10px; color: var(--color-text-secondary); margin: 0; line-height: 1.4;">
            Esta IA sugeriu as seguintes ações automatizadas para rodar na sua tela:
          </p>
          <div style="max-height: 100px; overflow-y: auto; background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: 6px; padding: 6px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--color-text-secondary);">
            ${steps.map((s, idx) => {
              let detail = "";
              if (s.action === "click") detail = `clicar em "${s.target}"`;
              else if (s.action === "type") detail = `digitar "${s.value}" em "${s.target}"`;
              else if (s.action === "wait") detail = `esperar ${s.delay || 1200}ms`;
              else if (s.action === "drag_drop") detail = `arrastar de [${s.from}] para [${s.to}]`;
              else if (s.action === "upload") detail = `abrir upload de arquivo`;
              return `${idx + 1}. [${s.action.toUpperCase()}] ${detail}`;
            }).join('<br>')}
          </div>
          <button class="btn-primary btn-run-automation" data-steps="${encodedSteps}" style="height: 28px; font-size: 11px; justify-content: center; width: 100%; cursor: pointer;">
            <i class="ti ti-play" style="margin-right: 4px;"></i> Executar Ações na Tela
          </button>
        </div>
      `;
      
      automationCards += cardHtml;
      formattedText = formattedText.replace(match[0], "");
    } catch (e) {
      console.error("Failed to parse json-automation block", e);
    }
  }

  // Convert newlines to HTML br for rendering
  return formattedText.replace(/\n/g, "<br>") + automationCards;
}

// Configura o ouvinte de cliques para executar automações na Arena
function setupAutomationClickListener() {
  const chatMessagesDiv = document.getElementById("arena-chat-messages");
  if (chatMessagesDiv) {
    chatMessagesDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-run-automation");
      if (!btn) return;
      
      const encodedSteps = btn.dataset.steps;
      if (!encodedSteps) return;
      
      try {
        const steps = JSON.parse(decodeURIComponent(encodedSteps));
        showToast("Iniciando automação na página...", "info");
        btn.disabled = true;
        btn.innerHTML = `<i class="ti ti-loader" style="display: inline-block; animation: spin 1.5s linear infinite;"></i> Executando...`;
        
        window.parent.postMessage({
          source: "vexx-sidebar",
          action: "EXECUTE_AUTOMATION",
          payload: { steps: steps }
        }, "*");
      } catch (err) {
        showToast("Erro ao decodificar passos: " + err.message, "danger");
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupAutomationClickListener);
} else {
  setupAutomationClickListener();
}
