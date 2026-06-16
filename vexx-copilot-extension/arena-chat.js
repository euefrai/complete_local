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
      pageContextText += `\nURL: ${pageContext.url || "Desconhecido"}`;
      pageContextText += `\nTítulo: ${pageContext.contactName || document.title || "Desconhecido"}`;
      
      if (pageContext.userActivity) {
        pageContextText += `\nAtividade do Usuário: ${pageContext.userActivity}`;
      }
      
      if (pageContext.contactUsername) pageContextText += `\nUsername do contato: @${pageContext.contactUsername}`;
      if (pageContext.contactBio) pageContextText += `\nBio do contato: "${pageContext.contactBio}"`;
      if (pageContext.followers) pageContextText += `\nSeguidores: ${pageContext.followers}`;
      if (pageContext.engagement) pageContextText += `\nEngajamento/Likes: ${pageContext.engagement}`;
      if (pageContext.sentiment) pageContextText += `\nSentimento geral dos comentários: ${pageContext.sentiment}`;

      // Injeta informações do Workspace Ativo
      if (typeof workspaceProject !== "undefined") {
        pageContextText += `\n\n[WORKSPACE DO USUÁRIO]`;
        pageContextText += `\nProjeto Ativo: ${workspaceProject}`;
        if (typeof projectGoals !== "undefined" && projectGoals.length > 0) {
          const goalsList = projectGoals.map(g => `- [${g.done ? "x" : " "}] ${g.text}`).join("\n");
          pageContextText += `\nObjetivos/Tarefas Atuais:\n${goalsList}`;
        }
      }

      // Injeta Engenharia Reversa
      if (pageContext.reverseEngineering) {
        const rev = pageContext.reverseEngineering;
        pageContextText += `\n\n[ENGENHARIA REVERSA DA PÁGINA]`;
        pageContextText += `\nFramework Principal: ${rev.framework || "Desconhecido"}`;
        pageContextText += `\nBibliotecas: ${(rev.libraries || []).join(", ") || "Nenhuma detectada"}`;
        pageContextText += `\nAPIs: ${(rev.apis || []).join(", ") || "Nenhuma detectada"}`;
        pageContextText += `\nArquitetura: ${rev.architecture || "Desconhecido"}`;
        pageContextText += `\nBanco de Dados Provável: ${rev.database || "Não Identificado"}`;
      }

      // Injeta DOM Intelligence
      if (pageContext.domIntelligence) {
        const dom = pageContext.domIntelligence;
        pageContextText += `\n\n[INTELIGÊNCIA DO DOM (ELEMENTOS E COORDENADAS)]`;
        pageContextText += `\n- Formulários: ${dom.forms?.length || 0}`;
        if (dom.forms && dom.forms.length > 0) {
          dom.forms.forEach((f, i) => {
            pageContextText += `\n  * Form #${i+1} (ID: ${f.id}): Campos: ${f.fields?.join(", ") || "nenhum"}`;
          });
        }
        pageContextText += `\n- Inputs/Textareas: ${dom.inputs?.length || 0}`;
        if (dom.inputs && dom.inputs.length > 0) {
          dom.inputs.forEach((inp, i) => {
            pageContextText += `\n  * Input: Label: "${inp.label}", Placeholder: "${inp.placeholder}", Tipo: "${inp.type}", Coordenadas: [${inp.coords?.join(",") || ""}]`;
          });
        }
        pageContextText += `\n- Botões Mapeados: ${dom.buttons?.length || 0}`;
        if (dom.buttons && dom.buttons.length > 0) {
          dom.buttons.forEach((btn, i) => {
            pageContextText += `\n  * Botão: Text: "${btn.text}", ID: "${btn.id}", Coordenadas: [${btn.coords?.join(",") || ""}]`;
          });
        }
        pageContextText += `\n- Links Mapeados: ${dom.links?.length || 0}`;
        pageContextText += `\n- Tabelas Mapeadas: ${dom.tables?.length || 0}`;
        pageContextText += `\n- Modais Ativos: ${dom.modals?.length || 0}`;
        if (dom.modals && dom.modals.length > 0) {
          dom.modals.forEach((m, i) => {
            pageContextText += `\n  * Modal Ativo: "${m.title}", Coordenadas: [${m.coords?.join(",") || ""}]`;
          });
        }
        pageContextText += `\n- Gráficos Mapeados: ${dom.charts?.length || 0}`;
      }

      // Injeta trecho do conteúdo visível
      if (pageContext.visibleText) {
        pageContextText += `\n\n[CONTEÚDO TEXTUAL VISÍVEL (EXEMPLO)]\n${pageContext.visibleText.substring(0, 1500)}`;
      }
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

    // Inject Social Memory if available (Camada 6: Social Media OS)
    let socialMemoryContext = "";
    if (typeof window !== "undefined" && window.socialMemory) {
      const sm = window.socialMemory;
      socialMemoryContext += `\n\n[MEMÓRIA SOCIAL DA CONTA / BRANDING]`;
      if (sm.niche) socialMemoryContext += `\nNicho: ${sm.niche}`;
      if (sm.audience) socialMemoryContext += `\nPúblico Alvo: ${sm.audience}`;
      if (sm.writing_style) socialMemoryContext += `\nEstilo de Escrita: ${sm.writing_style}`;
      if (sm.past_learnings && sm.past_learnings.length > 0) {
        socialMemoryContext += `\nAprendizados e Otimizações Anteriores:\n` + sm.past_learnings.map(l => `- ${l}`).join('\n');
      }
    }

    if (pageContextText || auditContext || socialMemoryContext) {
      systemPrompt += `${pageContextText}${auditContext}${socialMemoryContext}`;
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

    const chkGroupDebate = document.getElementById("chk-group-debate");
    const isGroupDebateMode = chkGroupDebate && chkGroupDebate.checked;

    const agentsToRun = isGroupDebateMode ? [
      { id: "groq", name: "Gregório (Programador)", initials: "DV", bgClass: "success-bg", model: "llama-3.3-70b-versatile", persona: "Você é o Programador (Dev) do grupo. Analise a tecnologia do site, frameworks, integrações de APIs, banco de dados e sugira melhorias no código." },
      { id: "claude", name: "Clara (Designer)", initials: "DS", bgClass: "info-bg", model: "claude-sonnet-4-20250514", persona: "Você é a Designer (UI/UX) do grupo. Avalie a usabilidade, branding, design visual, layout e clareza das CTAs na tela." },
      { id: "openai", name: "Olavo (Marketing)", initials: "MK", bgClass: "warning-bg", model: "gpt-4o-mini", persona: "Você é o especialista de Marketing e Copywriter do grupo. Avalie e otimize a copy, títulos, proposta de valor e conversão." },
      { id: "huggingface", name: "Hugo (Analista)", initials: "AN", bgClass: "purple-bg", model: "Qwen/Qwen2.5-72B-Instruct", persona: "Você é o Analista de Negócios e QA. Aponte falhas operacionais, furos nas regras de negócio, riscos e vulnerabilidades." },
      { id: "gemini", name: "Gael (Assistente Principal)", initials: "AP", bgClass: "info-bg", model: "gemini-2.5-flash", persona: "Você é o Assistente Principal do grupo. Leia as respostas de todos os especialistas anteriores, crie uma síntese coerente e entregue o plano de ação final detalhado em Markdown." }
    ] : selectedAgents.map(id => ({
      id: id,
      name: PROVIDERS[id] ? PROVIDERS[id].name : id,
      initials: PROVIDERS[id] ? PROVIDERS[id].initials : id.substring(0, 2).toUpperCase(),
      bgClass: PROVIDERS[id] ? PROVIDERS[id].bgClass : "neutral-bg",
      model: PROVIDERS[id] ? PROVIDERS[id].model : "gemini-2.5-flash",
      persona: ""
    }));

    let contextMessages = [{ role: "system", content: systemPrompt }];
    
    for (let i = 0; i < agentsToRun.length; i++) {
      const agent = agentsToRun[i];
      const agentId = agent.id;
      
      let userPrompt = message;
      let agentSystemPrompt = systemPrompt;
      
      if (isGroupDebateMode) {
        agentSystemPrompt = `${systemPrompt}\n\n[DIRETRIZ DE ESPECIALISTA]\n${agent.persona}\nLembre-se: aja exatamente como esse papel.`;
        
        if (i > 0) {
          let debHistory = "\n\n[DEBATE ATÉ O MOMENTO]\n";
          for (let j = 0; j < i; j++) {
            const prevAgent = agentsToRun[j];
            const prevResponse = contextMessages.find(m => m.agentName === prevAgent.name && !m.failed)?.content || "";
            if (prevResponse) {
              debHistory += `--- Especialista ${prevAgent.name} respondeu: ---\n${prevResponse}\n\n`;
            }
          }
          userPrompt = `Minha dúvida inicial foi: "${message}".\n${debHistory}\nAgora debata e contribua do ponto de vista de sua especialidade. Aponte concordâncias, discorde de forma construtiva e proponha melhorias concretas.`;
        }
      } else {
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
          }
        }
      }

      const currentMessages = [
        { role: "system", content: agentSystemPrompt },
        ...contextMessages.filter(m => m.role !== "system" && !m.failed).map(m => ({ role: m.role, content: m.content })),
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
      
      if (i < agentsToRun.length - 1) {
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
