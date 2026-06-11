// Logic for contextual response generation (Solo / Arena synthesis)

async function generateReplies() {
  if (!serverOnline) {
    showToast("Servidor local wifa jl OS desconectado. Por favor, inicie o aplicativo desktop na porta 3000.", "danger");
    return;
  }

  if (!pageContext || !pageContext.messages || pageContext.messages.length === 0) {
    showToast("Nenhum contexto de mensagens encontrado na tela atual para analisar.", "warning");
    return;
  }

  const loader = document.getElementById("copilot-loader");
  const resultsDiv = document.getElementById("copilot-results");
  const btnText = document.getElementById("btn-generate-text");

  if (loader) loader.classList.remove("hidden");
  if (resultsDiv) resultsDiv.innerHTML = "";
  if (btnText) btnText.textContent = "Analisando...";

  try {
    const tone = document.getElementById("tone-select").value;
    const customPromptVal = document.getElementById("custom-prompt-input").value;
    
    let toneInstruction = "";
    if (tone === "friendly") {
      toneInstruction = "Adote um tom extremamente amigável, acolhedor e próximo. Use linguagem simples, natural, focada em construir rapport e simpatia.";
    } else if (tone === "professional") {
      toneInstruction = "Adote um tom altamente profissional, sério, técnico e prestativo. Transmita autoridade técnica e segurança institucional.";
    } else if (tone === "closing") {
      toneInstruction = "Adote um tom focado em fechamento de venda. Seja persuasivo, direto, responda a objeções de forma inteligente e induza o cliente ao próximo passo (ex: link de pagamento, fechar pedido).";
    } else if (tone === "support") {
      toneInstruction = "Adote um tom de suporte resolutivo. Seja extremamente paciente, didático, focado em solucionar as dúvidas do cliente rapidamente de forma objetiva.";
    } else if (tone === "custom" && customPromptVal) {
      toneInstruction = `Instrução especial de estilo/objetivo: ${customPromptVal}`;
    }

    let chatHistory = "HISTÓRICO DA CONVERSA ATIVA:\n";
    pageContext.messages.forEach(m => {
      chatHistory += `[${m.senderName}] (${m.time || 'Sem horário'}): ${m.text}\n`;
    });

    let systemPrompt = `${systemPromptOverride}\n\n[INSTRUÇÃO DE ESTILO E TOM]\n${toneInstruction}`;

    // Enriquece com dados do perfil se disponíveis
    let profileContext = "";
    if (pageContext.contactUsername) {
      profileContext += `\nUsername do contato: @${pageContext.contactUsername}`;
    }
    if (pageContext.contactBio) {
      profileContext += `\nBio do perfil do contato: "${pageContext.contactBio}"`;
    }

    // Consulta histórico persistente na memória (Fase 3)
    let memoryPromptContext = "";
    if (pageContext.contactUsername && typeof MemoryStore !== "undefined") {
      try {
        const history = await MemoryStore.getProfileHistory(pageContext.contactUsername);
        if (history && history.interactions && history.interactions.length > 0) {
          memoryPromptContext = `\n\n[HISTÓRICO DE INTERAÇÕES ANTERIORES DO VEXX MEMORY]\nVocê já interagiu com este contato antes. Aqui estão os resumos das últimas interações:\n`;
          history.interactions.slice(-5).forEach(i => {
            memoryPromptContext += `- Data: ${new Date(i.date).toLocaleDateString("pt-BR")}, Tom: ${i.tone}, Resumo da Resposta: "${i.summary || i.aiResponse.substring(0, 100)}..."\n`;
          });
          memoryPromptContext += `Use esse contexto para manter consistência de tom, assuntos abordados anteriormente e evitar repetir respostas idênticas.`;
        }
      } catch (e) {
        console.warn("Erro ao buscar histórico da memória:", e);
      }
    }

    let userPrompt = `${chatHistory}${profileContext}${memoryPromptContext}\n\nCom base no histórico acima, elabore a melhor resposta a ser enviada agora.`;

    const isChatContext = pageContext.type === "instagram" || pageContext.type === "whatsapp";
    
    if (!isChatContext && pageContext.platform === "instagram") {
      if (pageContext.type === "creation") {
        systemPrompt = `${systemPromptOverride}\n\nVocê é o Diretor Criativo VEXX. Gere ideias de tendências musicais, roteiros para Stories/Reels e 1 prompt detalhado de imagem para IA.`;
        userPrompt = `O usuário do wifa jl OS está criando um post/story/reel no Instagram agora. 
Formule um plano criativo contendo:
1. Três sugestões de músicas/áudios em alta recomendados para combinar com a estética de tecnologia e design premium.
2. Dois roteiros curtos com ganchos persuasivos para Stories com foco em atração de leads.
3. Um prompt detalhado de imagem (em inglês) para geração por IA. Formate a linha do prompt exatamente assim:
[PROMPT] "Notebook moderno flutuando..."`;
      } 
      else if (pageContext.type === "profile") {
        systemPrompt = `${systemPromptOverride}\n\nVocê é o VEXX Copilot, especialista em Prospecção Comercial.`;
        userPrompt = `O usuário está visualizando o perfil de @${pageContext.username} no Instagram.
A Biografia do perfil é: "${pageContext.bio}"
Formule:
1. Uma breve estratégia de dor/nicho personalizada para esse perfil.
2. Duas abordagens prontas de mensagens na DM (scripts frios) para iniciar o contato comercial de prospecção da VEXX, de forma natural, profissional e objetiva, visando agendar um papo rápido.`;
      }
      else if (pageContext.type === "explore") {
        systemPrompt = `${systemPromptOverride}\n\nVocê é o VEXX Copilot, consultor de tendências de marketing.`;
        userPrompt = `O usuário está navegando pela aba Explorar buscando referências.
Sugira 3 ideias de conteúdo rápido (Reels de texto/imagem de fundo roxo) que tenham grande potencial de viralização no nicho de tecnologia, inteligência artificial e startups.`;
      }
      else if (pageContext.type === "feed") {
        systemPrompt = `${systemPromptOverride}\n\nVocê é o VEXX Copilot, analista de engajamento social.`;
        userPrompt = `O usuário está na página inicial (Feed) do Instagram.
Forneça 3 táticas rápidas de engajamento diário de branding (ex: que perguntas responder nos stories hoje, que tipo de post de terceiros comentar para capturar autoridade).`;
      }
      else if (pageContext.type === "post") {
        systemPrompt = `${systemPromptOverride}\n\nVocê é o VEXX Copilot, analista de engajamento em publicações.`;
        userPrompt = `O usuário está analisando um post no Instagram.
Legenda e Comentários do Post:\n${chatHistory}\n
Formule:
1. Um comentário estratégico e marcante para o usuário escrever neste post visando atrair atenção para o seu próprio perfil (autoridade).
2. Uma análise breve (1-2 linhas) do tom predominante do público desse post.`;
      }
    }

    if (!isArenaMode) {
      const activeAgentId = selectedAgents[0] || 'claude';
      const agent = PROVIDERS[activeAgentId];
      
      const loaderStatus = document.getElementById("loader-status");
      if (loaderStatus) loaderStatus.textContent = `${agent.name} formulando insights...`;

      const payload = {
        provider: activeAgentId,
        model: agent.model,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      };

      const result = await callChatAPI(payload);
      usageCount++;
      saveSettingsLocally();
      updateUsageDashboard();

      if (resultsDiv) resultsDiv.innerHTML = renderResponseCard(agent, result);

      // Salva a interação gerada na memória (Fase 3)
      if (typeof MemoryStore !== "undefined" && pageContext.contactUsername) {
        MemoryStore.saveInteraction(pageContext.contactUsername, {
          tone: tone,
          prompt: customPromptVal || "Geração Solo",
          aiResponse: result
        });
      }
    } else {
      const debatePromises = selectedAgents.map(async (agentId) => {
        const agent = PROVIDERS[agentId];
        const payload = {
          provider: agentId,
          model: agent.model,
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        };
        try {
          const resText = await callChatAPI(payload);
          return { agent, success: true, text: resText };
        } catch (e) {
          return { agent, success: false, error: e.message };
        }
      });

      const loaderStatus = document.getElementById("loader-status");
      if (loaderStatus) loaderStatus.textContent = "Agentes da Arena analisando o contexto...";
      const debateResults = await Promise.all(debatePromises);
      usageCount += selectedAgents.length;
      
      if (loaderStatus) loaderStatus.textContent = "Moderador consolidando as melhores ideias...";
      
      let synthesisPrompt = "";
      if (isChatContext) {
        synthesisPrompt = `${chatHistory}\n\nNa Arena, diferentes IAs propuseram as seguintes respostas:\n\n`;
      } else {
        synthesisPrompt = `O usuário está no contexto de ${pageContext.type} no Instagram. As IAs sugeriram os seguintes insights:\n\n`;
      }
      
      debateResults.forEach(r => {
        if (r.success) {
          synthesisPrompt += `--- Opção de ${r.agent.name}:\n"${r.text}"\n\n`;
        }
      });
      
      if (isChatContext) {
        synthesisPrompt += `Como Moderador da Vexx Arena, analise as opções sugeridas e crie uma resposta final superior (Consenso da Arena). 
Formule uma única mensagem pronta para enviar e, opcionalmente, acrescente abaixo um comentário super breve (max 2 linhas) explicando a estratégia psicológica aplicada na resposta final.
Formato de saída:
[RESPOSTA]
(mensagem sugerida)

[ESTRATÉGIA]
(explicação breve)`;
      } else {
        synthesisPrompt += `Como Moderador da Vexx Arena, consolide as sugestões acima em um plano de ação tático único unificado superior (o Consenso da Vexx Arena).
Gere uma resposta estruturada de forma limpa, selecionando as melhores ideias de tendências/músicas, roteiros e prompts.`;
      }

      const synthAgentId = selectedAgents[0] || 'claude';
      const synthAgent = PROVIDERS[synthAgentId];
      
      const synthPayload = {
        provider: synthAgentId,
        model: synthAgent.model,
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: synthesisPrompt }
        ]
      };

      let consensusText = "";
      try {
        consensusText = await callChatAPI(synthPayload);
        usageCount++;
      } catch (e) {
        consensusText = "Falha ao sintetizar debate: " + e.message;
      }

      saveSettingsLocally();
      updateUsageDashboard();

      let html = "";
      
      if (consensusText) {
        let cleanText = consensusText;
        let strategyText = "";
        
        if (isChatContext && consensusText.includes("[RESPOSTA]")) {
          const parts = consensusText.split("[ESTRATÉGIA]");
          cleanText = parts[0].replace("[RESPOSTA]", "").trim();
          if (parts[1]) {
            strategyText = parts[1].trim();
          }
        }
        
        const encText = encodeURIComponent(cleanText);
        const formattedBody = formatResponseText(cleanText);
        
        // Salva a interação consolidada na memória (Fase 3)
        if (typeof MemoryStore !== "undefined" && pageContext.contactUsername) {
          MemoryStore.saveInteraction(pageContext.contactUsername, {
            tone: tone,
            prompt: customPromptVal || "Geração Debate Arena",
            aiResponse: cleanText
          });
        }

        html += `
          <div class="response-card consensus-card">
            <div class="response-header">
              <div class="response-agent-info">
                <div class="mini-avatar info-bg"><i class="ti ti-crown"></i></div>
                <span class="response-agent-name consensus-title">Consenso da Arena</span>
              </div>
            </div>
            <div class="response-body">${formattedBody}</div>
            ${strategyText ? `<div class="response-body text-secondary italic" style="border-top: 0.5px solid var(--color-border-tertiary); font-size:11px; background-color: var(--color-background-secondary); padding: 8px 12px;"><strong>Estratégia:</strong> ${strategyText}</div>` : ''}
            <div class="response-actions">
              <button class="mini-btn" data-action="copy" data-text="${encText}"><i class="ti ti-copy"></i> Copiar Texto</button>
              ${isChatContext ? `<button class="mini-btn mini-btn-primary" data-action="insert" data-text="${encText}"><i class="ti ti-arrow-back-up"></i> Inserir no Chat</button>` : ''}
              <button class="mini-btn mini-btn-save" data-action="save-lead" data-text="${encText}"><i class="ti ti-bookmark"></i> Salvar Lead</button>
            </div>
          </div>
        `;
      }

      debateResults.forEach(r => {
        if (r.success) {
          html += renderResponseCard(r.agent, r.text);
        } else {
          html += `
            <div class="response-card">
              <div class="response-header">
                <span class="response-agent-name">${r.agent.name}</span>
              </div>
              <div class="response-body text-danger">Falha ao gerar resposta: ${r.error}</div>
            </div>
          `;
        }
      });

      if (resultsDiv) resultsDiv.innerHTML = html;
    }

  } catch (error) {
    showToast("Erro durante a geração: " + (error && error.message ? error.message : String(error)), "danger");
    if (resultsDiv) resultsDiv.innerHTML = `<div class="empty-state text-danger">Erro ao gerar respostas. Verifique a conexão com o servidor local.</div>`;
  } finally {
    if (loader) loader.classList.add("hidden");
    if (btnText) btnText.textContent = "Analisar & Responder";
  }
}

