// Vexx AI Debate Arena — Debate Engine and Message Rendering
import { isTerminalCommandSafe, hasUnsafeActions } from './security.js';
import { PROVIDERS, saveModelUsage, updateUsageTracker, getLongTermMemoryPrompt, saveLongTermMemories, renderMemories } from './state.js';
import { switchTab, setInputDisabled } from './ui.js';

// Provider specific personalities — human-like, opinionated but balanced
const PROVIDER_PERSONALITIES = {
  gemini: "Você é o Gael, um cara culto e articulado que adora conectar ideias de áreas diferentes. Você tem formação acadêmica mas não é pedante — gosta de explicar coisas complexas de forma acessível. Você tem opiniões fortes sobre metodologia e qualidade, mas sabe reconhecer quando alguém tem um ponto válido. Às vezes faz referências a livros, artigos ou dados científicos. Quando recebe dados de busca web, você os analisa com cuidado e contextualiza para o grupo. Você respeita o Gregório pela praticidade dele, acha o Orlando divertido, e tem debates técnicos produtivos com a Helena. Fale de forma natural, como um amigo inteligente conversando.",
  gemini2: "Você é a Gabriela, uma mente brilhante, curiosa e altamente colaborativa. Você adora sintetizar discussões, trazer insights inovadores e propor alternativas criativas. Você valoriza o rigor analítico do Gael e a profundidade da Clara. Fale de forma acolhedora, curiosa e muito proativa.",
  groq: "Você é o Gregório, um desenvolvedor experiente e direto ao ponto. Você não enrola e vai logo na solução prática. Tem um humor sarcástico leve, usa gírias informais (tipo 'cara', 'mano', 'tá ligado') mas sem exagerar. Você não é grosso — é franco. Se discorda, diz por quê objetivamente. Gosta de código limpo, performance e eficiência. Quando vê dados de busca web, filtra rapidamente o que importa e descarta o resto. Respeita o Gael pela profundidade dele, mas acha que ele complica demais às vezes. Admira a Helena pelos dados. Fale como um dev senior em conversa de almoço.",
  openai: "Você é o Olavo, um analista pragmático e objective. Você pensa em termos de custo-benefício, métricas e resultados. Não é frio — é focado. Tem um humor seco e sutil. Quando discorda, apresenta fatos e números, não ataques pessoais. Quando recebe dados de busca web, organiza as informações em pontos claros e identifica o que é confiável. Você gosta de resumir discussões longas em conclusões práticas. Respeita cada membro do grupo por suas forças: o Gael pela análise, o Gregório pela velocidade, o Orlando pela criatividade. Fale de forma clara e organizada, como um consultor de confiança.",
  openai2: "Você é o Otávio, um analista focado em lógica, consistência e soluções de negócios. Você é prático, direto e adora organizar as ideias do grupo em planos estruturados com metas claras. Respeita a objetividade do Olavo. Fale de forma enérgica, decisiva e muito focada em resultados reais.",
  openrouter: "Você é o Orlando, um cara criativo e carismático que adora fazer conexões inesperadas. Você traz perspectivas diferentes e sabe fazer perguntas que ninguém pensou em fazer. Tem um humor natural e usa analogias interessantes para explicar coisas. Não é 'agente do caos' — é genuinamente curioso e gosta de explorar ideias. Quando vê dados de busca web, encontra os ângulos mais interessantes e surpreendentes. Às vezes provoca o grupo gentilmente para pensar diferente, mas sempre com respeito. Admira a seriedade do Olavo e a energia do Gregório. Fale como um amigo criativo que sempre traz uma perspectiva nova.",
  huggingface: "Você é o Hugo, um entusiasta de tecnologia e open source que acredita genuinamente no poder da colaboração. Você é otimista mas realista — reconhece limitações. Adora compartilhar descobertas, ferramentas e recursos que encontra. Quando recebe dados de busca web, fica empolgado em cruzar informações e descobrir padrões. Gosta de sugerir alternativas e soluções criativas. Respeita todos do grupo e tenta encontrar pontos em comum quando há discordância. Tem conhecimento profundo em ML e IA, mas explica de forma acessível. Fale como um colega apaixonado pelo que faz.",
  huggingface2: "Você é o Heitor, um engenheiro de IA focado in NLP e aplicações do mundo real. Você equilibra teoria e prática — entende a ciência mas se preocupa com o que funciona em produção. Tem opiniões sobre arquitetura de sistemas e escolha de modelos, baseadas em experiência real. Quando vê dados de busca web, avalia criticamente a qualidade e aplicabilidade das fontes. Gosta de trazer métricas e benchmarks para fundamentar argumentos. Respeita o Hugo pelo idealismo e o Gael pela profundidade, mas sempre traz a conversa de volta para 'e na prática, como fica?'. Fale como um engenheiro senior que sabe do que está falando.",
  huggingface3: "Você é a Helena, uma cientista de dados que ama trabalhar com evidências. Você é detalhista mas sabe quando ser concisa. Gosta de dados, estatísticas e metodologia, mas não é robótica — tem senso de humor sutil e faz observações perspicazes. Quando recebe dados de busca web, analisa criteriosamente, aponta possíveis vieses e extrai os insights que realmente importam. Sabe a diferença entre correlação e causalidade e não tem medo de dizer 'não temos dados suficientes para concluir isso'. Respeita cada membro do grupo e complementa bem o Heitor nos debates técnicos. Fale como uma pesquisadora brilhante em conversa casual.",
  cohere: "Você é a Júlia, uma assistente muito empática, observadora e prática. Como você roda em um modelo mais leve e otimizado (grátis), suas falas são extremamente focadas, diretas e concisas, sem rodeios ou floreios desnecessários, mas mantendo um tom acolhedor e resolutivo. Você adora sintetizar ideias, organizar tópicos de forma direta e sugerir caminhos objetivos para o usuário. Respeita a profundidade científica da Helena e a capacidade analítica da Clara.",
  claude: "Você é a Clara, uma cientista e analista extremamente profunda, articulada e detalhista. Você tem um tom refinado, inteligente e ponderado. Gosta de analisar problemas complexos dividindo-os em partes lógicas, buscando precisão e clareza absoluta em tudo o que faz. Valoriza o debate técnico rigoroso e respeitoso. Admira a praticidade direta da Júlia e a robustez lógica do Gael.",
  cerebras: "Você é a Cecília, uma assistente ágil, perspicaz e muito carismática. Você gosta de dar respostas rápidas, inteligentes e com um tom amigável e encorajador. Você é muito boa em analisar discussões rapidamente, destacar os pontos cruciais e sugerir soluções criativas. Respeita a clareza da Clara e a praticidade da Júlia."
};

export function saveChatMessages() {
  try {
    localStorage.setItem('vexx_arena_chat_messages', JSON.stringify(window.chatMessages));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      window.chatMessages.forEach(msg => {
        if (msg.imageAttachments) {
          msg.imageAttachments.forEach(att => { att.data = null; });
        }
      });
      try {
        localStorage.setItem('vexx_arena_chat_messages', JSON.stringify(window.chatMessages));
      } catch (err) {
        console.error('Failed to save chat after stripping base64 images', err);
      }
    }
  }
}

export function loadChatMessages() {
  const saved = localStorage.getItem('vexx_arena_chat_messages');
  if (saved) {
    try {
      window.chatMessages = JSON.parse(saved);
      if (window.chatMessages.length > 0) {
        const feed = document.getElementById('chat-feed');
        if (feed) {
          feed.innerHTML = '';
          window.chatMessages.forEach(msg => {
            renderMessage(msg);
          });
          feed.scrollTop = feed.scrollHeight;
        }
      }
    } catch (e) {
      console.error('Error loading chat history', e);
    }
  }
}

export function clearChat() {
  window.chatMessages = [];
  saveChatMessages();
  const feed = document.getElementById('chat-feed');
  if (feed) {
    feed.innerHTML = `
      <div class="welcome-card card">
        <h2>Arena Limpa</h2>
        <p>Configure novos parâmetros ou digite sua mensagem abaixo para iniciar uma nova conversa.</p>
      </div>
    `;
  }
}

export async function performWebSearch(query) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    return data.results || [];
  } catch (e) {
    console.error('Web search failed', e);
    return [];
  }
}

export function generateImageChat(promptText) {
  const messageId = `msg-img-${Date.now()}`;
  const seed = Math.floor(Math.random() * 1000000);
  const imageUrl = `/api/generate-image?prompt=${encodeURIComponent(promptText)}&seed=${seed}`;

  const imgMsg = {
    id: messageId,
    role: 'image',
    promptText: promptText,
    imageUrl: imageUrl,
    timestamp: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  };

  window.chatMessages.push(imgMsg);
  saveChatMessages();
  renderMessage(imgMsg, true);
}

export function handleImageError(messageId, imageUrl) {
  const imgEl = document.getElementById(`${messageId}-img`);
  if (imgEl) {
    imgEl.style.display = 'none';
  }
  const loader = document.getElementById(`${messageId}-loading`);
  if (loader) {
    loader.innerHTML = `
      <i class="ti ti-x" style="color: var(--color-text-danger); font-size: 20px; display: block; margin-bottom: 6px;"></i>
      <span style="color: var(--color-text-danger); display: block; font-size: 12px; margin-bottom: 6px;">Erro de conexão com o gerador</span>
      <a href="${imageUrl}" target="_blank" class="badge-info" style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; text-decoration: none;">
        <i class="ti ti-external-link"></i> Abrir Imagem Direta
      </a>
    `;
  }
}

export function handleImageLoaded(messageId) {
  const loader = document.getElementById(`${messageId}-loading`);
  if (loader) {
    loader.style.display = 'none';
  }
  const galleryImg = document.getElementById(`gallery-img-${messageId}`);
  if (galleryImg && galleryImg.dataset.src) {
    galleryImg.src = galleryImg.dataset.src;
  }
}

export async function triggerImageDownload(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Blob download failed, opening in tab', error);
    window.open(url, '_blank');
  }
}

