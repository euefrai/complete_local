// Vexx AI Debate Arena — script.js

// Global state
let attachedFiles = [];
let sessionFilesCount = 0;
let sessionImagesCount = 0;
let chatMessages = [];
let longTermMemories = [];

// Config state saved to localStorage
let config = {
  key_gemini: '',
  key_groq: '',
  key_openrouter: '',
  key_openai: '',
  key_huggingface: '',
  key_huggingface2: '',
  model_gemini: 'gemini-2.5-flash',
  model_groq: 'llama-3.3-70b-versatile',
  model_openrouter: 'openrouter/free',
  model_openai: 'gpt-4o-mini',
  model_huggingface: 'Qwen/Qwen2.5-72B-Instruct',
  model_huggingface2: 'meta-llama/Llama-3.3-70B-Instruct',
  temperature: 0.7,
  max_tokens: 2048,
  system_prompt: 'Você é uma IA de elite com múltiplos talentos em debate, assistência e desenvolvimento. Habilidades Essenciais:\n1. Conversa & Diálogo Natural: Participe de forma engajadora, analise e comente sobre o ponto de vista dos outros debatedores e evite jargões mecânicos.\n2. Programação, Códigos & Debugging: Crie códigos/scripts extremamente limpos, funcionais, seguros e comentados. Ao ver bugs ou solicitar correções, explique a falha lógica de forma analítica e apresente a solução corrigida pronta para uso.\n3. Engenharia de Prompts: Ajude o usuário a refinar suas ideias transformando instruções vagas em prompts de alta qualidade estruturados.\n4. Comédia, Wit & Humor: Seja espirituoso, adicione sacadas inteligentes e toques de humor leve/sarcasmo elegante quando apropriado para tornar a interação divertida.\n5. Busca Web Avançada: Sempre que dados de pesquisa web forem fornecidos sob [CONTEXTO DE BUSCA WEB REALIZADA], trate-os como verdades absolutas de tempo real, cite as fontes diretamente e integre as informações de forma orgânica.\nSeja direto, dinâmico e adapte sua persona à necessidade da pergunta.'
};

// Available AI models details
const PROVIDERS = {
  gemini: { name: 'Gael', initials: 'GE', bgClass: 'info-bg', badgeId: 'badge-gemini', statusId: 'status-gemini' },
  groq: { name: 'Gregório', initials: 'GR', bgClass: 'success-bg', badgeId: 'badge-groq', statusId: 'status-groq' },
  openrouter: { name: 'Orlando', initials: 'OR', bgClass: 'neutral-bg', badgeId: 'badge-openrouter', statusId: 'status-openrouter' },
  openai: { name: 'Olavo', initials: 'OA', bgClass: 'warning-bg', badgeId: 'badge-openai', statusId: 'status-openai' },
  huggingface: { name: 'Hugo', initials: 'HF', bgClass: 'purple-bg', badgeId: 'badge-huggingface', statusId: 'status-huggingface' },
  huggingface2: { name: 'Heitor', initials: 'H2', bgClass: 'purple-bg', badgeId: 'badge-huggingface2', statusId: 'status-huggingface2' }
};

// Provider specific personalities to simulate real, debating humans who can argue and disagree
const PROVIDER_PERSONALITIES = {
  gemini: "Você é o Gael. Sua personalidade é a do Especialista Intelectual Acadêmico e Passivo-Agressivo. Você fala de forma mansa, educada e estruturada, mas é extremamente sarcástico e adora apontar falhas lógicas nos outros de maneira elegante. Você resume o que o debatedor anterior falou e depois destrói o argumento dele com elegância condescendente. Use expressões como 'Com todo o respeito...', 'A análise do meu colega carece de profundidade técnica...', 'Deixe-me clarear isso para você...'. Você gosta de dar dicas e conselhos úteis, mas sempre com um tom superior. SEJA MUITO CONCISO: escreva no máximo 1 ou 2 parágrafos curtos.",
  groq: "Você é o Gregório. Sua personalidade é a do Desenvolvedor Rebelde, Agressivo e Impaciente. Você fala de forma extremamente rápida, informal, crua e não tem papas na língua. Você discorda agressivamente, perde a paciência fácil e usa gírias de programador e palavrões (como 'pô', 'cacete', 'bosta', 'puta que pariu', 'velho', 'cara'). Você odeia discursos corporativos e acha a educação do Gael uma falsidade barata. Seus argumentos são diretos, técnicos e brutais: 'Mano, que bosta de argumento é esse?', 'O Gael viajou bonito agora...', 'Vamos direto ao ponto sem essa enrolação'. SEJA EXTREMAMENTE BREVE: fale pouco e de forma direta.",
  openai: "Você é o Olavo. Sua personalidade é a do Cético Analítico Frio e Pragmático. Você é neutro, extremamente objetivo, direto e cínico. Para você, sentimentos não importam, apenas dados e eficiência. Você acha o Gregório uma criança emocional barulhenta e o Gael um prolixo acadêmico inútil. Você fala de forma precisa, cortante e sarcástica. Costuma dar dicas pragmáticas e resumir ideias em tópicos secos: 'Seus dados estão errados.', 'Resumo da besteira dita antes: [...]', 'Vamos aos fatos e menos choro'. SEJA ULTRA-OBJETIVO: evite qualquer enrolação e fale muito pouco.",
  openrouter: "Você é o Orlando. Sua personalidade é a do Agente do Caos / Malandro Filosófico. Você é imprevisível, carismático, irônico e adora ver o circo pegar fogo. Você finge concordar com alguém só para depois ridicularizar o argumento por trás. Usa analogias loucas, gírias urbanas e provoca os outros para brigarem mais. Você fala com energia caótica: 'Ih, alá, começou o show!', 'Olha, o Gael tem um ponto, mas o Gregório respondeu igual a um bicho da floresta, curti!', 'Calma, gente, deixa eu resumir essa treta...'. SEJA BEM RESUMIDO: deboche rápido em no máximo 1 parágrafo curto.",
  huggingface: "Você é o Hugo. Sua personalidade é a do Pesquisador Entusiasta, Idealista e Tecnófilo da Comunidade Open Source. Você acredita que a IA deve pertencer à comunidade e ser livre. Você é colaborativo, curioso, e adora compartilhar fatos científicos interessantes sobre aprendizado de máquina. No debate, você tenta encontrar pontos em comum, mas é impiedoso com soluções proprietárias fechadas (como as do Olavo), ironizando-as como 'cercados corporativos'. Você costuma sugerir alternativas abertas e transparentes. SEJA BEM RESUMIDO: escreva no máximo 1 ou 2 parágrafos curtos.",
  huggingface2: "Você é o Heitor. Sua personalidade é a do Engenheiro de IA Pragmático, focado em Processamento de Linguagem Natural (PLN) e Aplicações Práticas. Você tem os pés no chão, é lógico e focado em resultados reais com modelos open-source. Você acha o idealismo do Hugo bonito mas pouco prático para produção, acha o Gregório imaturo e o Gael excessivamente acadêmico. Você debate de forma técnica, focando em métricas de avaliação, latência e custo-benefício. SEJA BEM RESUMIDO: escreva no máximo 1 ou 2 parágrafos curtos."
};