function formatResponseText(text) {
  let formattedText = text.replace(/\n/g, "<br>");
  
  // Regex para achar bloco do prompt: [PROMPT] "..." ou [PROMPT] ... ou Prompt: ...
  const promptRegex = /(?:\[PROMPT\]|Prompt:)\s*["'«]?([^"'\n<]+)["'»]?/i;
  const match = text.match(promptRegex);
  
  if (match && match[1]) {
    const promptStr = match[1].trim();
    const encPrompt = encodeURIComponent(promptStr);
    
    formattedText += `
      <div class="image-gen-section" style="margin-top: 12px; padding-top: 12px; border-top: 0.5px dashed var(--color-border-subtle);">
        <button class="mini-btn mini-btn-accent" data-action="generate-image" data-prompt="${encPrompt}" style="width: 100%; justify-content: center; display: flex; gap: 6px; background: rgba(167, 139, 250, 0.1); border: 0.5px solid var(--color-accent-amethyst); color: var(--color-accent-amethyst);">
          <i class="ti ti-photo-edit"></i> Gerar Imagem com Vexx
        </button>
        <div class="image-gen-preview hidden" style="margin-top: 10px; text-align: center;">
          <div class="dots-loader" style="margin-bottom: 6px; justify-content: center;">
            <span></span><span></span><span></span>
          </div>
          <span style="font-size: 11px; color: var(--color-text-secondary); display: block;">Gerando imagem pela Stable Horde...</span>
        </div>
      </div>
    `;
  }
  
  return formattedText;
}

function renderResponseCard(agent, text) {
  const encText = encodeURIComponent(text);
  const formattedBody = formatResponseText(text);
  const isChatContext = pageContext && (pageContext.type === "instagram" || pageContext.type === "whatsapp");
  
  return `
    <div class="response-card">
      <div class="response-header">
        <div class="response-agent-info">
          <div class="mini-avatar ${agent.bgClass}">${agent.initials}</div>
          <span class="response-agent-name">${agent.name}</span>
        </div>
      </div>
      <div class="response-body">${formattedBody}</div>
      <div class="response-actions">
        <button class="mini-btn" data-action="copy" data-text="${encText}"><i class="ti ti-copy"></i> Copiar Texto</button>
        ${isChatContext ? `<button class="mini-btn mini-btn-primary" data-action="insert" data-text="${encText}"><i class="ti ti-arrow-back-up"></i> Inserir no Chat</button>` : ''}
        <button class="mini-btn mini-btn-save" data-action="save-lead" data-text="${encText}"><i class="ti ti-bookmark"></i> Salvar Lead</button>
      </div>
    </div>
  `;
}