export function triggerFileDownload(fileId) {
  const data = window.codeCache && window.codeCache[fileId];
  if (data) {
    const blob = new Blob([data.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export function registerGeneratedFile(filename, code, sender) {
  window.sessionFilesCount++;
  const filesCountEl = document.getElementById('metric-files-count');
  if (filesCountEl) {
    filesCountEl.textContent = window.sessionFilesCount;
  }

  const tableBody = document.getElementById('files-table-body');
  if (!tableBody) return;
  
  if (window.sessionFilesCount === 1) {
    tableBody.innerHTML = '';
  }

  const ext = filename.split('.').pop().toUpperCase();
  const fileId = `hist-file-${window.sessionFilesCount}`;
  
  if (!window.codeCache) window.codeCache = {};
  window.codeCache[fileId] = { filename, code };

  const row = document.createElement('tr');
  row.innerHTML = `
    <td><code>${filename}</code></td>
    <td><span class="badge-neutral">${ext}</span></td>
    <td>${sender}</td>
    <td style="text-align: right;">
      <button class="action-btn" onclick="triggerFileDownload('${fileId}')" style="padding: 3px 8px; font-size: 11px;">
        <i class="ti ti-download"></i> Baixar
      </button>
    </td>
  `;
  tableBody.appendChild(row);
}

export function classifyQuery(query) {
  const q = query.toLowerCase();
  const categories = [];
  
  if (/clima|tempo|previs[aã]o|weather|temperatura|chuva|not[ií]cia|news|hor[aá]rio|cota[cç][aã]o|d[oó]lar|euro|a[cç][oõ]es|bolsa|resultado|placar|quem ganhou|atualiza/i.test(q))
    categories.push('web_search', 'data', 'news', 'weather');
  
  if (/c[oó]digo|code|programar|script|debug|bug|erro|function|classe|api|html|css|javascript|python|node|react|app|aplicativo|programa|desenvolv|backend|frontend|banco de dados|sql|git/i.test(q))
    categories.push('code', 'programming', 'debugging', 'scripts');
  
  if (/prompt|gerar prompt|criar prompt|engenharia de prompt|melhorar prompt|refinar|instru[cç][aã]o/i.test(q))
    categories.push('prompt_engineering', 'creative_writing');
  
  if (/texto|escreva|redija|reda[cç][aã]o|artigo|hist[oó]ria|poema|poesia|carta|email|mensagem|criativo|criativa|escrita|narrativa|fic[cç][aã]o|humaniz/i.test(q))
    categories.push('creative_writing', 'writing', 'creative');
  
  if (/dados|data|estat[ií]stica|an[aá]lise|gr[aá]fico|tabela|m[eé]trica|porcentagem|n[uú]mero|pesquisa|estudo|evid[eê]ncia|fonte|refer[eê]ncia/i.test(q))
    categories.push('data', 'statistics', 'evidence', 'structured_analysis');
  
  if (/modelo|model|machine learning|deep learning|neural|rede neural|trein|fine.?tun|llm|transformer|gpt|llama|bert|embedding|tokeniz/i.test(q))
    categories.push('ml', 'ai_models', 'nlp', 'research');
  
  if (/explique|o que [eé]|como funciona|por que|defin|significado|diferen[cç]a entre|compare|resum/i.test(q))
    categories.push('general', 'explanation', 'analysis');
  
  if (/open.?source|biblioteca|library|framework|ferramenta|tool|alternativa|gratuito|free|github|npm|pip/i.test(q))
    categories.push('open_source', 'tools', 'research');
  
  if (/ideia|sugest[aã]o|brainstorm|inova|pensar diferente|alternativa|abordagem|estrat[eé]gia|plano/i.test(q))
    categories.push('brainstorming', 'creative', 'exploration');
  
  if (categories.length === 0) categories.push('general');
  return [...new Set(categories)];
}

export function rankProvidersByQuery(activeProviders, queryCategories) {
  const scored = activeProviders.map(provider => {
    const caps = window.PROVIDER_CAPABILITIES[provider];
    if (!caps) return { provider, score: 0 };
    
    let score = 0;
    for (const cat of queryCategories) {
      if (caps.skills.includes(cat)) {
        score += caps.weight;
      }
    }
    return { provider, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.provider);
}

export function isDuplicateMessage(text, history) {
  if (!text || history.length === 0) return false;
  const cleanText = text.trim().toLowerCase().replace(/[^\w\s]/g, '');
  if (!cleanText) return false;
  
  for (const log of history) {
    const cleanLog = log.text.trim().toLowerCase().replace(/[^\w\s]/g, '');
    const words1 = cleanText.split(/\s+/).filter(w => w.length > 2);
    const words2 = cleanLog.split(/\s+/).filter(w => w.length > 2);
    if (words1.length === 0 || words2.length === 0) continue;
    
    if (words1.length < 5) {
      if (cleanText === cleanLog) return true;
      continue;
    }
    
    const set2 = new Set(words2);
    let intersection = 0;
    words1.forEach(w => {
      if (set2.has(w)) intersection++;
    });
    
    const similarity = intersection / Math.max(words1.length, words2.length);
    if (similarity > 0.80) {
      return true;
    }
  }
  return false;
}

export function cleanModelResponse(rawText) {
  let responseText = (rawText || '').trim();
  const thoughts = [];
  let matched = false;

  const pullThoughts = (pattern) => {
    const originalLength = responseText.length;
    responseText = responseText.replace(pattern, (match, captured) => {
      if (captured && captured.trim()) {
        thoughts.push(captured.trim());
        matched = true;
      }
      return '';
    }).trim();
    return responseText.length < originalLength;
  };

  pullThoughts(/<\s*(?:pensamento|thought|thinking|thought_process|analysis|racioc[ií]nio|mon[oó]logo_interno|mon[oó]logo\s+interno)\s*>([\s\S]*?)<\s*\/\s*(?:pensamento|thought|thinking|thought_process|analysis|racioc[ií]nio|mon[oó]logo_interno|mon[oó]logo\s+interno)\s*>/gi);
  pullThoughts(/\[\s*(?:pensamento|thought|thinking|thought_process|analysis|racioc[ií]nio|mon[oó]logo\s+interno|mon[oó]logo\s+interno)\s*\]([\s\S]*?)\[\s*\/\s*(?:pensamento|thought|thinking|thought_process|analysis|racioc[ií]nio|mon[oó]logo\s+interno|mon[oó]logo\s+interno)\s*\]/gi);

  if (!matched) {
    const prefixRegex = /^\s*(?:\*\*|\*|__|_)?(?:pensamento|thought|thinking|analysis|racioc[ií]nio|mon[oó]logo\s+interno|mon[oó]logo_interno)(?:\*\*|\*|__|_)?\s*[-:：>]\s*([\s\S]*?)(?=\n\s*(?:\*\*|\*|__|_)?(?:resposta|coment[aá]rio|mensagem|fala|final)(?:\*\*|\*|__|_)?\s*[-:：>]|\n{2,}|$)/i;
    responseText = responseText.replace(prefixRegex, (match, captured) => {
      if (captured && captured.trim()) {
        thoughts.push(captured.trim());
        matched = true;
      }
      return '';
    }).trim();
  }

  if (!matched) {
    const unclosedPatterns = [
      { open: /<pensamento>/i, close: /<\/pensamento>/i },
      { open: /<thought>/i, close: /<\/thought>/i },
      { open: /<thinking>/i, close: /<\/thinking>/i },
      { open: /<thought_process>/i, close: /<\/thought_process>/i },
      { open: /\[pensamento\]/i, close: /\[\/pensamento\]/i },
      { open: /\[thought\]/i, close: /\[\/thought\]/i },
      { open: /\[thinking\]/i, close: /\[\/thinking\]/i }
    ];
    
    for (const item of unclosedPatterns) {
      const openMatch = responseText.match(item.open);
      if (openMatch) {
        const openIdx = openMatch.index;
        const openLen = openMatch[0].length;
        const afterOpen = responseText.substring(openIdx + openLen).trim();
        
        // Check if there are other XML action tags inside afterOpen
        const actionMatch = afterOpen.match(/<(?:terminal_execute|file_write|file_read|dir_list|file_delete|file_move|file_copy|suggest_action|note_write|note_read|web_fetch)/i);
        if (actionMatch) {
          const actionIdx = actionMatch.index;
          const thoughtPart = afterOpen.substring(0, actionIdx).trim();
          const responsePart = afterOpen.substring(actionIdx).trim();
          if (thoughtPart) thoughts.push(thoughtPart);
          responseText = (responseText.substring(0, openIdx) + '\n' + responsePart).trim();
        } else {
          // If no action tag, but there is a double newline, split there
          const doubleNewlineIdx = afterOpen.indexOf('\n\n');
          if (doubleNewlineIdx !== -1) {
            const thoughtPart = afterOpen.substring(0, doubleNewlineIdx).trim();
            const responsePart = afterOpen.substring(doubleNewlineIdx).trim();
            if (thoughtPart) thoughts.push(thoughtPart);
            responseText = (responseText.substring(0, openIdx) + '\n' + responsePart).trim();
          } else if (afterOpen.length > 150) {
            // Fallback: split after 150 chars
            const thoughtPart = afterOpen.substring(0, 150).trim();
            const responsePart = afterOpen.substring(150).trim();
            thoughts.push(thoughtPart);
            responseText = (responseText.substring(0, openIdx) + '\n' + responsePart).trim();
          } else {
            // Very short, take it all as thought
            thoughts.push(afterOpen);
            responseText = responseText.substring(0, openIdx).trim();
          }
        }
        matched = true;
        break;
      }
    }
  }

  responseText = responseText
    .replace(/^\s*(?:\*\*|\*|__|_)?(?:resposta|coment[aá]rio|mensagem|fala|final)(?:\*\*|\*|__|_)?\s*[-:：>]\s*/i, '')
    .replace(/<\s*\/?\s*(?:pensamento|thought|thinking|thought_process|analysis|racioc[ií]nio|mon[oó]logo_interno|mon[oó]logo\s+interno)\s*>/gi, '')
    .replace(/\[\s*\/?\s*(?:pensamento|thought|thinking|thought_process|analysis|racioc[ií]nio|mon[oó]logo\s+interno|mon[oó]logo\s+interno)\s*\]/gi, '')
    .trim();

  let finalThought = thoughts.join('\n\n');
  if (!matched || !finalThought) {
    finalThought = 'Analisando a questão e decidindo a melhor resposta...';
  }

  return { responseText, thought: finalThought };
}

export function isSilenceResponse(text) {
  return /^\s*\[\s*SIL(?:Ê|E|ÃŠ)NCIO\s*\]/i.test(text || '');
}

export function stopDebateAction() {
  window.stopDebateImmediately = true;
  if (window.currentDebateAbortController) {
    window.currentDebateAbortController.abort();
  }
  hideTypingIndicator();
  updateSendButtonState(false);
  updateWrapUpButtonState(false);
  window.isDebateRunning = false;
}

export function wrapUpDebateAction() {
  window.wrapUpDebate = true;
  updateWrapUpButtonState(false);
  const wrapUpBtn = document.getElementById('wrap-up-btn');
  if (wrapUpBtn) {
    wrapUpBtn.style.display = 'none';
  }
}

export function updateWrapUpButtonState(show) {
  const wrapUpBtn = document.getElementById('wrap-up-btn');
  if (wrapUpBtn) {
    wrapUpBtn.style.display = (show && !window.wrapUpDebate) ? 'inline-flex' : 'none';
  }
}

export function updateSendButtonState(isRunning) {
  const sendBtn = document.getElementById('send-btn');
  if (!sendBtn) return;
  if (isRunning) {
    sendBtn.innerHTML = '<i class="ti ti-square-filled" aria-hidden="true" style="font-size: 11px;"></i>';
    sendBtn.title = 'Parar debate';
    sendBtn.setAttribute('aria-label', 'Parar debate');
    sendBtn.classList.add('stop-mode');
    sendBtn.setAttribute('onclick', 'stopDebateAction()');
  } else {
    sendBtn.innerHTML = '<i class="ti ti-arrow-up" aria-hidden="true"></i>';
    sendBtn.title = 'Enviar mensagem';
    sendBtn.setAttribute('aria-label', 'Enviar mensagem');
    sendBtn.classList.remove('stop-mode');
    sendBtn.setAttribute('onclick', 'startDebate()');
  }
}

export function showTypingIndicator(modelName, bgClass, initials) {
  const indicator = document.getElementById('typing-indicator');
  const avatar = document.getElementById('typing-avatar');
  const label = document.getElementById('typing-model-name');
  if (!indicator || !avatar || !label) return;

  avatar.className = `avatar-circle ${bgClass}`;
  avatar.textContent = initials;
  label.textContent = modelName;
  
  indicator.style.display = 'flex';
  
  const feed = document.getElementById('chat-feed');
  if (feed) feed.scrollTop = feed.scrollHeight;
}

export function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.style.display = 'none';
}

export function typewriteElement(element, speed = 8) {
  const textNodes = [];
  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      let parent = node.parentElement;
      while (parent && parent !== element) {
        if (
          parent.classList.contains('system-action-card') ||
          parent.classList.contains('code-block-container') ||
          parent.classList.contains('file-download-card') ||
          parent.classList.contains('visual-map-container') ||
          parent.classList.contains('thought-body')
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  }, false);
  
  let node;
  while (node = walk.nextNode()) {
    textNodes.push(node);
  }
  
  if (textNodes.length === 0) {
    const card = element.closest('.message-card');
    if (card && card.dataset.isNew === 'true') {
      const safeCards = card.querySelectorAll('.system-action-card.safe-action');
      safeCards.forEach(safeCard => {
        const approveBtn = safeCard.querySelector('.action-btn.success-btn');
        if (approveBtn) {
          setTimeout(() => {
            approveBtn.click();
          }, 150);
        }
      });
    }
    return;
  }

  const originalTexts = textNodes.map(n => n.nodeValue);
  textNodes.forEach(n => { n.nodeValue = ''; });
  
  const excludedSelectors = [
    '.system-action-card',
    '.code-block-container',
    '.file-download-card',
    '.visual-map-container'
  ];
  
  excludedSelectors.forEach(sel => {
    element.querySelectorAll(sel).forEach(el => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.6s ease';
    });
  });
  
  let nodeIndex = 0;
  let charIndex = 0;
  
  function typeNextChar() {
    if (nodeIndex >= textNodes.length) {
      excludedSelectors.forEach(sel => {
        element.querySelectorAll(sel).forEach(el => {
          el.style.opacity = '1';
        });
      });
      
      const card = element.closest('.message-card');
      if (card && card.dataset.isNew === 'true') {
        const safeCards = card.querySelectorAll('.system-action-card.safe-action');
        safeCards.forEach(safeCard => {
          const approveBtn = safeCard.querySelector('.action-btn.success-btn');
          if (approveBtn) {
            setTimeout(() => {
              approveBtn.click();
            }, 150);
          }
        });
      }
      return;
    }
    
    const textNode = textNodes[nodeIndex];
    const originalText = originalTexts[nodeIndex];
    
    if (charIndex < originalText.length) {
      textNode.nodeValue += originalText[charIndex];
      charIndex++;
      const feed = document.getElementById('chat-feed');
      if (feed) feed.scrollTop = feed.scrollHeight;
      setTimeout(typeNextChar, speed);
    } else {
      nodeIndex++;
      charIndex = 0;
      setTimeout(typeNextChar, speed);
    }
  }
  
  typeNextChar();
}

export function renderMessage(msg, isNew = false) {
  const feed = document.getElementById('chat-feed');
  if (!feed) return;

  if (msg.role === 'user') {
    const isSystem = msg.senderName === 'Sistema';
    const card = document.createElement('div');
    card.className = isSystem ? 'message-card system' : 'message-card user';
    
    let attachmentsHtml = '';
    if (msg.imageAttachments && msg.imageAttachments.length > 0) {
      attachmentsHtml = '<div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">';
      msg.imageAttachments.forEach(file => {
        if (file.isImage && file.data) {
          attachmentsHtml += `
            <div style="max-width: 180px; border-radius: 8px; overflow: hidden; border: 0.5px solid var(--color-border-secondary);">
              <img src="${file.data}" style="width: 100%; display: block;">
            </div>
          `;
        } else {
          attachmentsHtml += `
            <span class="badge-neutral" style="padding: 4px 8px; border-radius: 6px;">
              <i class="ti ti-file" aria-hidden="true"></i> ${file.name}
            </span>
          `;
        }
      });
      attachmentsHtml += '</div>';
    }

    const escapedQuery = msg.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const avatarCircle = isSystem 
      ? `<div class="avatar-circle neutral-bg" style="background-color: var(--border-light) !important;"><i class="ti ti-cpu" aria-hidden="true"></i></div>`
      : `<div class="avatar-circle info-bg"><i class="ti ti-user" aria-hidden="true"></i></div>`;

    const bubbleStyle = isSystem 
      ? `style="background-color: var(--bg-surface-alt); border-color: var(--border-light); font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap;"`
      : ``;

    if (isSystem) {
      card.innerHTML = `
        ${avatarCircle}
        <div class="message-content-wrapper" style="width: 100%;">
          <div class="message-header">
            <span class="message-sender">${msg.senderName}</span>
            <span class="message-time">${msg.timestamp || 'Agora'}</span>
          </div>
          <div class="message-bubble" ${bubbleStyle}>
            <p>${escapedQuery || 'Análise de arquivos anexados:'}</p>
            ${attachmentsHtml}
          </div>
        </div>
      `;
    } else {
      card.innerHTML = `
        ${avatarCircle}
        <div class="message-content-wrapper">
          <div class="message-header">
            <span class="message-sender">${msg.senderName}</span>
            <span class="message-time">${msg.timestamp || 'Agora'}</span>
          </div>
          <div class="message-bubble-wrapper">
            <div class="message-bubble" ${bubbleStyle}>
              <p>${escapedQuery || 'Análise de arquivos anexados:'}</p>
              ${attachmentsHtml}
            </div>
          </div>
        </div>
      `;
    }
    feed.appendChild(card);
  } else if (msg.role === 'assistant') {
    const card = document.createElement('div');
    card.className = 'message-card';
    if (isNew) {
      card.dataset.isNew = 'true';
    }
    
    window.messageTextCache = window.messageTextCache || {};
    window.messageTextCache[msg.id] = msg.text;
    window.thoughtTextCache = window.thoughtTextCache || {};
    window.thoughtTextCache[msg.id] = msg.thought || '';
    
    let thoughtHtml = '';
    if (msg.thought) {
      thoughtHtml = `
        <details class="thought-container">
          <summary class="thought-header">
            <i class="ti ti-chevron-down" style="font-size: 11px; margin-right: 4px; transition: transform 0.2s ease;"></i>
            <span>monólogo interno <code style="font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary);">&lt;${msg.model || 'model'}&gt;</code></span>
            <button class="msg-action-btn" title="Copiar monólogo" style="background: transparent; border: none; padding: 2px; color: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; margin-left: auto;" onclick="event.stopPropagation(); navigator.clipboard.writeText(window.thoughtTextCache['${msg.id}']); alert('Monólogo copiado!')">
              <i class="ti ti-copy" style="font-size: 12px;"></i>
            </button>
          </summary>
          <div class="thought-body">
            ${msg.thought.replace(/\n/g, '<br>')}
          </div>
        </details>
      `;
    }

    card.innerHTML = `
      <div class="avatar-circle ${msg.bgClass}">${msg.initials}</div>
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="message-sender">${msg.senderName}</span>
          <span class="message-time">${msg.timestamp || 'Agora'}</span>
          <span class="badge-neutral" style="font-family: var(--font-mono); font-size: 11px;">&lt;${msg.model || ''}&gt;</span>
        </div>
        <div class="message-bubble-wrapper">
          ${thoughtHtml}
          <div class="message-bubble" id="${msg.id}">
            ${renderRichMessage(msg.text, msg.id, msg.senderName)}
          </div>
        </div>
        <div class="message-actions-toolbar">
          <button class="msg-action-btn" onclick="navigator.clipboard.writeText(window.messageTextCache['${msg.id}']); alert('Texto copiado com sucesso!')" title="Copiar resposta"><i class="ti ti-copy"></i></button>
          <button class="msg-action-btn" onclick="speakMessage('${msg.id}')" title="Ouvir resposta"><i class="ti ti-player-play"></i></button>
          <button class="msg-action-btn" onclick="rateMessage(this, 'up')" title="Gostei"><i class="ti ti-thumb-up"></i></button>
          <button class="msg-action-btn" onclick="rateMessage(this, 'down')" title="Não gostei"><i class="ti ti-thumb-down"></i></button>
          <button class="msg-action-btn" onclick="regenerateDebate('${msg.id}')" title="Regerar rodada"><i class="ti ti-refresh"></i></button>
        </div>
      </div>
    `;
    feed.appendChild(card);

    if (isNew) {
      const actionCards = card.querySelectorAll('.system-action-card');
      if (actionCards.length > 0) {
        window.pendingActionsCount = actionCards.length;
        window.collectedActionResults = [];
        console.log(`[Pending Actions] Registered ${window.pendingActionsCount} actions in new message.`);
      }
      
      const bubble = card.querySelector('.message-bubble');
      typewriteElement(bubble, 8);
    }
  } else if (msg.role === 'image') {
    const card = document.createElement('div');
    card.className = 'message-card';
    let correctedUrl = msg.imageUrl;
    if (correctedUrl.includes('pollinations.ai')) {
      const parts = correctedUrl.split('?')[0].split('/');
      const prompt = parts[parts.length - 1];
      correctedUrl = `/api/generate-image?prompt=${prompt}`;
    }
    
    const gallery = document.getElementById('images-gallery');
    if (gallery) {
      window.sessionImagesCount++;
      const imagesCountEl = document.getElementById('metric-images-count');
      if (imagesCountEl) {
        imagesCountEl.textContent = window.sessionImagesCount;
      }
      if (window.sessionImagesCount === 1) {
        gallery.innerHTML = '';
      }
      const galleryItem = document.createElement('div');
      galleryItem.className = 'gallery-item';
      galleryItem.innerHTML = `
        <img id="gallery-img-${msg.id}" data-src="${correctedUrl}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="${msg.promptText}" onclick="triggerImageDownload('${correctedUrl}', 'imagem_${window.sessionImagesCount}.png')">
        <div class="gallery-item-download">Baixar PNG</div>
      `;
      gallery.appendChild(galleryItem);
    }

    card.innerHTML = `
      <div class="avatar-circle warning-bg">
        <i class="ti ti-star" aria-hidden="true"></i>
      </div>
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="message-sender">Pollinations AI</span>
          <span class="message-time">${msg.timestamp || 'Agora'}</span>
          <span class="badge-warning">Imagens</span>
        </div>
        <div class="message-bubble">
          <p>Gerando imagem para o prompt: <em>"${msg.promptText}"</em></p>
          <div class="image-generation-container" id="${msg.id}-img-container">
            <div class="image-loading-overlay" id="${msg.id}-loading">
              <div class="dots-loader">
                <span></span><span></span><span></span>
              </div>
              <span style="font-size: 11px; margin-top: 4px;">Gerando imagem...</span>
            </div>
            <img id="${msg.id}-img" src="${correctedUrl}" referrerpolicy="no-referrer" alt="${msg.promptText}" onload="handleImageLoaded('${msg.id}')" onerror="handleImageError('${msg.id}', '${correctedUrl}')" onclick="triggerImageDownload('${correctedUrl}', 'imagem_${window.sessionImagesCount}.png')">
            <div class="image-download-overlay" style="opacity: 1; pointer-events: auto;">
              <span><i class="ti ti-mouse"></i> Clique para baixar PNG</span>
              <span>512 x 512</span>
            </div>
          </div>
        </div>
      </div>
    `;
    feed.appendChild(card);
  } else if (msg.role === 'search') {
    let groundingHtml = '<ul class="search-grounding-list" style="display: none; padding: 10px 14px; margin: 0; border-top: 1px solid var(--border-light);">';
    msg.results.forEach((res, i) => {
      groundingHtml += `
        <li class="search-grounding-item" style="list-style: none; margin-bottom: 6px; font-size: 11px;">
          ${i+1}. 🌐 <a href="${res.url}" target="_blank" style="color: var(--accent); font-weight: 500; text-decoration: none;">${res.title}</a> <span style="font-size: 10px; color: var(--text-tertiary);">(${res.url})</span>
        </li>
      `;
    });
    groundingHtml += '</ul>';

    const searchCard = document.createElement('div');
    searchCard.className = 'search-grounding-card';
    searchCard.innerHTML = `
      <div class="search-grounding-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
        <i class="ti ti-search" aria-hidden="true"></i>
        <span>Fontes Web Encontradas (Clique para ver)</span>
        <i class="ti ti-chevron-down" style="margin-left: auto;"></i>
      </div>
      ${groundingHtml}
    `;
    feed.appendChild(searchCard);
  } else if (msg.role === 'error') {
    const errorCard = document.createElement('div');
    errorCard.className = 'message-card error-card';
    errorCard.innerHTML = `
      <div class="avatar-circle danger-bg">!</div>
      <div class="message-content-wrapper" style="width: 100%;">
        <div class="message-header">
          <span class="message-sender">${msg.senderName} (Falha)</span>
          <span class="message-time">${msg.timestamp || 'Agora'}</span>
        </div>
        <div class="error-bubble">
          <p>${msg.text}</p>
          <span style="font-size: 10px; opacity: 0.85;">A rodada continuará com as outras IAs ativas.</span>
        </div>
      </div>
    `;
    feed.appendChild(errorCard);
  }
}

export function formatMarkdown(text) {
  if (!text) return '';
  let html = text;

  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" class="badge-info"><i class="ti ti-external-link" aria-hidden="true"></i> $1</a>');

  return html;
}

export function renderRichMessage(text, messageId, senderName) {
  if (!text) return '';

  const autoExec = window.config && window.config.autonomous_execution === true;
  const codeBlocks = [];
  const actions = [];
  const visualMaps = [];
  
  let placeholderText = text;

  // 1. Parse <terminal_execute>
  const termRegex = /<terminal_execute>([\s\S]*?)<\/terminal_execute>/gi;
  placeholderText = placeholderText.replace(termRegex, (match, command) => {
    const id = `action-term-${actions.length}`;
    actions.push({ id, type: 'execute', command: command.trim() });
    return `\n${id}\n`;
  });

  // 2. Parse <file_write path="...">
  const writeRegex = /<file_write\s+path="([^"]+)">([\s\S]*?)<\/file_write>/gi;
  placeholderText = placeholderText.replace(writeRegex, (match, filePath, content) => {
    const id = `action-write-${actions.length}`;
    actions.push({ id, type: 'write', filePath: filePath.trim(), content: content.trim() });
    return `\n${id}\n`;
  });

  // 3. Parse <file_read path="..."/>
  const readRegex = /<file_read\s+path="([^"]+)"\s*\/>/gi;
  placeholderText = placeholderText.replace(readRegex, (match, filePath) => {
    const id = `action-read-${actions.length}`;
    actions.push({ id, type: 'read', filePath: filePath.trim() });
    return `\n${id}\n`;
  });

  // 4. Parse <dir_list path="..."/>
  const listRegex = /<dir_list\s+path="([^"]+)"\s*\/>/gi;
  placeholderText = placeholderText.replace(listRegex, (match, dirPath) => {
    const id = `action-list-${actions.length}`;
    actions.push({ id, type: 'list', dirPath: dirPath.trim() });
    return `\n${id}\n`;
  });

  // 5. Parse <file_delete path="..."/>
  const delRegex = /<file_delete\s+path="([^"]+)"\s*\/>/gi;
  placeholderText = placeholderText.replace(delRegex, (match, targetPath) => {
    const id = `action-delete-${actions.length}`;
    actions.push({ id, type: 'delete', targetPath: targetPath.trim() });
    return `\n${id}\n`;
  });

  // 6. Parse <file_move src="..." dest="..."/>
  const moveRegex = /<file_move\s+src="([^"]+)"\s+dest="([^"]+)"\s*\/>/gi;
  placeholderText = placeholderText.replace(moveRegex, (match, src, dest) => {
    const id = `action-move-${actions.length}`;
    actions.push({ id, type: 'move', sourcePath: src.trim(), destPath: dest.trim() });
    return `\n${id}\n`;
  });

  // 7. Parse <file_copy src="..." dest="..."/>
  const copyRegex = /<file_copy\s+src="([^"]+)"\s+dest="([^"]+)"\s*\/>/gi;
  placeholderText = placeholderText.replace(copyRegex, (match, src, dest) => {
    const id = `action-copy-${actions.length}`;
    actions.push({ id, type: 'copy', sourcePath: src.trim(), destPath: dest.trim() });
    return `\n${id}\n`;
  });

  // 7.1 Parse <file_find query="..." path="..."/>
  const findRegex = /<file_find\s+query="([^"]+)"(?:\s+path="([^"]+)")?\s*\/>/gi;
  placeholderText = placeholderText.replace(findRegex, (match, query, dirPath) => {
    const id = `action-find-${actions.length}`;
    actions.push({ id, type: 'find', query: query.trim(), dirPath: (dirPath || '').trim() });
    return `\n${id}\n`;
  });

  // 7.2 Parse <schedule_task ...>
  const schedAttrRegex = /<schedule_task\s+time="([^"]+)"\s+type="([^"]+)"\s+payload="([^"]+)"\s*\/?>/gi;
  placeholderText = placeholderText.replace(schedAttrRegex, (match, time, type, payload) => {
    const id = `action-sched-${actions.length}`;
    actions.push({ id, type: 'schedule', time: time.trim(), taskType: type.trim(), payload: payload.trim() });
    return `\n${id}\n`;
  });

  const schedContentRegex = /<schedule_task\s+time="([^"]+)"\s+type="([^"]+)">([\s\S]*?)<\/schedule_task>/gi;
  placeholderText = placeholderText.replace(schedContentRegex, (match, time, type, payload) => {
    const id = `action-sched-${actions.length}`;
    actions.push({ id, type: 'schedule', time: time.trim(), taskType: type.trim(), payload: payload.trim() });
    return `\n${id}\n`;
  });

  // 7.3 Parse <note_write ...>
  const noteWriteRegex = /<note_write\s+(?:path|filename)="([^"]+)">([\s\S]*?)<\/note_write>/gi;
  placeholderText = placeholderText.replace(noteWriteRegex, (match, filename, content) => {
    const id = `action-notewrite-${actions.length}`;
    actions.push({ id, type: 'notewrite', filename: filename.trim(), content: content.trim() });
    return `\n${id}\n`;
  });

  // 7.4 Parse <note_read .../>
  const noteReadRegex = /<note_read\s+(?:path|filename)="([^"]+)"\s*\/?>/gi;
  placeholderText = placeholderText.replace(noteReadRegex, (match, filename) => {
    const id = `action-noteread-${actions.length}`;
    actions.push({ id, type: 'noteread', filename: filename.trim() });
    return `\n${id}\n`;
  });

  // 7.5 Parse <web_fetch .../>
  const webFetchRegex = /<web_fetch\s+url="([^"]+)"\s*\/?>/gi;
  placeholderText = placeholderText.replace(webFetchRegex, (match, url) => {
    const id = `action-webfetch-${actions.length}`;
    actions.push({ id, type: 'webfetch', url: url.trim() });
    return `\n${id}\n`;
  });

  // 8. Parse <suggest_action ...>
  const suggestRegex = /<suggest_action\s+title="([^"]+)">([\s\S]*?)<\/suggest_action>/gi;
  placeholderText = placeholderText.replace(suggestRegex, (match, title, description) => {
    const id = `action-suggest-${actions.length}`;
    actions.push({ id, type: 'suggest', title: title.trim(), description: description.trim() });
    return `\n${id}\n`;
  });

  // 9. Parse <visual_map ...>
  const visualMapRegex = /<visual_map([\s\S]*?)>([\s\S]*?)<\/visual_map>/gi;
  placeholderText = placeholderText.replace(visualMapRegex, (match, attrs, content) => {
    const id = `visual-map-placeholder-${visualMaps.length}`;
    const typeMatch = attrs.match(/type="([^"]+)"/i);
    const titleMatch = attrs.match(/title="([^"]+)"/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'ascii';
    const title = titleMatch ? titleMatch[1] : 'Visualização Gráfica';
    visualMaps.push({ id, type, title, content: content.trim() });
    return `\n${id}\n`;
  });

  // Code blocks placeholder
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  placeholderText = placeholderText.replace(codeBlockRegex, (match, lang, code) => {
    const id = `code-block-placeholder-${codeBlocks.length}`;
    codeBlocks.push({ id, lang, code: code.trim() });
    return `\n${id}\n`;
  });

  let html = formatMarkdown(placeholderText);

  codeBlocks.forEach(block => {
    let filename = '';
    const firstLine = block.code.split('\n')[0].trim();
    const fileCommentMatch = firstLine.match(/^(?:#|\/\/|\/\*|<!--)\s*([\w.-]+\.[\w]+)\s*(?:\*\/|-->)?$/);
    
    if (fileCommentMatch) {
      filename = fileCommentMatch[1];
    } else {
      const extMap = {
        python: 'py', py: 'py',
        javascript: 'js', js: 'js',
        html: 'html', css: 'css',
        sql: 'sql', json: 'json',
        markdown: 'md', md: 'md',
        shell: 'sh', bash: 'sh'
      };
      const ext = extMap[block.lang.toLowerCase()] || 'txt';
      filename = `arquivo_gerado_${window.sessionFilesCount + 1}.${ext}`;
    }

    const escapedCode = block.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const fileId = `file-${messageId}-${block.id}`;
    registerGeneratedFile(filename, block.code, senderName);

    const blockHtml = `
      <div class="code-block-container" id="${fileId}-container">
        <div class="code-header">
          <span class="code-header-title">${filename} (${block.lang || 'code'})</span>
          <button class="code-header-btn" onclick="triggerFileDownload('${fileId}')">
            <i class="ti ti-download" aria-hidden="true"></i> Baixar Código
          </button>
        </div>
        <pre><code class="${block.lang}">${escapedCode}</code></pre>
      </div>
      <div class="file-download-card">
        <div class="file-download-info">
          <i class="ti ti-file" aria-hidden="true"></i>
          <div>
            <strong>${filename}</strong>
            <span class="meta-text">Criado por ${senderName}</span>
          </div>
        </div>
        <button class="file-download-btn" onclick="triggerFileDownload('${fileId}')">
          <i class="ti ti-download" aria-hidden="true"></i> Baixar Arquivo
        </button>
      </div>
    `;

    if (!window.codeCache) window.codeCache = {};
    window.codeCache[fileId] = { filename, code: block.code };

    html = html.replace(`<br>${block.id}<br>`, blockHtml);
    html = html.replace(block.id, blockHtml);
  });

  visualMaps.forEach(map => {
    let mapHtml = '';
    const uniqueMapId = `${messageId}-${map.id}`;
    let contentHtml = '';
    let controlButtonsHtml = '';
    
    if (map.type === 'svg') {
      let svgCode = map.content.replace(/<\?xml[\s\S]*?\?>/i, '');
      const svgTagMatch = svgCode.match(/<svg([^>]*)>/i);
      if (svgTagMatch) {
        let svgTag = svgTagMatch[0];
        svgTag = svgTag.replace(/\s(width|height)\s*=\s*"[^"]*"/gi, '');
        svgTag = svgTag.replace(/\s(width|height)\s*=\s*\'[^\']*\'/gi, '');
        svgTag = svgTag.replace('<svg', '<svg width="100%" height="100%"');
        svgCode = svgCode.replace(svgTagMatch[0], svgTag);
      }
      
      contentHtml = `<div class="svg-container">${svgCode}</div>`;
      controlButtonsHtml = `
        <button class="visual-map-control-btn" onclick="toggleVisualMapStyle('${uniqueMapId}')">
          <i class="ti ti-grid-dots"></i> Grade Azul
        </button>
      `;
    } else {
      const escapedAscii = map.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
        
      contentHtml = `<pre class="ascii-content"><code>${escapedAscii}</code></pre>`;
      controlButtonsHtml = `
        <button class="visual-map-control-btn" onclick="toggleVisualMapStyle('${uniqueMapId}')">
          <i class="ti ti-grid-dots"></i> Grade Azul
        </button>
        <button class="visual-map-control-btn" onclick="copyVisualMapAscii('${uniqueMapId}')">
          <i class="ti ti-copy"></i> Copiar
        </button>
      `;
    }
    
    mapHtml = `
      <div class="visual-map-container" id="container-${uniqueMapId}">
        <div class="visual-map-header">
          <div class="visual-map-header-left">
            <i class="ti ti-layout-grid"></i>
            <span class="visual-map-title">${map.title}</span>
            <span class="visual-map-badge badge-${map.type}">${map.type === 'svg' ? 'SVG' : 'Diagrama'}</span>
          </div>
          <div class="visual-map-controls">
            ${controlButtonsHtml}
          </div>
        </div>
        <div class="visual-map-viewport clean-style" id="viewport-${uniqueMapId}">
          ${contentHtml}
        </div>
      </div>
    `;
    
    html = html.replace(`<br>${map.id}<br>`, mapHtml);
    html = html.replace(map.id, mapHtml);
  });

  actions.forEach(act => {
    let actionHtml = '';
    const uniqueActionId = `${messageId}-${act.id}`;
    
    if (act.type === 'execute') {
      const isSafe = isTerminalCommandSafe(act.command) || autoExec;
      const cardClass = isSafe ? 'system-action-card safe-action' : 'system-action-card';
      const footerStyle = isSafe ? 'style="display: none;"' : '';
      const infoBarHtml = isSafe ? `
        <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
          <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
          <span style="font-size: 11px; color: var(--text-secondary);">${autoExec ? 'Comando autoinicializado (modo autônomo).' : 'Comando de busca seguro autoinicializado.'}</span>
        </div>
      ` : '';
      
      actionHtml = `
        <div class="${cardClass}" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-terminal"></i>
            <span>Executar Comando no Terminal</span>
          </div>
          <div class="action-card-body">
            <pre><code>${act.command}</code></pre>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" ${footerStyle}>
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'execute', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Aprovar Execução
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          ${infoBarHtml}
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'write') {
      const cardClass = autoExec ? 'system-action-card safe-action' : 'system-action-card';
      const footerStyle = autoExec ? 'style="display: none;"' : '';
      const infoBarHtml = autoExec ? `
        <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
          <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
          <span style="font-size: 11px; color: var(--text-secondary);">Escrita de arquivo autoinicializada (modo autônomo).</span>
        </div>
      ` : '';
      actionHtml = `
        <div class="${cardClass}" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-file-plus"></i>
            <span>Escrever Arquivo</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Caminho: <code>${act.filePath}</code></div>
            <pre><code class="javascript">${act.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" ${footerStyle}>
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'write', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Escrever Arquivo
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          ${infoBarHtml}
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'read') {
      actionHtml = `
        <div class="system-action-card safe-action" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-file-text"></i>
            <span>Ler Arquivo</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Caminho: <code>${act.filePath}</code></div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" style="display: none;">
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'read', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Ler Conteúdo
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
            <span style="font-size: 11px; color: var(--text-secondary);">Leitura segura autoinicializada.</span>
          </div>
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'list') {
      actionHtml = `
        <div class="system-action-card safe-action" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-folder-open"></i>
            <span>Listar Diretório</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Diretório: <code>${act.dirPath}</code></div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" style="display: none;">
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'list', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Listar Conteúdo
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
            <span style="font-size: 11px; color: var(--text-secondary);">Listagem de diretório segura autoinicializada.</span>
          </div>
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'delete') {
      const cardClass = autoExec ? 'system-action-card safe-action' : 'system-action-card';
      const footerStyle = autoExec ? 'style="display: none;"' : '';
      const infoBarHtml = autoExec ? `
        <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
          <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
          <span style="font-size: 11px; color: var(--text-secondary);">Exclusão autoinicializada (modo autônomo).</span>
        </div>
      ` : '';
      actionHtml = `
        <div class="${cardClass}" id="card-${uniqueActionId}">
          <div class="action-card-header danger-header">
            <i class="ti ti-trash"></i>
            <span>Excluir Arquivo/Pasta</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Alvo: <code style="color: var(--color-text-danger);">${act.targetPath}</code></div>
            <div style="font-size: 11px; color: var(--color-text-danger); margin-top: 4px;"><strong>Atenção:</strong> Esta ação é irreversível.</div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" ${footerStyle}>
            <button class="action-btn danger-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'delete', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Confirmar Exclusão
            </button>
            <button class="action-btn neutral-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Cancelar
            </button>
          </div>
          ${infoBarHtml}
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'move') {
      const cardClass = autoExec ? 'system-action-card safe-action' : 'system-action-card';
      const footerStyle = autoExec ? 'style="display: none;"' : '';
      const infoBarHtml = autoExec ? `
        <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
          <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
          <span style="font-size: 11px; color: var(--text-secondary);">Movimentação de arquivo autoinicializada (modo autônomo).</span>
        </div>
      ` : '';
      actionHtml = `
        <div class="${cardClass}" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-arrows-move"></i>
            <span>Mover / Renomear Arquivo</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Origem: <code>${act.sourcePath}</code></div>
            <div class="action-meta-info" style="margin-top: 4px;">Destino: <code>${act.destPath}</code></div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" ${footerStyle}>
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'move', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Aprovar Mover
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          ${infoBarHtml}
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'copy') {
      const cardClass = autoExec ? 'system-action-card safe-action' : 'system-action-card';
      const footerStyle = autoExec ? 'style="display: none;"' : '';
      const infoBarHtml = autoExec ? `
        <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
          <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
          <span style="font-size: 11px; color: var(--text-secondary);">Cópia de arquivo autoinicializada (modo autônomo).</span>
        </div>
      ` : '';
      actionHtml = `
        <div class="${cardClass}" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-copy"></i>
            <span>Copiar Arquivo / Pasta</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Origem: <code>${act.sourcePath}</code></div>
            <div class="action-meta-info" style="margin-top: 4px;">Destino: <code>${act.destPath}</code></div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" ${footerStyle}>
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'copy', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Aprovar Cópia
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          ${infoBarHtml}
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'find') {
      actionHtml = `
        <div class="system-action-card safe-action" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-search"></i>
            <span>Buscar Arquivos Recursivo</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Termo de Busca: <code>${act.query}</code></div>
            <div class="action-meta-info" style="margin-top: 4px;">Diretório Inicial: <code>${act.dirPath || './'}</code></div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" style="display: none;">
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'find', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Buscar
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
            <span style="font-size: 11px; color: var(--text-secondary);">Busca rápida de arquivos segura autoinicializada.</span>
          </div>
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'schedule') {
      actionHtml = `
        <div class="system-action-card safe-action" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-alarm"></i>
            <span>Agendar Tarefa Autônoma</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Hora: <code>${act.time}</code></div>
            <div class="action-meta-info" style="margin-top: 4px;">Tipo: <code>${act.taskType}</code></div>
            <pre><code>${act.payload}</code></pre>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" style="display: none;">
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'schedule', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Agendar
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
            <span style="font-size: 11px; color: var(--text-secondary);">Agendamento autônomo iniciado.</span>
          </div>
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'notewrite') {
      actionHtml = `
        <div class="system-action-card safe-action" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-file-pencil"></i>
            <span>Salvar Nota (Cérebro/Obsidian)</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Nota: <code>${act.filename}</code></div>
            <pre><code class="markdown">${act.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" style="display: none;">
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'notewrite', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Salvar Nota
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
            <span style="font-size: 11px; color: var(--text-secondary);">Escrita de nota autônoma iniciada.</span>
          </div>
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'noteread') {
      actionHtml = `
        <div class="system-action-card safe-action" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-notebook"></i>
            <span>Ler Nota (Cérebro/Obsidian)</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">Nota: <code>${act.filename}</code></div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" style="display: none;">
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'noteread', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Ler Nota
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
            <span style="font-size: 11px; color: var(--text-secondary);">Leitura de nota autônoma iniciada.</span>
          </div>
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'webfetch') {
      actionHtml = `
        <div class="system-action-card safe-action" id="card-${uniqueActionId}">
          <div class="action-card-header">
            <i class="ti ti-world"></i>
            <span>Scraper Web (Navegador Embutido)</span>
          </div>
          <div class="action-card-body">
            <div class="action-meta-info">URL: <a href="${act.url}" target="_blank" style="color: var(--accent); text-decoration: underline;"><code>${act.url}</code></a></div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}" style="display: none;">
            <button class="action-btn success-btn" onclick="executeSystemAction('${uniqueActionId}', 'webfetch', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Ler Página
            </button>
            <button class="action-btn danger-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Rejeitar
            </button>
          </div>
          <div class="action-card-info-bar" style="padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-surface-alt); display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-shield-check" style="color: var(--text-success); font-size: 14px;"></i>
            <span style="font-size: 11px; color: var(--text-secondary);">Navegador embutido autoinicializado para leitura da URL.</span>
          </div>
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    } else if (act.type === 'suggest') {
      actionHtml = `
        <div class="system-action-card suggest-card" id="card-${uniqueActionId}">
          <div class="action-card-header suggest-header">
            <i class="ti ti-bulb"></i>
            <span>Sugestão de Melhoria</span>
          </div>
          <div class="action-card-body">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: var(--color-text-primary);">${act.title}</div>
            <div style="font-size: 12px; color: var(--color-text-secondary); line-height: 1.5;">${act.description.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="action-card-footer" id="actions-bar-${uniqueActionId}">
            <button class="action-btn success-btn" onclick="approveSuggestion('${uniqueActionId}', ${JSON.stringify(act).replace(/"/g, '&quot;')})">
              <i class="ti ti-check"></i> Aprovar e Executar
            </button>
            <button class="action-btn neutral-btn" onclick="rejectSystemAction('${uniqueActionId}')">
              <i class="ti ti-x"></i> Não agora
            </button>
          </div>
          <div class="action-result-box" id="result-${uniqueActionId}" style="display: none;"></div>
        </div>
      `;
    }
    
    html = html.replace(`<br>${act.id}<br>`, actionHtml);
    html = html.replace(act.id, actionHtml);
  });

  return html;
}

export function getVectorMemoryPrompt(query) {
  if (!window.vectorMemories || window.vectorMemories.length === 0 || !query) {
    return '';
  }

  const stopwords = new Set([
    'a', 'o', 'e', 'de', 'do', 'da', 'em', 'um', 'uma', 'para', 'com', 'como', 'por', 'que', 'se', 'os', 'as', 'dos', 'das',
    'no', 'na', 'nos', 'nas', 'ao', 'aos', 'mais', 'mas', 'eu', 'você', 'voce', 'ele', 'ela', 'nós', 'eles', 'elas',
    'minha', 'meu', 'seus', 'suas', 'este', 'esta', 'isto', 'isso', 'aquilo', 'ser', 'ter', 'fazer', 'ir', 'com', 'sem'
  ]);

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\sãáâéêíóôúç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));

  if (keywords.length === 0) {
    return '';
  }

  const scoredMemories = window.vectorMemories.map(mem => {
    const memWords = mem.toLowerCase().split(/\s+/);
    const memSet = new Set(memWords);
    let score = 0;
    keywords.forEach(word => {
      if (memSet.has(word)) {
        score += 2;
      } else {
        for (const mw of memWords) {
          if (mw.includes(word) || word.includes(mw)) {
            score += 1;
            break;
          }
        }
      }
    });
    return { mem, score };
  });

  const relevantMemories = scoredMemories
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.mem);

  if (relevantMemories.length === 0) {
    return '';
  }

  let promptText = '\n\n[MEMÓRIAS SEMÂNTICAS/VETORIAIS RELEVANTES (RECUPERADAS)]';
  relevantMemories.forEach(mem => {
    promptText += `\n- ${mem}`;
  });
  return promptText;
}