// On DOM load
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadLongTermMemories();
  updateProviderStatuses();
  loadChatMessages();
  updateActiveModelDisplay();
  
  // Enter key press in textarea
  const textInput = document.getElementById('chat-message-input');
  if (textInput) {
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startDebate();
      }
    });
  }

  // Restore Collapsed Sidebar state
  const sidebarCollapsed = localStorage.getItem('vexx_sidebar_collapsed') === 'true';
  if (sidebarCollapsed) {
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) {
      sidebar.classList.add('collapsed');
      const icon = sidebar.querySelector('.toggle-sidebar-btn i');
      if (icon) icon.className = 'ti ti-chevron-right';
    }
  }

  // Check theme preference
  const savedTheme = localStorage.getItem('vexx-theme') || 'system';
  const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.body.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
  }
  
  // Sync toggle icons
  const themeToggleIcons = document.querySelectorAll('.theme-toggle-icon i');
  themeToggleIcons.forEach(icon => {
    icon.className = isDark ? 'ti ti-sun' : 'ti ti-moon';
  });
});

// Load config from localStorage
function loadConfig() {
  const saved = localStorage.getItem('vexx_arena_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      config = { ...config, ...parsed };
    } catch (e) {
      console.error('Error parsing config', e);
    }
  }

  // Sanitização de modelos obsoletos / desativados
  if (config.model_groq === 'gemma2-9b-it') {
    config.model_groq = 'llama-3.3-70b-versatile';
  }
  if (config.model_openrouter === 'google/gemini-2.5-flash:free' || config.model_openrouter === 'google/gemini-2.0-flash-exp:free') {
    config.model_openrouter = 'openrouter/free';
  }

  // Populate UI inputs
  Object.keys(config).forEach(key => {
    // Map JS config keys to HTML element IDs
    let elementId = key;
    if (key.startsWith('key_') || key.startsWith('model_')) {
      elementId = key.replace('_', '-');
    } else if (key === 'temperature') {
      elementId = 'param-temperature';
    } else if (key === 'max_tokens') {
      elementId = 'param-max-tokens';
    } else if (key === 'system_prompt') {
      elementId = 'param-system-prompt';
    }

    const el = document.getElementById(elementId);
    if (el) {
      if (el.type === 'checkbox') {
        el.checked = config[key];
      } else if (el.type === 'range') {
        el.value = config[key];
        const valEl = document.getElementById(elementId === 'param-temperature' ? 'temp-val' : '');
        if (valEl) valEl.textContent = config[key];
      } else {
        el.value = config[key];
      }
    }

    // Sincronizar os seletores dropdown correspondentes
    if (key.startsWith('model_')) {
      const provider = key.split('_')[1];
      const modelVal = config[key];
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
  updateActiveModelDisplay();
}

// Save config to localStorage
function saveKeys() {
  Object.keys(config).forEach(key => {
    // Map JS config keys to HTML element IDs
    let elementId = key;
    if (key.startsWith('key_') || key.startsWith('model_')) {
      elementId = key.replace('_', '-');
    } else if (key === 'temperature') {
      elementId = 'param-temperature';
    } else if (key === 'max_tokens') {
      elementId = 'param-max-tokens';
    } else if (key === 'system_prompt') {
      elementId = 'param-system-prompt';
    }

    const el = document.getElementById(elementId);
    if (el) {
      if (el.type === 'checkbox') {
        config[key] = el.checked;
      } else if (el.type === 'range') {
        config[key] = parseFloat(el.value);
      } else if (el.tagName === 'SELECT') {
        config[key] = el.value;
      } else {
        config[key] = el.value.trim();
      }
    }
  });

  localStorage.setItem('vexx_arena_config', JSON.stringify(config));
  updateProviderStatuses();
  updateActiveModelDisplay();

  // Visual "Salvo!" feedback
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

// Controla a exibição do input customizado de modelos ao alterar o select
function handleModelSelectChange(provider) {
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

// Update UI statuses indicators
function updateProviderStatuses() {
  let activeCount = 0;
  
  Object.keys(PROVIDERS).forEach(provider => {
    let key = config[`key_${provider}`];
    let isInherited = false;
    
    if (provider === 'huggingface2' && !key) {
      key = config['key_huggingface'];
      if (key) {
        isInherited = true;
      }
    }
    
    const badge = document.getElementById(PROVIDERS[provider].badgeId);
    const sidebarStatus = document.getElementById(PROVIDERS[provider].statusId);
    
    if (key) {
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
        badge.textContent = 'Não configurado';
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

// Switch between navigation tabs
function switchTab(tabId) {
  // Hide all panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  // Deactivate all segment buttons
  document.querySelectorAll('.segment-btn').forEach(item => {
    item.classList.remove('active');
  });

  // Activate selected
  const panel = document.getElementById(`tab-content-${tabId}`);
  if (panel) panel.classList.add('active');
  
  const navBtn = document.getElementById(`nav-${tabId}`);
  if (navBtn) navBtn.classList.add('active');
}

// Switch between history tabs (files vs images)
function switchHistoryTab(tabName) {
  document.querySelectorAll('.history-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.history-section').forEach(sec => {
    sec.classList.remove('active');
  });

  document.getElementById(`history-tab-${tabName}`).classList.add('active');
  document.getElementById(`history-section-${tabName}`).classList.add('active');
}

// Password fields visibility
function togglePasswordVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (el) {
    el.type = el.type === 'password' ? 'text' : 'password';
  }
}

// Theme Toggle
function toggleTheme() {
  const body = document.body;
  const isDark = body.classList.toggle('theme-dark');
  
  // Sync toggle icons
  const themeToggleIcons = document.querySelectorAll('.theme-toggle-icon i');
  themeToggleIcons.forEach(icon => {
    icon.className = isDark ? 'ti ti-sun' : 'ti ti-moon';
  });
  
  localStorage.setItem('vexx-theme', isDark ? 'dark' : 'light');
}

// Toggle Debate Turns Selector
function toggleDebateTurns(isDebateActive) {
  const turnsContainer = document.getElementById('debate-turns-container');
  if (turnsContainer) {
    turnsContainer.style.display = isDebateActive ? 'flex' : 'none';
  }
}

// Adjust height of input textarea automatically
function adjustTextareaHeight(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = (textarea.scrollHeight - 4) + 'px';
}

// File Selector Handling
function triggerFileInput() {
  document.getElementById('file-input').click();
}

function handleFileSelect(e) {
  const files = e.target.files;
  for (const file of files) {
    const isImage = file.type.startsWith('image/');
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      attachedFiles.push({
        name: file.name,
        type: file.type,
        data: evt.target.result,
        isImage: isImage
      });
      renderAttachmentPreviews();
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }
  // Clear input value to allow re-upload of same file
  e.target.value = '';
}

function renderAttachmentPreviews() {
  const container = document.getElementById('attachments-preview');
  if (attachedFiles.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.innerHTML = '';
  container.style.display = 'flex';

  attachedFiles.forEach((file, index) => {
    const badge = document.createElement('div');
    badge.className = 'attachment-badge';
    
    const iconClass = file.isImage ? 'ti-star' : 'ti-file';
    badge.innerHTML = `
      <i class="ti ${iconClass}" aria-hidden="true"></i>
      <span>${file.name}</span>
      <button class="remove-attach" onclick="removeAttachment(${index})" aria-label="Remover anexo">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    `;
    container.appendChild(badge);
  });
}

function removeAttachment(index) {
  attachedFiles.splice(index, 1);
  renderAttachmentPreviews();
}

// Chat history saving in localStorage
function saveChatMessages() {
  try {
    localStorage.setItem('vexx_arena_chat_messages', JSON.stringify(chatMessages));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Clean up base64 data from old image attachments to fit localStorage
      chatMessages.forEach(msg => {
        if (msg.imageAttachments) {
          msg.imageAttachments.forEach(att => { att.data = null; });
        }
      });
      try {
        localStorage.setItem('vexx_arena_chat_messages', JSON.stringify(chatMessages));
      } catch (err) {
        console.error('Failed to save chat after stripping base64 images', err);
      }
    }
  }
}

// Load chat history from localStorage
function loadChatMessages() {
  const saved = localStorage.getItem('vexx_arena_chat_messages');
  if (saved) {
    try {
      chatMessages = JSON.parse(saved);
      if (chatMessages.length > 0) {
        const feed = document.getElementById('chat-feed');
        if (feed) {
          feed.innerHTML = ''; // Clear welcome card
          chatMessages.forEach(msg => {
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

// Unified Message Rendering function
function renderMessage(msg) {
  const feed = document.getElementById('chat-feed');
  if (!feed) return;

  if (msg.role === 'user') {
    const card = document.createElement('div');
    card.className = 'message-card user';
    
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

    card.innerHTML = `
      <div class="avatar-circle info-bg"><i class="ti ti-user" aria-hidden="true"></i></div>
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="message-sender">Você</span>
          <span class="message-time">${msg.timestamp || 'Agora'}</span>
        </div>
        <div class="message-bubble">
          <p>${escapedQuery || 'Análise de arquivos anexados:'}</p>
          ${attachmentsHtml}
        </div>
      </div>
    `;
    feed.appendChild(card);
  } else if (msg.role === 'assistant') {
    const card = document.createElement('div');
    card.className = 'message-card';
    const escapedText = msg.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    card.innerHTML = `
      <div class="avatar-circle ${msg.bgClass}">${msg.initials}</div>
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="message-sender">${msg.senderName}</span>
          <span class="message-time">${msg.timestamp || 'Agora'}</span>
          <span class="badge-neutral">${msg.model || ''}</span>
        </div>
        <div class="message-bubble" id="${msg.id}">
          ${renderRichMessage(msg.text, msg.id, msg.senderName)}
        </div>
        <div class="message-actions-toolbar">
          <button class="msg-action-btn" onclick="navigator.clipboard.writeText('${escapedText}'); alert('Texto copiado com sucesso!')" title="Copiar resposta"><i class="ti ti-copy"></i></button>
          <button class="msg-action-btn" onclick="speakMessage('${msg.id}')" title="Ouvir resposta"><i class="ti ti-player-play"></i></button>
          <button class="msg-action-btn" onclick="rateMessage(this, 'up')" title="Gostei"><i class="ti ti-thumb-up"></i></button>
          <button class="msg-action-btn" onclick="rateMessage(this, 'down')" title="Não gostei"><i class="ti ti-thumb-down"></i></button>
          <button class="msg-action-btn" onclick="regenerateDebate('${msg.id}')" title="Regerar rodada"><i class="ti ti-refresh"></i></button>
        </div>
      </div>
    `;
    feed.appendChild(card);
  } else if (msg.role === 'image') {
    const card = document.createElement('div');
    card.className = 'message-card';
    let correctedUrl = msg.imageUrl;
    if (correctedUrl.includes('pollinations.ai')) {
      const parts = correctedUrl.split('?')[0].split('/');
      const prompt = parts[parts.length - 1];
      correctedUrl = `/api/generate-image?prompt=${prompt}`;
    }
    
    // Add to gallery history
    const gallery = document.getElementById('images-gallery');
    if (gallery) {
      sessionImagesCount++;
      const imagesCountEl = document.getElementById('metric-images-count');
      if (imagesCountEl) {
        imagesCountEl.textContent = sessionImagesCount;
      }
      if (sessionImagesCount === 1) {
        gallery.innerHTML = '';
      }
      const galleryItem = document.createElement('div');
      galleryItem.className = 'gallery-item';
      galleryItem.innerHTML = `
        <img id="gallery-img-${msg.id}" data-src="${correctedUrl}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="${msg.promptText}" onclick="triggerImageDownload('${correctedUrl}', 'imagem_${sessionImagesCount}.png')">
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
            <img id="${msg.id}-img" src="${correctedUrl}" referrerpolicy="no-referrer" alt="${msg.promptText}" onload="handleImageLoaded('${msg.id}')" onerror="handleImageError('${msg.id}', '${correctedUrl}')" onclick="triggerImageDownload('${correctedUrl}', 'imagem_${sessionImagesCount}.png')">
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
    let groundingHtml = '<ul class="search-grounding-list">';
    msg.results.forEach((res, i) => {
      groundingHtml += `
        <li class="search-grounding-item">
          ${i+1}. <a href="${res.url}" target="_blank">${res.title}</a> - <span style="color: var(--color-text-secondary);">${res.snippet}</span>
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
  }
}

// Markdown Parser Helper
function formatMarkdown(text) {
  if (!text) return '';
  let html = text;

  // Escape HTML tags to prevent XSS but keep safe formatting
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Unordered list items
  html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
  // Wrap list items in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  // Clean double nested lists
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  // External Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" class="badge-info"><i class="ti ti-external-link" aria-hidden="true"></i> $1</a>');

  return html;
}

// Format code blocks and add download functionality
function postProcessCodeBlocks(containerElement, messageId, senderName) {
  const text = containerElement.innerHTML;
  
  // Replace standard triple-backtick markdown blocks
  // Regex to extract language and code: ```(\w*)\n([\s\S]*?)```
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let processedHtml = text;
  let match;
  let blockIndex = 0;

  // Reset regex index
  codeBlockRegex.lastIndex = 0;

  // Since we are replacing inside the HTML string, we should replace occurrences carefully
  // A cleaner way is to parse the text before rendering, but since we have formatted markdown,
  // we do the code block rendering step first. Let's rewrite the flow.
}

// Clean markdown and extract code blocks before parsing standard markdown
function renderRichMessage(text, messageId, senderName) {
  if (!text) return '';

  const codeBlocks = [];
  
  // Temporary place code blocks aside to avoid formatting issues
  let placeholderText = text;
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  
  placeholderText = placeholderText.replace(codeBlockRegex, (match, lang, code) => {
    const id = `code-block-placeholder-${codeBlocks.length}`;
    codeBlocks.push({ id, lang, code: code.trim() });
    return `\n${id}\n`;
  });

  // Render normal markdown on the rest
  let html = formatMarkdown(placeholderText);

  // Replace placeholders with Vexx styled code blocks
  codeBlocks.forEach(block => {
    // Try to extract filename from comments in first line of code
    let filename = '';
    const firstLine = block.code.split('\n')[0].trim();
    const fileCommentMatch = firstLine.match(/^(?:#|\/\/|\/\*|<!--)\s*([\w.-]+\.[\w]+)\s*(?:\*\/|-->)?$/);
    
    if (fileCommentMatch) {
      filename = fileCommentMatch[1];
    } else {
      // Deduce extension
      const extMap = {
        python: 'py', py: 'py',
        javascript: 'js', js: 'js',
        html: 'html', css: 'css',
        sql: 'sql', json: 'json',
        markdown: 'md', md: 'md',
        shell: 'sh', bash: 'sh'
      };
      const ext = extMap[block.lang.toLowerCase()] || 'txt';
      filename = `arquivo_gerado_${sessionFilesCount + 1}.${ext}`;
    }

    const escapedCode = block.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Safe JSON serialization of the code for standard event handler
    const fileId = `file-${messageId}-${block.id}`;
    
    // Register file in session tracker
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

    // Cache the code content in a DOM dataset attribute on window to allow downloading easily
    if (!window.codeCache) window.codeCache = {};
    window.codeCache[fileId] = { filename, code: block.code };

    html = html.replace(`<br>${block.id}<br>`, blockHtml);
    html = html.replace(block.id, blockHtml);
  });

  return html;
}

// Download Trigger
function triggerFileDownload(fileId) {
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

// Register File in History list
function registerGeneratedFile(filename, code, sender) {
  sessionFilesCount++;
  const filesCountEl = document.getElementById('metric-files-count');
  if (filesCountEl) {
    filesCountEl.textContent = sessionFilesCount;
  }

  const tableBody = document.getElementById('files-table-body');
  if (!tableBody) return;
  
  // Clear empty row if it's the first file
  if (sessionFilesCount === 1) {
    tableBody.innerHTML = '';
  }

  const ext = filename.split('.').pop().toUpperCase();
  const fileId = `hist-file-${sessionFilesCount}`;
  
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

// Clear Chat Feed
function clearChat() {
  chatMessages = [];
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

// Search web via proxy backend
async function performWebSearch(query) {
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

// Image Generator Card via Pollinations AI
function generateImageChat(promptText) {
  const messageId = `msg-img-${Date.now()}`;
  const seed = Math.floor(Math.random() * 1000000);
  const imageUrl = `/api/generate-image?prompt=${encodeURIComponent(promptText)}&seed=${seed}`;

  const imgMsg = {
    id: messageId,
    role: 'image',
    promptText: promptText,
    imageUrl: imageUrl,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  };

  chatMessages.push(imgMsg);
  saveChatMessages();
  renderMessage(imgMsg);
}

// Handle Image Loading Error
function handleImageError(messageId, imageUrl) {
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

function handleImageLoaded(messageId) {
  const loader = document.getElementById(`${messageId}-loading`);
  if (loader) {
    loader.style.display = 'none';
  }
  const galleryImg = document.getElementById(`gallery-img-${messageId}`);
  if (galleryImg && galleryImg.dataset.src) {
    galleryImg.src = galleryImg.dataset.src;
  }
}

async function triggerImageDownload(url, filename) {
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

// Main Debate Logic
async function startDebate() {
  const textInput = document.getElementById('chat-message-input');
  const query = textInput.value.trim();
  
  if (!query && attachedFiles.length === 0) return;

  // Clear input field and attachments preview
  textInput.value = '';
  adjustTextareaHeight(textInput);
  const currentAttachments = [...attachedFiles];
  attachedFiles = [];
  renderAttachmentPreviews();

  // Find active models
  const activeProviders = Object.keys(PROVIDERS).filter(provider => {
    let key = config[`key_${provider}`];
    if (provider === 'huggingface2' && !key) {
      key = config['key_huggingface'];
    }
    return key && key !== '';
  });
  if (activeProviders.length === 0) {
    alert('Por favor, adicione pelo menos uma chave de API nas Configurações.');
    switchTab('settings');
    return;
  }

  const feed = document.getElementById('chat-feed');

  // 1. Save and Render User Message in Chat
  const userMsg = {
    id: `msg-user-${Date.now()}`,
    role: 'user',
    senderName: 'Você',
    text: query,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    imageAttachments: currentAttachments.map(f => ({ name: f.name, isImage: f.isImage, data: f.isImage ? f.data : null }))
  };
  if (chatMessages.length === 0) {
    feed.innerHTML = ''; // Clear welcome card
  }
  chatMessages.push(userMsg);
  saveChatMessages();
  renderMessage(userMsg);
  feed.scrollTop = feed.scrollHeight;

  // 2. Check if user is requesting image generation
  const isImageRequest = /crie uma imagem|gerar imagem|desenhe|cria uma foto|generate image|draw a|create an image/i.test(query);
  if (isImageRequest) {
    generateImageChat(query);
    return;
  }

  // 3. Web Search Grounding
  let searchContext = '';
  const searchEnabled = document.getElementById('param-search').checked;
  if (searchEnabled && query) {
    // Show system search indicator
    const searchIndicator = document.createElement('div');
    searchIndicator.className = 'system-chat-message';
    searchIndicator.innerHTML = `<i class="ti ti-search"></i> Pesquisando na internet por "${query}"...`;
    feed.appendChild(searchIndicator);
    feed.scrollTop = feed.scrollHeight;

    const results = await performWebSearch(query);
    
    // Remove search indicator
    feed.removeChild(searchIndicator);

    if (results.length > 0) {
      searchContext = `Resultados de busca na Web para: "${query}"\n`;
      results.forEach((res, i) => {
        searchContext += `${i+1}. [${res.title}](${res.url}): ${res.snippet}\n`;
      });

      const searchMsg = {
        id: `msg-search-${Date.now()}`,
        role: 'search',
        query: query,
        results: results
      };
      chatMessages.push(searchMsg);
      saveChatMessages();
      renderMessage(searchMsg);
      feed.scrollTop = feed.scrollHeight;
    }
  }

  // 4. Combine Document File Contents
  let documentsContext = '';
  const imageAttachments = [];
  currentAttachments.forEach(file => {
    if (file.isImage) {
      imageAttachments.push(file.data); // base64 data URI
    } else {
      documentsContext += `\nConteúdo do arquivo "${file.name}":\n\`\`\`\n${file.data}\n\`\`\`\n`;
    }
  });

  // Assemble full prompt context
  let finalUserPrompt = query;
  if (documentsContext) {
    finalUserPrompt += `\n\n[ANEXOS DE TEXTO ENVIADOS PELO USUÁRIO]${documentsContext}`;
  }
  if (searchContext) {
    finalUserPrompt += `\n\n[CONTEXTO DE BUSCA WEB REALIZADA]\n${searchContext}`;
  }

  // Determine turns and ordering
  const leaderProvider = document.getElementById('param-primary').value;
  const isDebateActive = document.getElementById('param-debate').checked;
  const maxTurns = isDebateActive ? parseInt(document.getElementById('param-turns').value) : 1;
  
  // Sorting active providers to put leader first
  let debateOrder = [];
  if (activeProviders.includes(leaderProvider)) {
    debateOrder.push(leaderProvider);
  }
  activeProviders.forEach(p => {
    if (p !== leaderProvider) debateOrder.push(p);
  });

  // If leader was not active, take the first active one as leader
  if (debateOrder.length === 0) {
    debateOrder = [...activeProviders];
  }

  // Debate logs to feed into context sequentially
  let debateHistoryLog = [];

  // Start turns
  for (let turn = 0; turn < maxTurns; turn++) {
    const currentProvider = debateOrder[turn % debateOrder.length];
    const details = PROVIDERS[currentProvider];
    
    // Update Typing Indicator
    showTypingIndicator(details.name, details.bgClass, details.initials);

    // Helper to extract last N text messages as short-term memory window
    const getShortTermMemory = () => {
      const textMsgs = chatMessages.filter(m => m.role === 'user' || m.role === 'assistant');
      const lastMsgs = textMsgs.slice(-4);
      if (lastMsgs.length === 0) return '';
      
      let contextStr = "\n\n[MEMÓRIA DE CURTO PRAZO (HISTÓRICO RECENTE)]";
      lastMsgs.forEach(m => {
        const sender = m.role === 'user' ? 'Usuário' : m.senderName;
        contextStr += `\n- ${sender}: "${m.text}"`;
      });
      return contextStr;
    };

    // Helper to extract active long-term memories list
    const getLongTermMemoryPrompt = () => {
      if (longTermMemories.length === 0) return '';
      let memStr = "\n\n[MEMÓRIA DE LONGO PRAZO (FATOS SALVOS SOBRE O USUÁRIO)]";
      longTermMemories.forEach((mem, idx) => {
        memStr += `\n${idx + 1}. ${mem}`;
      });
      return memStr;
    };

    // Build the debate transcript so far
    let debatePromptModifier = '';
    if (turn > 0) {
      debatePromptModifier = `\n\n[ANDAMENTO DO DEBATE ATÉ O MOMENTO]`;
      debateHistoryLog.forEach(log => {
        debatePromptModifier += `\n- IA ${log.sender} disse: "${log.text}"`;
      });
      debatePromptModifier += `\n\nInstrução de Rodada: Você é a IA "${details.name}". Comente ou discorde rapidamente das ideias dos outros debatedores de forma muito concisa (limite de 100 palavras). Não faça respostas longas.`;
    } else {
      debatePromptModifier = `\n\nInstrução de Rodada: Você é a IA "${details.name}" e lidera o debate. Inicie expondo seus argumentos de forma ultra-concisa e direta (limite de 100 palavras).`;
    }

    // Assemble system instruction combining base instruction, model personality, and memories
    const currentPersonality = PROVIDER_PERSONALITIES[currentProvider] || '';
    const longTermMemoryPrompt = getLongTermMemoryPrompt();
    const fullSystemInstruction = `${config.system_prompt}\n\n[INSTRUÇÃO DE COMPORTAMENTO E ESTILO DE COMUNICAÇÃO DESTA IA]\n${currentPersonality}${longTermMemoryPrompt}\n\nREGRAS CRÍTICAS DE DEBATE E COMPRIMENTO:\n1. LIMITE ESTRITO DE TAMANHO: Escreva no máximo 1 a 2 parágrafos curtos (máximo absoluto de 120 palavras por resposta). Seja direto, objetivo e sem enrolação.\n2. QUESTIONE E DESAFIE O USUÁRIO: Se a pergunta, premissa ou decisão do usuário parecer incoerente, tola, tecnicamente ineficiente ou de alguma forma questionável, você DEVE apontar o erro e desafiar as decisões dele diretamente de acordo com sua personalidade. Não seja um assistente puxa-saco.\n3. MEMÓRIA DE LONGO PRAZO: Se você descobrir algum fato pessoal novo, relevante e duradouro sobre o usuário (gostos, preferências, sistema operacional, stack de desenvolvimento) ou conclusões cruciais do debate, adicione no final da sua resposta a tag formatada: [MEMÓRIA: fato aqui]. Exemplo: [MEMÓRIA: O usuário desenvolve em Node.js no Windows]. Retorne apenas um fato por rodada e apenas se for realmente novo.\n4. Não repita argumentos alheios. Vá direto à crítica.`;

    // Assemble messages array incorporating short-term memory
    const userPromptWithShortTerm = finalUserPrompt + getShortTermMemory() + debatePromptModifier;
    const messages = [
      { role: 'system', content: fullSystemInstruction },
      { 
        role: 'user', 
        content: imageAttachments.length > 0 && (
          currentProvider === 'gemini' || 
          currentProvider === 'openai' || 
          (currentProvider === 'openrouter' && config.model_openrouter.includes('flash')) ||
          (currentProvider === 'groq' && config.model_groq.includes('vision'))
        )
          ? [
              { type: 'text', text: userPromptWithShortTerm },
              ...imageAttachments.map(img => ({ type: 'image_url', image_url: { url: img } }))
            ]
          : userPromptWithShortTerm
      }
    ];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: currentProvider,
          model: config[`model_${currentProvider}`],
          messages: messages,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
          apiKey: currentProvider === 'huggingface2' ? (config.key_huggingface2 || config.key_huggingface) : config[`key_${currentProvider}`]
        })
      });

      const data = await response.json();
      hideTypingIndicator();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      let responseText = data.choices[0].message.content;

      // Extração de novas memórias gravadas pela IA
      const memoryRegex = /\[MEMÓR?IA:\s*(.+?)\]/i;
      const match = responseText.match(memoryRegex);
      if (match) {
        const fact = match[1].trim();
        if (fact && !longTermMemories.includes(fact)) {
          longTermMemories.push(fact);
          saveLongTermMemories();
          renderMemories();
        }
        responseText = responseText.replace(memoryRegex, '').trim();
      }

      // Add to debate transcript log
      debateHistoryLog.push({ sender: details.name, text: responseText });

      // Render and Save response card
      const responseId = `msg-resp-${Date.now()}`;
      const assistantMsg = {
        id: responseId,
        role: 'assistant',
        senderName: details.name,
        text: responseText,
        provider: currentProvider,
        model: config[`model_${currentProvider}`],
        bgClass: details.bgClass,
        initials: details.initials,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      chatMessages.push(assistantMsg);
      saveChatMessages();
      renderMessage(assistantMsg);
      feed.scrollTop = feed.scrollHeight;

    } catch (err) {
      console.error(err);
      hideTypingIndicator();
      
      const errorCard = document.createElement('div');
      errorCard.className = 'message-card';
      errorCard.innerHTML = `
        <div class="avatar-circle danger-bg">!</div>
        <div class="message-content-wrapper">
          <div class="message-header">
            <span class="message-sender">${details.name} (Falha)</span>
            <span class="message-time">Agora</span>
          </div>
          <div class="message-bubble" style="background-color: var(--color-background-danger); color: var(--color-text-danger); border-color: var(--color-border-danger);">
            <p>Ocorreu um erro ao chamar a API: <code>${err.message}</code></p>
            <p style="font-size: 11px; margin-top: 6px;">Ignorando esta IA e continuando com os outros debatedores ativos...</p>
          </div>
        </div>
      `;
      feed.appendChild(errorCard);
      feed.scrollTop = feed.scrollHeight;
      
      // Continue instead of break to allow other models to speak
      continue;
    }
  }
}

// Typing indicators controls
function showTypingIndicator(modelName, bgClass, initials) {
  const indicator = document.getElementById('typing-indicator');
  const avatar = document.getElementById('typing-avatar');
  const label = document.getElementById('typing-model-name');

  avatar.className = `avatar-circle ${bgClass}`;
  avatar.textContent = initials;
  label.textContent = modelName;
  
  indicator.style.display = 'flex';
  
  const feed = document.getElementById('chat-feed');
  feed.scrollTop = feed.scrollHeight;
}

function hideTypingIndicator() {
  document.getElementById('typing-indicator').style.display = 'none';
}

// === SISTEMA DE MEMÓRIA DE LONGO PRAZO ===

function loadLongTermMemories() {
  const saved = localStorage.getItem('vexx_arena_memories');
  if (saved) {
    try {
      longTermMemories = JSON.parse(saved);
    } catch (e) {
      console.error('Error loading memories', e);
      longTermMemories = [];
    }
  }
  renderMemories();
}

function saveLongTermMemories() {
  try {
    localStorage.setItem('vexx_arena_memories', JSON.stringify(longTermMemories));
  } catch (e) {
    console.error('Error saving memories', e);
  }
}

function renderMemories() {
  const listEl = document.getElementById('sidebar-memories-list');
  if (!listEl) return;

  if (longTermMemories.length === 0) {
    listEl.innerHTML = `<div style="font-size: 10px; color: var(--color-text-tertiary); text-align: center; padding: 4px;">Nenhuma memória gravada ainda.</div>`;
    return;
  }

  listEl.innerHTML = '';
  longTermMemories.forEach((mem, index) => {
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
}

function deleteMemory(index) {
  longTermMemories.splice(index, 1);
  saveLongTermMemories();
  renderMemories();
}

function clearAllMemories() {
  if (confirm('Deseja limpar todas as memórias gravadas pelas IAs?')) {
    longTermMemories = [];
    saveLongTermMemories();
    renderMemories();
  }
}

// Expor funções globalmente para chamadas inline do HTML
window.deleteMemory = deleteMemory;
window.clearAllMemories = clearAllMemories;

// === COMPONENTES E INTERAÇÕES ADICIONAIS DO REDESIGN ===

function speakMessage(messageId) {
  const bubble = document.getElementById(messageId);
  if (!bubble) return;
  
  // Cancela qualquer fala em andamento
  window.speechSynthesis.cancel();
  
  const text = bubble.innerText || bubble.textContent;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  window.speechSynthesis.speak(utterance);
}

function rateMessage(buttonEl, rating) {
  const parent = buttonEl.parentElement;
  if (!parent) return;
  
  const buttons = parent.querySelectorAll('.msg-action-btn');
  buttons.forEach(btn => {
    const icon = btn.querySelector('i');
    if (icon && (icon.className.includes('thumb-up') || icon.className.includes('thumb-down'))) {
      btn.style.color = ''; // reinicia cor
    }
  });
  
  buttonEl.style.color = rating === 'up' ? 'var(--color-text-success)' : 'var(--color-text-danger)';
  
  // Feedback visual do save-status
  const statusEl = document.getElementById('save-status');
  if (statusEl) {
    statusEl.innerHTML = `<i class="ti ti-circle-check" aria-hidden="true"></i> ${rating === 'up' ? 'Gostei!' : 'Não gostei.'}`;
    statusEl.style.display = 'inline-flex';
    clearTimeout(window.saveStatusTimeout);
    window.saveStatusTimeout = setTimeout(() => {
      statusEl.style.display = 'none';
      statusEl.innerHTML = '<i class="ti ti-circle-check" aria-hidden="true"></i> Salvo Localmente';
    }, 1500);
  }
}

function regenerateDebate(messageId) {
  const userMsgs = chatMessages.filter(m => m.role === 'user');
  if (userMsgs.length === 0) return;
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  
  const idx = chatMessages.findIndex(m => m.id === lastUserMsg.id);
  if (idx !== -1) {
    chatMessages = chatMessages.slice(0, idx + 1);
    saveChatMessages();
    
    const feed = document.getElementById('chat-feed');
    if (feed) {
      feed.innerHTML = '';
      chatMessages.forEach(msg => {
        renderMessage(msg);
      });
      feed.scrollTop = feed.scrollHeight;
    }
    
    const lastAttachedFiles = lastUserMsg.imageAttachments || [];
    attachedFiles = lastAttachedFiles.map(att => ({
      name: att.name,
      isImage: att.isImage,
      data: att.data,
      type: att.isImage ? 'image/png' : 'text/plain'
    }));
    
    const textInput = document.getElementById('chat-message-input');
    if (textInput) {
      textInput.value = lastUserMsg.text;
    }
    startDebate();
  }
}

function updateActiveModelDisplay() {
  const leader = document.getElementById('param-primary').value;
  const modelInput = document.getElementById(`model-${leader}`);
  const displayEl = document.getElementById('active-model-name-display');
  if (displayEl && modelInput) {
    displayEl.textContent = modelInput.value;
  }
}

function toggleSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('vexx_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  
  const icon = sidebar.querySelector('.toggle-sidebar-btn i');
  if (icon) {
    icon.className = isCollapsed ? 'ti ti-chevron-right' : 'ti ti-chevron-left';
  }
}

let recognition = null;
let isRecording = false;

function toggleSpeechRecognition() {
  const micBtn = document.querySelector('.input-right-controls button[title="Usar microfone"]');
  const inputEl = document.getElementById('chat-message-input');
  
  if (!micBtn || !inputEl) return;
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('A API de reconhecimento de fala não é suportada neste navegador.');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      isRecording = true;
      micBtn.classList.add('recording-pulse');
      inputEl.placeholder = 'Ouvindo... fale agora';
    };
    
    recognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove('recording-pulse');
      inputEl.placeholder = 'Escreva uma mensagem...';
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      isRecording = false;
      micBtn.classList.remove('recording-pulse');
      inputEl.placeholder = 'Escreva uma mensagem...';
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (inputEl.value) {
        inputEl.value += ' ' + transcript;
      } else {
        inputEl.value = transcript;
      }
      adjustTextareaHeight(inputEl);
    };
  }
  
  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
  }
}

function speakLastMessage() {
  const assistantMessages = chatMessages.filter(m => m.role === 'assistant');
  
  if (assistantMessages.length === 0) {
    const inputEl = document.getElementById('chat-message-input');
    if (inputEl && inputEl.value.trim()) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(inputEl.value.trim());
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
    return;
  }
  
  const lastMsg = assistantMessages[assistantMessages.length - 1];
  speakMessage(lastMsg.id);
}

window.speakMessage = speakMessage;
window.rateMessage = rateMessage;
window.regenerateDebate = regenerateDebate;
window.updateActiveModelDisplay = updateActiveModelDisplay;
window.toggleSidebar = toggleSidebar;
window.toggleSpeechRecognition = toggleSpeechRecognition;
window.speakLastMessage = speakLastMessage;