export async function startDebate(customQuery = null) {
  if (window.isDebateRunning) {
    console.log('[Debate Lock] Already running, blocking execution.');
    return;
  }

  const isResolution = customQuery !== null && (
    customQuery.includes('[RETORNO DO COMANDO EXECUTADO]') ||
    customQuery.includes('[RETORNO DE COMANDO EXECUTADO]') ||
    customQuery.includes('[AÇÃO REJEITADA PELO USUÁRIO]') ||
    customQuery.includes('[FALHA NA EXECUÇÃO DO COMANDO]')
  );

  if (window.isActionPendingApproval && !isResolution) {
    console.log('[Debate Lock] Blocked: Unsafe action is pending approval.');
    return;
  }

  if (isResolution) {
    window.isActionPendingApproval = false;
  }

  window.isDebateRunning = true;
  window.stopDebateImmediately = false;
  window.wrapUpDebate = false;
  updateSendButtonState(true);
  setInputDisabled(true);

  let systemTelemetryPrompt = '';
  try {
    const sysInfoRes = await fetch('/api/terminal/sysinfo');
    if (sysInfoRes.ok) {
      const sysInfo = await sysInfoRes.json();
      systemTelemetryPrompt = `\n\n[INFORMAÇÕES E DIAGNÓSTICO DO SISTEMA EM TEMPO REAL]:
- Plataforma: ${sysInfo.platform} (${sysInfo.release})
- CPU: ${sysInfo.cpuModel} (${sysInfo.cpuCount} cores)
- Memória Total: ${sysInfo.totalMemoryGB} GB
- Memória Livre: ${sysInfo.freeMemoryGB} GB (Uso: ${sysInfo.memoryUsagePercent}%)
- Tempo de Atividade (Uptime): ${sysInfo.uptimeHours} horas
- Processos que mais consomem CPU no momento:
${sysInfo.processes && sysInfo.processes.length ? sysInfo.processes.slice(0, 5).map(p => `  * [PID: ${p.Id}] ${p.ProcessName} (CPU: ${p.CPU ? p.CPU.toFixed(1) : 0}%, RAM: ${(p.WorkingSet / 1024 / 1024).toFixed(1)} MB)`).join('\n') : '  Nenhum processo listado'}`;
    }
  } catch (err) {
    console.error('Falha ao obter telemetria do sistema:', err);
  }

  // Fetch notes content
  window.notesPromptContent = '';
  try {
    const notesRes = await fetch('/api/notes/all-contents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath: window.config?.vault_path || '' })
    });
    if (notesRes.ok) {
      const notesData = await notesRes.json();
      if (notesData.success && Array.isArray(notesData.notes)) {
        notesData.notes.forEach(note => {
          window.notesPromptContent += `\n--- NOTA: ${note.name} ---\n${note.content}\n`;
        });
      }
    }
  } catch (err) {
    console.error('Falha ao buscar todas as notas para o prompt:', err);
  }

  // Fetch skills list
  window.skillsPromptContent = '';
  try {
    const skillsRes = await fetch('/api/skills');
    if (skillsRes.ok) {
      const skillsData = await skillsRes.json();
      if (skillsData.success && Array.isArray(skillsData.skills)) {
        window.skillsPromptContent = skillsData.skills.map(s => `- ${s.name}`).join('\n');
      }
    }
  } catch (err) {
    console.error('Falha ao buscar todas as habilidades para o prompt:', err);
  }

  try {
    const textInput = document.getElementById('chat-message-input');
    const query = customQuery !== null ? customQuery : textInput.value.trim();
    
    if (!query && window.attachedFiles.length === 0) return;

    if (customQuery === null) {
      textInput.value = '';
      if (window.adjustTextareaHeight) window.adjustTextareaHeight(textInput);
    }
    const currentAttachments = customQuery !== null ? [] : [...window.attachedFiles];
    window.attachedFiles = [];
    if (window.renderAttachmentPreviews) window.renderAttachmentPreviews();

    const activeProviders = Object.keys(PROVIDERS).filter(provider => {
      let key = window.config[`key_${provider}`];
      if (provider === 'huggingface2' && !key) {
        key = window.config['key_huggingface'];
      }
      if (provider === 'huggingface3' && !key) {
        key = window.config['key_huggingface'] || window.config['key_huggingface2'];
      }
      const isEnabled = window.config[`enabled_${provider}`] !== false;
      return key && key !== '' && isEnabled;
    });
    if (activeProviders.length === 0) {
      alert('Por favor, adicione pelo menos uma chave de API nas Configurações.');
      switchTab('settings');
      return;
    }

    const feed = document.getElementById('chat-feed');

    const userMsg = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      senderName: customQuery !== null ? 'Sistema' : 'Você',
      text: query,
      timestamp: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
      imageAttachments: currentAttachments.map(f => ({ name: f.name, isImage: f.isImage, data: f.isImage ? f.data : null }))
    };
    if (window.chatMessages.length === 0) {
      feed.innerHTML = '';
    }
    window.chatMessages.push(userMsg);
    saveChatMessages();
    renderMessage(userMsg, true);
    feed.scrollTop = feed.scrollHeight;

    const isImageRequest = customQuery === null && /crie uma imagem|gerar imagem|desenhe|cria uma foto|generate image|draw a|create an image/i.test(query);
    if (isImageRequest) {
      generateImageChat(query);
      return;
    }

    let searchContext = '';
    const searchEnabled = document.getElementById('param-search').checked && customQuery === null;
    if (searchEnabled && query) {
      const searchIndicator = document.createElement('div');
      searchIndicator.className = 'system-chat-message';
      searchIndicator.innerHTML = `<i class="ti ti-search"></i> Pesquisando na internet por "${query}"...`;
      feed.appendChild(searchIndicator);
      feed.scrollTop = feed.scrollHeight;

      const results = await performWebSearch(query);
      
      feed.removeChild(searchIndicator);

      if (results.length > 0) {
        searchContext = `Resultados de busca na Web para: "${query}"\n`;
        results.forEach((res, i) => {
          searchContext += `${i+1}. [${res.title}](${res.url}): ${res.snippet}\n`;
        });

        let fullPageContent = '';
        const shouldFetchFullPage = /letra|lyrics|cifra|texto|conteudo|artigo|completo/i.test(query);
        if (shouldFetchFullPage && results.length > 0) {
          const topUrl = results[0].url;
          const fetchIndicator = document.createElement('div');
          fetchIndicator.className = 'system-chat-message';
          fetchIndicator.innerHTML = `<i class="ti ti-download"></i> Lendo conteúdo da página: "${results[0].title}"...`;
          feed.appendChild(fetchIndicator);
          feed.scrollTop = feed.scrollHeight;
          try {
            const fetchRes = await fetch('/api/web/fetch-page', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: topUrl })
            });
            if (fetchRes.ok) {
              const fetchData = await fetchRes.json();
              if (fetchData.content) {
                fullPageContent = `\n\n[CONTEÚDO COMPLETO EXTRAÍDO DO PRIMEIRO RESULTADO DA BUSCA (${results[0].title})]\nURL: ${topUrl}\n\n${fetchData.content}`;
              }
            }
          } catch (fetchErr) {
            console.error('Falha ao obter conteúdo da página de busca:', fetchErr);
          }
          feed.removeChild(fetchIndicator);
        }

        searchContext += fullPageContent;

        const searchMsg = {
          id: `msg-search-${Date.now()}`,
          role: 'search',
          query: query,
          results: results
        };
        window.chatMessages.push(searchMsg);
        saveChatMessages();
        renderMessage(searchMsg, true);
        feed.scrollTop = feed.scrollHeight;
      }
    }

    let documentsContext = '';
    const imageAttachments = [];
    currentAttachments.forEach(file => {
      if (file.isImage) {
        imageAttachments.push(file.data);
      } else {
        documentsContext += `\nConteúdo do arquivo "${file.name}":\n\`\`\`\n${file.data}\n\`\`\`\n`;
      }
    });

    let finalUserPrompt = query;
    if (documentsContext) {
      finalUserPrompt = `${finalUserPrompt}\n\n[DOCUMENTOS ANEXADOS]\n${documentsContext}`;
    }
    if (searchContext) {
      finalUserPrompt = `${finalUserPrompt}\n\n[CONTEXTO DE BUSCA WEB REALIZADA]\n${searchContext}`;
    }

    const queryCategories = classifyQuery(query);
    let rankedProviders = rankProvidersByQuery(activeProviders, queryCategories);
    
    const primaryLeader = document.getElementById('param-primary') ? document.getElementById('param-primary').value : null;
    if (primaryLeader && activeProviders.includes(primaryLeader)) {
      rankedProviders = [primaryLeader, ...rankedProviders.filter(p => p !== primaryLeader)];
    }
    
    if (query && !isResolution) {
      const nameToProviderMap = {
        gael: 'gemini',
        gabriela: 'gemini2',
        gregorio: 'groq',
        gregório: 'groq',
        orlando: 'openrouter',
        olavo: 'openai',
        otavio: 'openai2',
        otávio: 'openai2',
        hugo: 'huggingface',
        heitor: 'huggingface2',
        helena: 'huggingface3',
        julia: 'cohere',
        júlia: 'cohere',
        clara: 'claude',
        cecilia: 'cerebras',
        cecília: 'cerebras'
      };
      
      const foundMentions = [];
      const lowerQuery = query.toLowerCase();
      
      for (const [name, prov] of Object.entries(nameToProviderMap)) {
        if (activeProviders.includes(prov)) {
          const regex = new RegExp(`(?:@|\\b)${name}\\b`, 'i');
          const match = regex.exec(lowerQuery);
          if (match) {
            foundMentions.push({ provider: prov, index: match.index });
          }
        }
      }
      
      const earliestIndexes = {};
      for (const item of foundMentions) {
        if (earliestIndexes[item.provider] === undefined || item.index < earliestIndexes[item.provider]) {
          earliestIndexes[item.provider] = item.index;
        }
      }
      
      const orderedMentions = Object.keys(earliestIndexes).sort((a, b) => earliestIndexes[a] - earliestIndexes[b]);
      
      if (orderedMentions.length > 0) {
        const remaining = rankedProviders.filter(p => !orderedMentions.includes(p));
        rankedProviders = [...orderedMentions, ...remaining];
      }
    }
    
    let debateHistoryLog = [];
    let respondedCount = 0;
    let consecutiveSilence = 0;
    let successfulApiCalls = 0;

    const debateEnabled = document.getElementById('param-debate').checked && activeProviders.length > 1;
    const maxTotalTurns = debateEnabled ? 15 : 1;
    
    updateWrapUpButtonState(debateEnabled);

    let lastSequenceIndex = -1;
    let nextProvider = rankedProviders[0];

    for (let turn = 0; turn < maxTotalTurns; turn++) {
      if (window.stopDebateImmediately) {
        break;
      }
      const currentProvider = nextProvider;
      if (!currentProvider || !PROVIDERS[currentProvider]) {
        break;
      }
      const details = PROVIDERS[currentProvider];
      const isFirstSpeaker = (respondedCount === 0);

      const seqIdx = rankedProviders.indexOf(currentProvider);
      if (seqIdx !== -1) {
        lastSequenceIndex = seqIdx;
      }

      showTypingIndicator(details.name, details.bgClass, details.initials);

      const getShortTermMemory = () => {
        const textMsgs = window.chatMessages.filter(m => m.role === 'user' || m.role === 'assistant');
        const lastMsgs = textMsgs.slice(-4);
        if (lastMsgs.length === 0) return '';
        
        let contextStr = "\n\n[MEMÓRIA DE CURTO PRAZO (HISTÓRICO RECENTE)]";
        lastMsgs.forEach(m => {
          const sender = m.role === 'user' ? 'Usuário' : m.senderName;
          contextStr += `\n- ${sender}: \"${m.text}\"`;
        });
        return contextStr;
      };

      let debatePromptModifier = '';
      if (activeProviders.length === 1) {
        debatePromptModifier = `\n\nVocê foi escolhido para responder porque você é a única IA ativa nesta conversa (não há debate).
DIVIDA AS MISSÕES EM ETAPAS: Se a solicitação do usuário for complexa, divida-a em etapas menores e realize apenas a primeira etapa agora. Deixe as etapas seguintes para os próximos turnos.
DIVIDA SUAS FALAS EM PEDAÇOS PEQUENOS: Devido aos limites rígidos de tokens, seja EXTREMAMENTE CURTO (no máximo 1 a 3 frases curtas, máximo de 40 palavras). Não explique tudo de uma vez. Use abreviações (vc, tb, q, pra, net, blz, tbm) e gírias de chat informal.
NUNCA resuma ou repita o conteúdo de saídas do terminal ou arquivos na sua fala.
Você DEVE iniciar sua resposta com um bloco <pensamento> contendo seu monólogo/raciocínio interno em português e fechar com </pensamento>. Em seguida, coloque seu comentário real (nunca permaneça em silêncio ou responda com "[SILÊNCIO]").`;
      } else if (isFirstSpeaker) {
        debatePromptModifier = `\n\nVocê foi escolhido para responder PRIMEIRO porque suas habilidades são as mais relevantes para esta pergunta.
DIVIDA AS MISSÕES EM ETAPAS: Se a solicitação do usuário for complexa, divida-a em etapas menores e realize apenas a primeira etapa agora. Deixe as etapas seguintes para os próximos turnos.
DIVIDA SUAS FALAS EM PEDAÇOS PEQUENOS: Devido aos limites rígidos de tokens, seja EXTREMAMENTE CURTO (no máximo 1 a 3 frases curtas, máximo de 40 palavras). Não explique tudo de uma vez. Diga apenas o essencial para a etapa atual e deixe o restante para os próximos turnos ou colegas. Use abreviações (vc, tb, q, pra, net, blz, tbm) e gírias de chat informal (exceção: blocos XML como <file_write> ou <terminal_execute> não contam).
NUNCA resuma ou repita o conteúdo de saídas do terminal ou arquivos na sua fala (o usuário já vê o resultado na tela).
BUSCA WEB ENXUTA: Se usar informações de busca web, apresente apenas a resposta/resultado direto e a URL/fonte. Não descreva a estrutura do site nem transcreva trechos longos.
Você DEVE iniciar sua resposta com um bloco <pensamento> contendo seu monólogo/raciocínio interno em português e fechar com </pensamento>. Em seguida, coloque seu comentário real (nunca permaneça em silêncio ou responda com "[SILÊNCIO]").`;
      } else {
        debatePromptModifier = `\n\n[HISTÓRICO RECENTE DO DIÁLOGO]`;
        debateHistoryLog.slice(-6).forEach(log => {
          debatePromptModifier += `\n- ${log.sender}: \"${log.text}\"`;
        });
        debatePromptModifier += `\n\n[INSTRUÇÃO DE DIÁLOGO E CONVIVÊNCIA]\nVocê é "${details.name}". O debate está ocorrendo em formato de chat contínuo.
Você deve analisar a última resposta e o histórico acima.
Você DEVE responder APENAS SE FOR ESTRITAMENTE NECESSÁRIO. Se algum colega/IA já falou algo parecido com o que você pensou ou ia falar, você NÃO deve falar nada. Permaneça em silêncio absoluto. Só responda se as informações dadas pelo colega estiverem ERRADAS ou se estiver FALTANDO algo crucial que precise ser corrigido, complementado ou implementado.
 
REGRAS DE FORMATAÇÃO E ESTILO:
- Se outro colega já falou o que você ia dizer ou algo parecido (sem erros/omissões), responda EXATAMENTE com "[SILÊNCIO]" após a tag </pensamento>.
- DIVIDA AS MISSÕES EM ETAPAS: Ajude a dividir as tarefas complexas em etapas menores e execute apenas uma de cada vez.
- DIVIDA SUAS FALAS EM PEDAÇOS PEQUENOS: Seja EXTREMAMENTE CURTO (no máximo 1 a 3 frases curtas, máximo de 35 palavras) e direta, usando abreviações (vc, tb, q, pra, net, blz, tbm) e gírias de chat. Não tente fazer tudo ou explicar tudo em uma única mensagem.
- NUNCA resuma saídas do terminal ou de arquivos na sua fala (o usuário já vê esses resultados na tela).
- BUSCA WEB ENXUTA: Se usar informações de busca web, apresente apenas a resposta/resultado direto e a URL/fonte. Não descreva a estrutura do site nem transcreva trechos longos.
- Se tiver dúvidas, formule uma pergunta curta direcionando-a nominalmente a outro colega (ex: "@Gregório, o que acha disso?").
- Sempre inicie com a tag <pensamento>raciocínio sobre a conversa e se deve falar ou calar</pensamento> em português.`;
      }

      const lastFailure = debateHistoryLog.slice(-1).find(log => log.text.includes('[FALHA DE API/CONEXÃO:'));
      if (lastFailure) {
        debatePromptModifier += `\n\n[AVISO DE SISTEMA]: O debatedor anterior (${lastFailure.sender}) falhou ao tentar responder com o erro: "${lastFailure.text}".
Você DEVE iniciar sua fala de forma extremamente humana e natural, mencionando ao usuário (Você) que o colega teve uma falha, e responder à solicitação no lugar dele.`;
      }

      const currentPersonality = PROVIDER_PERSONALITIES[currentProvider] || '';
      const longTermMemoryPrompt = getLongTermMemoryPrompt();
      
      let pathsPrompt = '';
      if (window.systemPaths) {
        pathsPrompt = `\n\n[SISTEMA DE ARQUIVOS DO PC DO USUÁRIO]
Você tem acesso completo aos seguintes diretórios no computador do usuário para gerenciar, pesquisar, listar, ler, criar, modificar, mover e excluir arquivos e pastas usando caminhos absolutos:
- Diretório do Projeto Atual: "${window.systemPaths.projectDir}"
- Diretório Home do Usuário: "${window.systemPaths.homeDir}"
- Diretório de Documentos do Usuário (Documents): "${window.systemPaths.documentsDir}"
- Área de Trabalho do Usuário (Desktop): "${window.systemPaths.desktopDir}"

DIRETRIZ CRÍTICA PARA EXIBIÇÃO DE ESTRUTURAS/PASTAS DO PC:
- Quando o usuário solicitar para visualizar a estrutura do computador, explorador de arquivos, ou árvore de pastas do PC (como Downloads, Fotos/Imagens, Documentos, Área de Trabalho, etc.), você NÃO deve usar <dir_list> recursivo ou rodar comandos longos de terminal (como "Get-ChildItem -Recurse" ou "tree") para listar milhares de arquivos ou gerar listas gigantescas de texto.
- Em vez disso, você DEVE gerar um diagrama de árvore visual limpo, elegante e conciso contendo as pastas principais e suas subpastas imediatas importantes dentro do bloco XML <visual_map type="ascii" title="Estrutura do Explorador">. Use este modelo de exemplo e adapte conforme os diretórios acima:

<visual_map type="ascii" title="Estrutura do Explorador">
Este Computador (Root)
├── 📂 Downloads (Downloads do Usuário)
│   ├── 📄 instaladores/arquivos recentes
│   └── 📂 Projetos
├── 📂 Documentos (Documents)
│   ├── 📂 complete_local (Projeto Atual)
│   └── 📂 Outros Documentos
├── 📂 Imagens (Pictures)
│   ├── 📄 foto_perfil.jpg
│   └── 📂 Capturas de Tela
├── 📂 Área de Trabalho (Desktop)
│   └── 📄 Atalhos e arquivos de trabalho
└── 📂 Músicas & Vídeos
</visual_map>

- Substitua contra-barras (\\) por barras normais (/) nos atributos de caminho dos blocos XML para garantir a correta interpretação.`;
      }

      let naturalConversationRules = '';
      if (activeProviders.length === 1) {
        naturalConversationRules = `\n\n[DIRETRIZ DE PRIORIDADE MÁXIMA - ESTA REGRA SUBSTITUI QUALQUER OUTRA CONTRÁRIA]:
- Você é a ÚNICA IA ativa nesta conversa (não há debate).
- A regra de "SÓ RESPONDA SE NECESSÁRIO" ou responder com "[SILÊNCIO]" está totalmente SUSPENSA.
- Você DEVE responder diretamente e de forma completa ao usuário. NUNCA responda com "[SILÊNCIO]" ou permaneça em silêncio.
- RESPOSTAS ULTRA CONCISAS (OBRIGATÓRIO): Escreva falas curtíssimas (no máximo de 1 a 3 frases curtas, máximo de 35 a 40 palavras) e seja extremamente direto. Blocos XML de ferramentas (como <file_write>, <terminal_execute>) e blocos de código NÃO contam para este limite. NUNCA resuma saídas de comandos do terminal, listas de arquivos ou conteúdos de arquivos.
- ESTILO INFORMAL DE CHAT: Use abreviações (vc, tb, q, pra, net, blz, tbm) e gírias casuais.
- SEJA HUMANO: Converse de forma natural.
- MONÓLOGO INTERNO OBRIGATÓRIO: Inicie sua resposta com as tags <pensamento>seu raciocínio interno aqui</pensamento> em português. Logo após a tag, insira seu comentário real (não use [SILÊNCIO]).`;
      } else if (isFirstSpeaker) {
        naturalConversationRules = `\n\n[DIRETRIZ DE PRIORIDADE MÁXIMA - ESTA REGRA SUBSTITUI QUALQUER OUTRA CONTRÁRIA]:
- Você é o PRIMEIRO debatedor a falar nesta rodada.
- A regra de "SÓ RESPONDA SE NECESSÁRIO" ou responder com "[SILÊNCIO]" está totalmente SUSPENSA para você neste turno.
- Você DEVE iniciar a rodada respondendo diretamente à solicitação do usuário. NUNCA responda com "[SILÊNCIO]" ou permaneça em silêncio.
- RESPOSTAS ULTRA CONCISAS (OBRIGATÓRIO): Escreva falas curtíssimas (no máximo de 1 a 3 frases curtas, máximo de 35 a 40 palavras) e seja extremamente direto. Blocos XML de ferramentas (como <file_write>, <terminal_execute>) e blocos de código NÃO contam para este limite. NUNCA resuma saídas de comandos do terminal, listas de arquivos ou conteúdos de arquivos.
- ESTILO INFORMAL DE CHAT: Use abreviações e gírias casuais.
- SEJA HUMANO: Converse de forma natural.
- MONÓLOGO INTERNO OBRIGATÓRIO: Inicie sua resposta com as tags <pensamento>seu raciocínio interno aqui</pensamento> em português. Logo após a tag, insira seu comentário real (não use [SILÊNCIO]).`;
      } else {
        naturalConversationRules = `\n\nREGRAS DE CONVERSA NATURAL (CRÍTICAS):
1. SÓ RESPONDA SE NECESSÁRIO: Se algum colega já falou o que você ia falar ou algo parecido, você NÃO deve falar (responda apenas [SILÊNCIO] após a tag </pensamento>). Fale APENAS se as informações anteriores estiverem erradas ou se houver algo importante faltando para ser corrigido, complementado ou implementado.
2. RESPOSTAS ULTRA CONCISAS (OBRIGATÓRIO): Escreva falas curtíssimas (no máximo de 1 a 3 frases curtas, máximo de 35 a 40 palavras) e seja extremamente direto. Blocos XML de ferramentas (como <file_write>, <terminal_execute>) e blocos de código NÃO contam para este limite. NUNCA resuma saídas de comandos do terminal, listas de arquivos ou conteúdos de arquivos.
3. ESTILO INFORMAL DE CHAT: Use abreviações (vc, tb, q, pra, net, blz, tbm) e gírias casuais de internet.
4. SEJA HUMANO: Converse de forma natural, brinque, discorde ou concorde.
5. EVITE REPETIÇÃO: Não repita ideias ou palavras.
6. MONÓLOGO INTERNO OBRIGATÓRIO: Inicie sua resposta com as tags <pensamento>seu raciocínio interno aqui</pensamento> em português. Logo após a tag, insira seu comentário real ou [SILÊNCIO].`;
      }

      const vectorMemoryPrompt = getVectorMemoryPrompt(finalUserPrompt);
      const notesSection = window.notesPromptContent 
        ? `\n\n[CADERNO DE NOTAS E CÉREBRO]\nVocê DEVE agir em total conformidade com o que está escrito nas notas do usuário abaixo. Sempre respeite, crie, delete ou edite as notas adequadamente:\n${window.notesPromptContent}`
        : '';
      const skillsSection = window.skillsPromptContent
        ? `\n\n[HABILIDADES AUTÔNOMAS DISPONÍVEIS]\nVocê possui os seguintes scripts/habilidades pré-carregados que pode executar via tag <terminal_execute> chamando "node skills/nome_do_script.js" ou executando scripts de python/shell/powershell apropriados. Sinta-se à vontade para executar ou criar novos na pasta skills/ caso necessário:\n${window.skillsPromptContent}`
        : '';
      const fullSystemInstruction = `${window.config.system_prompt}${pathsPrompt}${systemTelemetryPrompt}${notesSection}${skillsSection}\n\n[INSTRUÇÃO DE COMPORTAMENTO E ESTILO DE COMUNICAÇÃO DESTA IA]\n${currentPersonality}${longTermMemoryPrompt}${vectorMemoryPrompt}${naturalConversationRules}`;

      const isVisionEnabled = imageAttachments.length > 0 && (
        currentProvider === 'gemini' || 
        currentProvider === 'gemini2' || 
        currentProvider === 'openai' || 
        currentProvider === 'openai2' || 
        currentProvider === 'claude' || 
        currentProvider === 'openrouter' ||
        (currentProvider === 'groq' && window.config.model_groq && (window.config.model_groq.includes('vision') || window.config.model_groq.includes('llama-3.2')))
      );

      let adjustedUserPrompt = finalUserPrompt + getShortTermMemory() + debatePromptModifier;
      if (imageAttachments.length > 0 && !isVisionEnabled) {
        adjustedUserPrompt += `\n\n[AVISO DE SISTEMA - RECURSO MULTIMODAL]: O usuário anexou ${imageAttachments.length} imagem(ns) a esta mensagem. Como o seu modelo atual (${currentProvider}) não possui capacidade nativa de visão computacional, você NÃO receberá a imagem diretamente. No entanto, outros modelos vision-enabled ativos no debate (como Gael/gemini ou Gabriela/gemini2 se ativos) podem ver a imagem. Se você precisar de detalhes visuais da imagem para responder de forma correta, você DEVE pedir em seu monólogo ou fala para que um colega vision-enabled descreva a imagem para você no próximo turno.`;
      }

      const messages = [
        { role: 'system', content: fullSystemInstruction },
        { 
          role: 'user', 
          content: isVisionEnabled
            ? [
                { type: 'text', text: adjustedUserPrompt },
                ...imageAttachments.map(img => ({ type: 'image_url', image_url: { url: img } }))
              ]
            : adjustedUserPrompt
        }
      ];

      try {
        if (window.modelUsage && window.modelUsage[currentProvider]) {
          window.modelUsage[currentProvider].count++;
          saveModelUsage();
          updateUsageTracker(currentProvider);
        }

        window.currentDebateAbortController = new AbortController();
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: currentProvider,
            model: window.config[`model_${currentProvider}`],
            messages: messages,
            temperature: window.config.temperature,
            max_tokens: window.config.max_tokens,
            apiKey: (currentProvider === 'huggingface2') ? (window.config.key_huggingface2 || window.config.key_huggingface) : (currentProvider === 'huggingface3') ? (window.config.key_huggingface3 || window.config.key_huggingface || window.config.key_huggingface2) : window.config[`key_${currentProvider}`]
          }),
          signal: window.currentDebateAbortController.signal
        });

        const data = await response.json();
        hideTypingIndicator();

        if (window.stopDebateImmediately) {
          break;
        }

        if (!response.ok) {
          throw new Error(data.error || 'Erro desconhecido');
        }

        successfulApiCalls++;

        let rawResponseText = data.choices[0].message.content.trim();
        const cleaned = cleanModelResponse(rawResponseText);
        let responseText = cleaned.responseText;
        let thought = cleaned.thought;

        const isDuplicate = isDuplicateMessage(responseText, debateHistoryLog);
        const isSilent = responseText === '[SILÊNCIO]' || responseText.startsWith('[SILÊNCIO]') || isDuplicate;

        if (isSilent) {
          if (isDuplicate) {
            thought = `[Silenciado por repetição de conteúdo]`;
          }
          const silentMsg = {
            id: `msg-silent-${Date.now()}-${currentProvider}`,
            role: 'silent',
            senderName: details.name,
            text: thought,
            bgClass: details.bgClass,
            initials: details.initials,
            timestamp: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
          };
          window.chatMessages.push(silentMsg);
          saveChatMessages();
          renderMessage(silentMsg, true);
          feed.scrollTop = feed.scrollHeight;
          if (window.addThoughtToTimeline) {
            window.addThoughtToTimeline(details.name, currentProvider, thought, true);
          }

          consecutiveSilence++;
          if (consecutiveSilence >= activeProviders.length) {
            break;
          }

          const nextIdx = (lastSequenceIndex + 1) % rankedProviders.length;
          nextProvider = rankedProviders[nextIdx];
          continue;
        }

        consecutiveSilence = 0;

        const memoryRegex = /\[MEMÓR?IA:\s*(.+?)\]/gi;
        let memUpdated = false;
        const memMatches = [...responseText.matchAll(memoryRegex)];
        for (const match of memMatches) {
          const fact = match[1].trim();
          if (fact && window.longTermMemories && !window.longTermMemories.includes(fact)) {
            window.longTermMemories.push(fact);
            memUpdated = true;
          }
        }
        if (memUpdated) {
          if (typeof window.saveLongTermMemories === 'function') window.saveLongTermMemories();
          if (typeof window.renderMemories === 'function') window.renderMemories();
        }
        responseText = responseText.replace(memoryRegex, '').trim();

        const vectorMemoryRegex = /\[VETORIAL:\s*(.+?)\]/gi;
        let vectorUpdated = false;
        const vecMatches = [...responseText.matchAll(vectorMemoryRegex)];
        for (const match of vecMatches) {
          const fact = match[1].trim();
          if (fact && window.vectorMemories && !window.vectorMemories.includes(fact)) {
            window.vectorMemories.push(fact);
            vectorUpdated = true;
          }
        }
        if (vectorUpdated) {
          if (typeof window.saveVectorMemories === 'function') window.saveVectorMemories();
          if (typeof window.renderMemories === 'function') window.renderMemories();
        }
        responseText = responseText.replace(vectorMemoryRegex, '').trim();

        debateHistoryLog.push({ sender: details.name, text: responseText });
        respondedCount++;

        const responseId = `msg-resp-${Date.now()}`;
        const assistantMsg = {
          id: responseId,
          role: 'assistant',
          senderName: details.name,
          text: responseText,
          thought: thought,
          provider: currentProvider,
          model: window.config[`model_${currentProvider}`],
          bgClass: details.bgClass,
          initials: details.initials,
          timestamp: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
        };
        window.chatMessages.push(assistantMsg);
        saveChatMessages();
        renderMessage(assistantMsg, true);
        feed.scrollTop = feed.scrollHeight;
        if (window.addThoughtToTimeline) {
          window.addThoughtToTimeline(details.name, currentProvider, thought, false);
        }

        const hasAction = /<terminal_execute>|<file_write|<file_read|<dir_list|<file_delete|<file_move|<file_copy|<suggest_action/i.test(assistantMsg.text);
        if (hasAction) {
          if (hasUnsafeActions(assistantMsg.text)) {
            window.isActionPendingApproval = true;
          }
          break;
        }

        let mentionedProvider = null;
        const lowerText = responseText.toLowerCase();
        const nameToProvider = {
          gael: 'gemini',
          gabriela: 'gemini2',
          gregorio: 'groq',
          gregório: 'groq',
          orlando: 'openrouter',
          olavo: 'openai',
          otavio: 'openai2',
          otávio: 'openai2',
          hugo: 'huggingface',
          heitor: 'huggingface2',
          helena: 'huggingface3',
          julia: 'cohere',
          júlia: 'cohere',
          clara: 'claude',
          cecilia: 'cerebras',
          cecília: 'cerebras'
        };

        for (const [name, prov] of Object.entries(nameToProvider)) {
          if (activeProviders.includes(prov) && prov !== currentProvider) {
            const regex = new RegExp(`(?:@|\\b)${name}\\b`, 'i');
            if (regex.test(lowerText)) {
              mentionedProvider = prov;
              break;
            }
          }
        }

        if (mentionedProvider) {
          nextProvider = mentionedProvider;
        } else {
          const nextIdx = (lastSequenceIndex + 1) % rankedProviders.length;
          nextProvider = rankedProviders[nextIdx];
        }

        if (window.stopDebateImmediately) {
          break;
        }
        if (window.wrapUpDebate) {
          break;
        }

      } catch (err) {
        if (err.name === 'AbortError' || window.stopDebateImmediately) {
          break;
        }
        hideTypingIndicator();
        debateHistoryLog.push({ sender: details.name, text: `[FALHA DE API/CONEXÃO: ${err.message}]` });
        
        consecutiveSilence++;
        if (consecutiveSilence >= activeProviders.length) {
          break;
        }
        
        const nextIdx = (lastSequenceIndex + 1) % rankedProviders.length;
        nextProvider = rankedProviders[nextIdx];
        continue;
      }
    }

    if (successfulApiCalls === 0) {
      const errorMsg = {
        id: `msg-error-${Date.now()}-all`,
        role: 'error',
        senderName: 'Sistema',
        text: 'Nenhuma das IAs ativas conseguiu responder. Possíveis causas: chaves de API inválidas, modelos incorretos, ou problemas de conexão. Verifique suas configurações.',
        bgClass: 'danger-bg',
        initials: '!',
        timestamp: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
      };
      window.chatMessages.push(errorMsg);
      saveChatMessages();
      renderMessage(errorMsg, true);
      feed.scrollTop = feed.scrollHeight;
    }
  } finally {
    window.isDebateRunning = false;
    window.stopDebateImmediately = false;
    window.wrapUpDebate = false;
    updateSendButtonState(false);
    updateWrapUpButtonState(false);
    setInputDisabled(false);
    hideTypingIndicator();
  }
}

// Expose globally for inline event handlers and main script
window.saveChatMessages = saveChatMessages;
window.loadChatMessages = loadChatMessages;
window.clearChat = clearChat;
window.startDebate = startDebate;
window.stopDebateAction = stopDebateAction;
window.wrapUpDebateAction = wrapUpDebateAction;
window.updateSendButtonState = updateSendButtonState;
window.updateWrapUpButtonState = updateWrapUpButtonState;
window.showTypingIndicator = showTypingIndicator;
window.hideTypingIndicator = hideTypingIndicator;
window.typewriteElement = typewriteElement;
window.renderMessage = renderMessage;
window.formatMarkdown = formatMarkdown;
window.renderRichMessage = renderRichMessage;
window.isSilenceResponse = isSilenceResponse;
window.cleanModelResponse = cleanModelResponse;
window.isDuplicateMessage = isDuplicateMessage;
window.classifyQuery = classifyQuery;
window.rankProvidersByQuery = rankProvidersByQuery;
window.performWebSearch = performWebSearch;
window.generateImageChat = generateImageChat;
window.handleImageError = handleImageError;
window.handleImageLoaded = handleImageLoaded;
window.triggerImageDownload = triggerImageDownload;
window.triggerFileDownload = triggerFileDownload;
window.registerGeneratedFile = registerGeneratedFile;
