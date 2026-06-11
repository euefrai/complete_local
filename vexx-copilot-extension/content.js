// Vexx AI Copilot — Content Script

let sidebarOpen = false;
let sidebarContainer = null;
let iframe = null;
let lastScrapedData = null;
let messageObserver = null;
let messageListenersSetup = false;

// Inicializa a extensão na aba
function init() {
  if (document.getElementById("vexx-copilot-trigger")) return;

  createFloatingTrigger();
  createSidebar();
  setupMessageListeners();
  setupObserver();
}

// Cria o botão flutuante para abrir/fechar a barra lateral
function createFloatingTrigger() {
  const trigger = document.createElement("div");
  trigger.id = "vexx-copilot-trigger";
  trigger.style.position = "fixed";
  trigger.style.bottom = "20px";
  trigger.style.right = "20px";
  trigger.style.width = "48px";
  trigger.style.height = "48px";
  trigger.style.borderRadius = "50%";
  trigger.style.backgroundColor = "#a78bfa"; // Ametista accent
  trigger.style.color = "#1b1b1b"; // Charcoal contrast
  trigger.style.display = "flex";
  trigger.style.alignItems = "center";
  trigger.style.justifyContent = "center";
  trigger.style.cursor = "pointer";
  trigger.style.zIndex = "2147483647";
  trigger.style.boxShadow = "0 4px 16px rgba(0,0,0,0.4)";
  trigger.style.border = "1px solid rgba(255,255,255,0.1)";
  trigger.style.transition = "transform 0.2s ease, background-color 0.2s ease";
  trigger.title = "Vexx AI Copilot";

  // Ícone SVG elegante da VEXX (duplo chevron indicando expansão)
  trigger.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="11 17 6 12 11 7"></polyline>
      <polyline points="18 17 13 12 18 7"></polyline>
    </svg>
  `;

  trigger.addEventListener("mouseenter", () => {
    trigger.style.transform = "scale(1.08)";
    trigger.style.backgroundColor = "#b59dfb";
  });

  trigger.addEventListener("mouseleave", () => {
    trigger.style.transform = "scale(1)";
    trigger.style.backgroundColor = "#a78bfa";
  });

  trigger.addEventListener("click", () => {
    toggleSidebar();
  });

  document.body.appendChild(trigger);
}

// Cria a casca da barra lateral (iframe)
function createSidebar() {
  sidebarContainer = document.createElement("div");
  sidebarContainer.id = "vexx-sidebar-container";
  sidebarContainer.style.position = "fixed";
  sidebarContainer.style.top = "0";
  sidebarContainer.style.right = "0";
  sidebarContainer.style.width = "380px";
  sidebarContainer.style.height = "100vh";
  sidebarContainer.style.zIndex = "2147483646";
  sidebarContainer.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.3)";
  sidebarContainer.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
  sidebarContainer.style.transform = "translateX(100%)"; // Oculto por padrão
  sidebarContainer.style.backgroundColor = "#1b1b1b";

  iframe = document.createElement("iframe");
  iframe.id = "vexx-sidebar-iframe";
  iframe.src = chrome.runtime.getURL("sidebar.html");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.allow = "microphone";

  sidebarContainer.appendChild(iframe);
  document.body.appendChild(sidebarContainer);
}

// Alterna o estado de exibição da barra lateral
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const trigger = document.getElementById("vexx-copilot-trigger");

  if (sidebarOpen) {
    sidebarContainer.style.transform = "translateX(0)";
    if (trigger) {
      trigger.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="13 17 18 12 13 7"></polyline>
          <polyline points="6 17 11 12 6 7"></polyline>
        </svg>
      `;
    }
    // Ajusta o layout das páginas para não quebrar conteúdo (opcional, só WhatsApp por ser largo)
    if (window.location.hostname.includes("whatsapp.com")) {
      document.body.style.width = "calc(100% - 380px)";
      document.body.style.transition = "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    }
    // Envia scrape imediato ao abrir
    setTimeout(sendScrapedDataToSidebar, 300);
  } else {
    sidebarContainer.style.transform = "translateX(100%)";
    if (trigger) {
      trigger.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="11 17 6 12 11 7"></polyline>
          <polyline points="18 17 13 12 18 7"></polyline>
        </svg>
      `;
    }
    if (window.location.hostname.includes("whatsapp.com")) {
      document.body.style.width = "100%";
    }
  }
}

// Escuta comunicações vindas da sidebar (iframe)
function setupMessageListeners() {
  if (messageListenersSetup) return;
  messageListenersSetup = true;

  window.addEventListener("message", (event) => {
    // Garante que a mensagem vem da nossa própria extensão
    if (event.data && event.data.source === "vexx-sidebar") {
      const { action, text } = event.data;

      if (action === "SCRAPE_CONTEXT") {
        sendScrapedDataToSidebar();
      } else if (action === "INSERT_TEXT") {
        insertTextIntoActiveInput(text);
      } else if (action === "CLOSE_SIDEBAR") {
        if (sidebarOpen) toggleSidebar();
      } else if (action === "AUTOSCROLL_SCRAPE") {
        if (typeof ContextEngine !== "undefined") {
          const container = ContextEngine.findInstagramMessageContainer();
          ContextEngine.autoScrollAndScrape(container, 4).then(data => {
            lastScrapedData = data;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                source: "vexx-content",
                action: "CONTEXT_UPDATED",
                payload: data
              }, "*");
            }
          });
        }
      } else if (action === "SCROLL_PAGE") {
        const amount = (event.data.payload && event.data.payload.amount) || (window.innerHeight * 0.7);
        window.scrollBy({ top: amount, behavior: "smooth" });
        setTimeout(() => {
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              source: "vexx-content",
              action: "SCROLL_DONE"
            }, "*");
          }
        }, 850);
      } else if (action === "EXECUTE_AUTOMATION") {
        if (typeof AutomationEngine !== "undefined" && event.data.payload && event.data.payload.steps) {
          AutomationEngine.executeSteps(event.data.payload.steps).then(result => {
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                source: "vexx-content",
                action: "AUTOMATION_RESULT",
                payload: result
              }, "*");
            }
          });
        }
      }
    }
  });
}

// Busca o contêiner de mensagens rolável do Instagram de forma dinâmica
function findInstagramMessageContainer() {
  // 1. Localiza a caixa de texto ativa como âncora independente de idioma, priorizando o painel principal
  const mainPane = document.querySelector("div[role='main'], main, section");
  const inputEl = mainPane ? 
    mainPane.querySelector("div[contenteditable='true'], textarea, div[role='textbox']") : 
    document.querySelector("div[contenteditable='true'], textarea, div[role='textbox']");
    
  if (inputEl) {
    // Sobe a árvore a partir do input procurando por um irmão ou ancestral contêiner grande
    let current = inputEl;
    while (current && current !== document.body) {
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        for (const sib of siblings) {
          if (sib !== current) {
            // Em vez de scrollHeight > clientHeight (que falha em conversas curtas),
            // verificamos se o elemento é suficientemente alto (> 150px)
            const candidate = (sib.offsetHeight > 150) ? sib : sib.querySelector("div.x5yr21d, div.x1n2onr6, div[role='grid']");
            if (candidate && candidate.offsetHeight > 150) {
              return candidate;
            }
          }
        }
      }
      
      // Se o próprio elemento atual for um contêiner candidato válido
      if (current.offsetHeight > 300) {
        if (current.classList.contains('x5yr21d') || current.classList.contains('x1n2onr6') || current.querySelector("div.x5yr21d, div.x1n2onr6")) {
          return current;
        }
      }
      
      current = current.parentElement;
    }
  }

  // 2. Fallback: Procura por elementos comuns com as classes conhecidas do Instagram
  const commonSelectors = [
    "div.x5yr21d", 
    "div.x1n2onr6",
    "div[role='grid']",
    "div.x1y1aw1k"
  ];
  for (const selector of commonSelectors) {
    const el = document.querySelector(selector);
    if (el && el.offsetHeight > 150) {
      return el;
    }
  }

  // 3. Fallback final: tenta achar o painel direito de chat
  const rightPane = document.querySelector("div[role='main'] section, div[role='main'] div[role='presentation']");
  if (rightPane) return rightPane;

  return document.querySelector("div[role='main'], main, section, div.x1qjc9v5");
}

// Verifica se o elemento é um nó folha contendo texto relevante
function isLeafTextNode(el) {
  if (el.children.length === 0) return true;
  for (const child of el.children) {
    if (child.textContent.trim().length > 0) {
      return false;
    }
  }
  return true;
}

// Extrai o nome do contato do Instagram de forma resiliente
function extractInstagramContactName(container) {
  try {
    // 1. Tenta achar o elemento de status ("Online há...", "Ativo agora", etc.) no DOM
    const statusEl = Array.from(document.querySelectorAll("span, div")).find(el => {
      const text = el.textContent.trim();
      return text.length > 0 && 
             text.length < 30 && 
             (text.includes("Online") || text.includes("Ativo") || text.includes("Active") || text.includes("há "));
    });
    
    if (statusEl) {
      // Sobe até achar um container que tenha o nome do contato acima ou do lado do status
      let parent = statusEl.parentElement;
      for (let depth = 0; depth < 5 && parent && parent !== document.body; depth++) {
        const elements = Array.from(parent.querySelectorAll("span, a, div[role='button'], div"));
        for (const el of elements) {
          const text = el.textContent.trim();
          if (text && 
              text.length > 1 && 
              text.length < 40 &&
              text !== statusEl.textContent.trim() && 
              !text.includes("Online") && 
              !text.includes("Ativo") && 
              !text.includes("Active") && 
              !text.includes("há ") &&
              !el.querySelector("svg")) {
            return text;
          }
        }
        parent = parent.parentElement;
      }
    }

    // 2. Se falhar, tenta buscar elementos de cabeçalho comuns
    const headerSelectors = [
      "div[role='main'] header", 
      "main header", 
      "section header",
      "div[role='main'] div[style*='height:']",
      "div.x1qjc9v5 div.x1qjc9v5"
    ];
    for (const selector of headerSelectors) {
      const header = document.querySelector(selector);
      if (header) {
        const textNodes = Array.from(header.querySelectorAll("a, span, div"))
          .map(el => el.textContent.trim())
          .filter(t => t.length > 1 && t.length < 40 && !t.includes("Online") && !t.includes("Ativo") && !t.includes("Active") && !t.includes("há "));
        if (textNodes.length > 0) {
          return textNodes[0];
        }
      }
    }
  } catch (e) {
    console.warn("[Vexx Scraper] Erro ao extrair nome do contato:", e);
  }

  return "Conversa Direct";
}

// Extrai informações do DOM de acordo com o site atual
function scrapePageData() {
  const url = window.location.href;
  let data = {
    type: "unknown",
    url: url,
    contactName: "",
    contactUsername: "",
    contactBio: "",
    messages: []
  };

  try {
    if (url.includes("whatsapp.com")) {
      data.type = "whatsapp";
      data.platform = "whatsapp";
      console.log("[Vexx Scraper] Iniciando captura do WhatsApp Web...");
      
      // 1. Nome do contato
      let contactName = "";
      const headerEl = document.querySelector("header");
      if (headerEl) {
        const titleSpan = headerEl.querySelector("span[title], span[dir='auto'], div[dir='auto']");
        if (titleSpan) {
          contactName = titleSpan.getAttribute("title") || titleSpan.textContent;
        }
        if (!contactName) {
          const allSpans = headerEl.querySelectorAll("span");
          for (const span of allSpans) {
            const txt = span.textContent.trim();
            if (txt && txt.length > 1 && !txt.includes("online") && !txt.includes("clique aqui") && !txt.includes("typing") && !txt.includes("digitando")) {
              contactName = txt;
              break;
            }
          }
        }
      }
      data.contactName = contactName || "Conversa Ativa";
      console.log("[Vexx Scraper] Contato ativo no WhatsApp:", data.contactName);

      // 2. Mensagens do Chat Ativo
      const msgEls = document.querySelectorAll(".message-in, .message-out, div[data-id], [data-testid='msg-container']");
      const parsedMessages = [];
      console.log("[Vexx Scraper] Balões de mensagens localizados:", msgEls.length);

      // Evita duplicados processando por data-id se disponível
      const processedIds = new Set();

      msgEls.forEach(el => {
        // Se tem data-id, garante que não processa duas vezes
        const dataId = el.getAttribute("data-id");
        if (dataId) {
          if (processedIds.has(dataId)) return;
          processedIds.add(dataId);
        }

        let isOut = el.classList.contains("message-out");
        if (!isOut && dataId) {
          isOut = dataId.startsWith("true_");
        }
        
        let senderName = isOut ? "Você" : data.contactName;
        let time = "";

        // Tenta extrair metadados do cabeçalho da mensagem (hora e remetente real em grupos)
        const copyableEl = el.querySelector(".copyable-text");
        if (copyableEl && copyableEl.getAttribute("data-pre-plain-text")) {
          const preText = copyableEl.getAttribute("data-pre-plain-text"); // ex: "[10:20, 11/06/2026] Cliente Vexx:"
          
          const timeMatch = preText.match(/\[(\d{2}:\d{2})/);
          if (timeMatch) time = timeMatch[1];

          const senderMatch = preText.match(/\]\s*([^:]+):/);
          if (senderMatch && !isOut) senderName = senderMatch[1].trim();
        }

        if (!time) {
          // Tenta extrair hora pelo span do timestamp comum
          const timeEl = el.querySelector("span[data-testid='msg-meta'], .bubble-time, span");
          if (timeEl) {
            const timeText = timeEl.textContent.trim();
            const timeMatch = timeText.match(/(\d{2}:\d{2})/);
            if (timeMatch) time = timeMatch[1];
          }
        }

        // Busca texto dentro da bolha de conversa
        let textEl = el.querySelector(".copyable-text span.selectable-text, span.selectable-text, .selectable-text");
        if (!textEl) {
          textEl = el.querySelector(".message-text, [data-testid='media-caption']");
        }
        
        if (!textEl) {
          const spans = el.querySelectorAll("span");
          let bestSpan = null;
          let maxLength = 0;
          spans.forEach(s => {
            const txt = s.textContent.trim();
            const isTimestamp = /^\d{2}:\d{2}$/.test(txt);
            const isForwarded = txt === "Encaminhada" || txt === "Forwarded";
            const isSender = txt === senderName;
            
            if (txt && !isTimestamp && !isForwarded && !isSender && txt.length > maxLength) {
              maxLength = txt.length;
              bestSpan = s;
            }
          });
          textEl = bestSpan;
        }

        let msgText = "";
        if (textEl) {
          msgText = textEl.innerText || textEl.textContent || "";
        }

        // Se não achou texto, tenta descrever mídia
        if (!msgText) {
          if (el.querySelector("[data-testid='audio-play'], [data-testid='audio-pause'], audio, .audio-player")) {
            msgText = "[Áudio / Mensagem de Voz]";
          } else if (el.querySelector("img, [data-testid='image-thumb'], .image-thumb")) {
            msgText = "[Imagem / Mídia]";
          } else if (el.querySelector("[data-testid='video-play'], video")) {
            msgText = "[Vídeo]";
          } else {
            // Remove a hora se houver do final da string
            msgText = el.textContent.replace(/\d{2}:\d{2}$/, "").trim();
          }
        }

        // Filtra mensagens vazias ou repetidas de controle
        if (msgText && msgText !== "Encaminhada" && msgText !== "Forwarded") {
          console.log(`[Vexx Scraper] WA Msg: "${msgText.substring(0, 30)}..." | Remetente: ${senderName} | Horário: ${time}`);
          
          parsedMessages.push({
            sender: isOut ? "user" : "contact",
            senderName: senderName,
            text: msgText,
            time: time
          });
        }
      });

      data.messages = parsedMessages.slice(-15); // Pega as últimas 15 mensagens para contexto do debate
      console.log("[Vexx Scraper] Total de mensagens WhatsApp extraídas:", parsedMessages.length);
    } 
    
    else if (url.includes("instagram.com")) {
      data.type = "instagram";
      data.platform = "instagram";
      console.log("[Vexx Scraper] Iniciando captura do Instagram. URL:", url);
      const pathname = window.location.pathname.split("/").filter(Boolean);
      const reserved = ["explore", "direct", "emails", "accounts", "developer", "about", "legal", "press", "reels", "stories", "p", "reel", "create"];

      // A. Criação de post/story
      if (url.includes("/create/") || url.includes("?next=%2Fcreate%2F") || (document.querySelector("div[role='dialog'] h2") && document.querySelector("div[role='dialog'] h2").textContent.includes("Criar"))) {
        data.type = "creation";
        data.contactName = "Criar Conteúdo";
        data.messages = [{ sender: "system", senderName: "Criação", text: "Usuário está na tela de criação de post/story/reel." }];
        console.log("[Vexx Scraper] Detectado contexto: Criação de Conteúdo");
      }
      // B. Direct Messages (DMs)
      else if (url.includes("/direct/t/") || pathname[0] === "direct") {
        data.type = "instagram"; // Mantido como "instagram" para retrocompatibilidade do chat
        const container = findInstagramMessageContainer();
        console.log("[Vexx Scraper] Contêiner de DMs do Instagram localizado:", !!container);
        
        const contactName = extractInstagramContactName(container);
        data.contactName = contactName;
        console.log("[Vexx Scraper] Nome do contato resolvido:", contactName);

        // Profile Scraping: extrai @username do header da DM
        try {
          const headerLinks = document.querySelectorAll("div[role='main'] header a, main header a, section header a");
          for (const link of headerLinks) {
            const href = link.getAttribute("href") || "";
            const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
            if (match && match[1] && !['direct', 'explore', 'accounts', 'p', 'reel', 'stories'].includes(match[1])) {
              data.contactUsername = match[1];
              console.log("[Vexx Scraper] Username extraído do header:", data.contactUsername);
              break;
            }
          }
          // Fallback: tenta extrair username do título/atributo title
          if (!data.contactUsername) {
            const titleEls = document.querySelectorAll("div[role='main'] header span[title], main header span[title]");
            for (const el of titleEls) {
              const title = el.getAttribute("title") || "";
              if (title && title.length > 1 && title.length < 40) {
                data.contactUsername = title;
                break;
              }
            }
          }
          // Se username extraído parece ser um nome real, usa como contactName e mantém username
          if (data.contactUsername && !data.contactName) {
            data.contactName = data.contactUsername;
          }
        } catch (e) {
          console.warn("[Vexx Scraper] Erro ao extrair username:", e);
        }

        const dmMessages = [];
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const midpoint = containerRect.left + containerRect.width / 2;
          console.log("[Vexx Scraper] Painel de chat - Limites da largura:", containerRect.width, "Midpoint:", midpoint);
          
          // Limites verticais de corte para ignorar cabeçalho e caixa de texto de digitação de forma agnóstica
          const topThreshold = containerRect.top + 80;
          const bottomThreshold = containerRect.bottom - 100;

          // Coleta apenas candidatos de texto com dir='auto' (que são os balões de mensagem)
          const allCandidates = container.querySelectorAll("div[dir='auto'], span[dir='auto']");
          const header = document.querySelector("header") || container.querySelector("header");
          const footer = document.querySelector("textarea, [contenteditable='true']") || container.querySelector("textarea, [contenteditable='true']");
          let footerContainer = null;
          if (footer) {
            footerContainer = footer.closest("div[style*='flex-direction: row']") || footer.parentElement;
          }

          const candidatesWithLayout = [];
          allCandidates.forEach(el => {
            if (header && header.contains(el)) return;
            if (footerContainer && footerContainer.contains(el)) return;
            if (el.querySelector("textarea, [contenteditable='true']")) return;

            const text = el.textContent.trim();
            if (!text) return;

            const rect = el.getBoundingClientRect();
            // Verifica se está dentro dos limites visíveis e da área de mensagens
            if (rect.width > 0 && rect.height > 0 && rect.top >= topThreshold && rect.bottom <= bottomThreshold) {
              candidatesWithLayout.push({
                element: el,
                text: text,
                rect: rect
              });
            }
          });

          // Filtro de unicidade: remove elementos filhos aninhados de outros candidatos.
          // Se A contém B, mantemos A (o maior/pai com texto completo) e descartamos B.
          const uniqueCandidates = [];
          candidatesWithLayout.forEach(candidate => {
            const hasParentCandidate = candidatesWithLayout.some(other => 
              other !== candidate && 
              other.element.contains(candidate.element)
            );

            if (!hasParentCandidate) {
              uniqueCandidates.push(candidate);
            }
          });

          console.log(`[Vexx Scraper] Encontrados ${uniqueCandidates.length} elementos de mensagens únicos no chat.`);

          uniqueCandidates.forEach(c => {
            const text = c.text;
            if (text === data.contactName) return;
            
            const elCenter = c.rect.left + c.rect.width / 2;
            const distance = Math.abs(elCenter - midpoint);
            
            // Ignora elemento se for centralizado (data/hora) e curto
            const isCentered = distance < (containerRect.width * 0.08);
            if (isCentered && text.length < 25) {
              return;
            }
            
            const isOut = elCenter > midpoint;
            console.log(`[Vexx Scraper] Mensagem encontrada: "${text.substring(0, 30)}..." | Alinhamento: ${isOut ? 'Direita (Você)' : 'Esquerda (Contato)'}`);
            
            dmMessages.push({
              sender: isOut ? "user" : "contact",
              senderName: isOut ? "Você" : data.contactName,
              text: text,
              time: ""
            });
          });
        }
        data.messages = dmMessages.slice(-15);
        console.log(`[Vexx Scraper] Total de mensagens DMs extraídas:`, dmMessages.length);
      }
      // C. Explorar
      else if (pathname[0] === "explore") {
        data.type = "explore";
        data.contactName = "Explorar";
        data.messages = [{ sender: "system", senderName: "Explorar", text: "Usuário está na aba Explorar navegando por tendências." }];
        console.log("[Vexx Scraper] Detectado contexto: Explorar");
      }
      // D. Visualizando Post ou Reel específico (Comentários)
      else if (pathname[0] === "p" || pathname[0] === "reel") {
        data.type = "post";
        const authorEl = document.querySelector("header a[href*='/'], h2 a[href*='/']");
        data.contactName = authorEl ? authorEl.textContent.trim() : "Autor do Post";

        // Extrai legenda do post como primeira mensagem de contexto se disponível
        const captionEl = document.querySelector("h1, div._a9zs span");
        const captionText = captionEl ? captionEl.textContent.trim() : "";
        
        const comments = [];
        if (captionText) {
          comments.push({
            sender: "contact",
            senderName: data.contactName,
            text: `[Legenda do Post]: ${captionText}`,
            time: ""
          });
        }

        const commentEls = document.querySelectorAll("ul._a9z6, ul._a9za, div[role='dialog'] ul li, ul li, [role='listitem']");
        commentEls.forEach(el => {
          const usernameEl = el.querySelector("h3 a, h2 a, a[style*='font-weight: 600'], a[href*='/']");
          if (!usernameEl) return;
          
          const textSpans = Array.from(el.querySelectorAll("span"));
          const commentTextEl = textSpans.find(span => {
            const text = span.textContent.trim();
            return text.length > 0 && 
                   text !== usernameEl.textContent.trim() && 
                   !span.querySelector("a") && 
                   !text.match(/^\d+[smhd]/) && 
                   text !== "Reply" && text !== "Responder";
          });
          
          if (usernameEl && commentTextEl) {
            comments.push({
              sender: "contact",
              senderName: usernameEl.textContent.trim(),
              text: commentTextEl.textContent.trim(),
              time: ""
            });
          }
        });
        data.messages = comments.slice(-12);
        console.log(`[Vexx Scraper] Detectado contexto: Post/Reel. Comentários extraídos:`, comments.length);
      }
      // E. Perfil de usuário
      else if (pathname.length === 1 && !reserved.includes(pathname[0])) {
        data.type = "profile";
        data.contactName = `@${pathname[0]}`;
        
        let bio = "";
        const headerSection = document.querySelector("header section");
        if (headerSection) {
          const divs = Array.from(headerSection.querySelectorAll("div"));
          for (const div of divs) {
            const txt = div.textContent.trim();
            if (txt && !div.querySelector("button") && !txt.includes("seguidores") && !txt.includes("followers") && !txt.includes("seguindo") && !txt.includes("posts")) {
              if (txt.length > bio.length) {
                bio = txt;
              }
            }
          }
        }
        
        data.username = pathname[0];
        data.bio = bio || "Biografia não encontrada ou vazia.";
        data.messages = [{ sender: "system", senderName: "Perfil", text: `Perfil: @${pathname[0]}\nBio: ${data.bio}` }];
        console.log(`[Vexx Scraper] Detectado contexto: Perfil de @${pathname[0]}`);
      }
      // F. Feed / Home
      else {
        data.type = "feed";
        data.contactName = "Feed de Notícias";
        data.messages = [{ sender: "system", senderName: "Feed", text: "Usuário está navegando pelo feed principal do Instagram." }];
        console.log("[Vexx Scraper] Detectado contexto: Feed Principal");
      }
    }
  } catch (error) {
    console.error("[Vexx Scraper] Erro crítico ao capturar dados da página:", error);
  }

  return data;
}

// Envia dados coletados para a sidebar via postMessage
function sendScrapedDataToSidebar() {
  if (!iframe || !iframe.contentWindow) return;

  try {
    const data = (typeof ContextEngine !== "undefined") ? ContextEngine.scrapeDeep() : scrapePageData();
    lastScrapedData = data;

    iframe.contentWindow.postMessage({
      source: "vexx-content",
      action: "CONTEXT_UPDATED",
      payload: data
    }, "*");
  } catch (e) {
    console.error("[Vexx Content] Falha ao enviar dados para a sidebar:", e);
  }
}

// Insere a resposta sugerida na caixa de chat correspondente do site original
// Compatível com React (Instagram/WhatsApp) via nativeInputValueSetter + execCommand
function insertTextIntoActiveInput(text) {
  const url = window.location.href;
  let success = false;

  function setReactValue(el, value) {
    // Para <textarea> e <input>, usa nativeInputValueSetter para contornar o React
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value"
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, value);
      } else {
        el.value = value;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox") {
      // Para contenteditable (React), usa execCommand
      el.focus();
      // Limpa o conteúdo anterior
      if (el.textContent.trim() === "" || el.textContent.trim() === el.getAttribute("placeholder")) {
        el.textContent = "";
      }
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function flashInsertFeedback(el) {
    if (!el) return;
    el.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
    el.style.boxShadow = "0 0 12px 4px rgba(151, 196, 89, 0.35)";
    el.style.borderColor = "#97c459";
    setTimeout(() => {
      el.style.boxShadow = "";
      el.style.borderColor = "";
    }, 1200);
  }

  if (url.includes("whatsapp.com")) {
    const inputEl = document.querySelector("footer div[contenteditable='true'], div[contenteditable='true'][data-tab='10']");
    if (inputEl) {
      inputEl.focus();
      setReactValue(inputEl, text);
      flashInsertFeedback(inputEl);
      success = true;
    }
  } 
  
  else if (url.includes("instagram.com")) {
    if (url.includes("/direct/t/")) {
      // Input de DM — ordem de prioridade
      const selectors = [
        "div[role='textbox'][contenteditable='true']",
        "div[role='main'] div[contenteditable='true']",
        "div[role='main'] textarea",
        "div[contenteditable='true']",
        "textarea"
      ];
      let inputEl = null;
      for (const sel of selectors) {
        inputEl = document.querySelector(sel);
        if (inputEl) break;
      }
      if (inputEl) {
        inputEl.focus();
        setReactValue(inputEl, text);
        flashInsertFeedback(inputEl);
        success = true;
      }
    } else {
      // Input de comentário
      const inputEl = document.querySelector("textarea[placeholder*='comentário'], textarea[placeholder*='comment'], div[contenteditable='true'], textarea");
      if (inputEl) {
        inputEl.focus();
        setReactValue(inputEl, text);
        flashInsertFeedback(inputEl);
        success = true;
      }
    }
  }

  // Envia feedback de sucesso/falha para a sidebar
  try {
    const sidebarIframe = document.getElementById("vexx-sidebar-iframe");
    if (sidebarIframe && sidebarIframe.contentWindow) {
      sidebarIframe.contentWindow.postMessage({
        source: "vexx-content",
        action: "INSERT_RESULT",
        payload: { success: success }
      }, "*");
    }
  } catch(e) {
    console.warn("[Vexx Content] Erro ao enviar INSERT_RESULT:", e);
  }

  if (!success) {
    console.warn("[Vexx Content] Não foi possível encontrar campo de input para inserir texto.");
  }
}

// Configura MutationObserver para detectar novas mensagens no WhatsApp ou Instagram Web
function setupObserver() {
  if (messageObserver) messageObserver.disconnect();

  let debounceTimer;
  messageObserver = new MutationObserver((mutations) => {
    let hasNewMessage = false;
    for (let mutation of mutations) {
      // Ignora digitação do usuário nas caixas de texto/inputs
      if (mutation.target && mutation.target.closest && mutation.target.closest("input, textarea, [contenteditable='true']")) {
        continue;
      }
      
      // Ignora mutações disparadas pela própria extensão
      if (mutation.target && mutation.target.closest && mutation.target.closest("#vexx-sidebar-container, #vexx-copilot-trigger")) {
        continue;
      }

      // Ignora se os nós adicionados forem da própria extensão
      let skipMutation = false;
      for (let node of mutation.addedNodes) {
        if (node.id === "vexx-sidebar-container" || node.id === "vexx-copilot-trigger" || 
            (node.closest && node.closest("#vexx-sidebar-container, #vexx-copilot-trigger"))) {
          skipMutation = true;
          break;
        }
      }
      if (skipMutation) continue;

      if (mutation.addedNodes.length > 0) {
        if (window.location.hostname.includes("whatsapp.com")) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList.contains("message-in") || node.querySelector(".message-in")) {
                hasNewMessage = true;
                break;
              }
            }
          }
        } else if (window.location.hostname.includes("instagram.com")) {
          // No Instagram, qualquer adição de nó com texto na área principal é uma potencial nova mensagem
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const mainArea = document.querySelector("div[role='main'], main, section");
              if (mainArea && mainArea.contains(node)) {
                if (node.textContent.trim().length > 0) {
                  hasNewMessage = true;
                  break;
                }
              }
            }
          }
        }
      }
      if (hasNewMessage) break;
    }

    if (hasNewMessage && sidebarOpen) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        sendScrapedDataToSidebar();
      }, 500);
    }
  });

  messageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Executa a inicialização após o carregamento da página
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Trata mudança de rota interna (ex: trocar de chat no WhatsApp ou mudar de URL no Instagram sem recarregar a aba)
let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Tenta re-inicializar os gatilhos se necessário e atualiza dados
    init();
    if (sidebarOpen) {
      sendScrapedDataToSidebar();
    }
  }
}, 1000);

// Atalho global Ctrl+Shift+K para abrir a Command Palette na sidebar
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!sidebarOpen) {
      toggleSidebar();
    }
    // Pequeno delay para garantir que o iframe está visível e focado
    setTimeout(() => {
      const sidebarIframe = document.getElementById("vexx-sidebar-iframe");
      if (sidebarIframe && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.postMessage({
          source: "vexx-content",
          action: "OPEN_COMMAND_PALETTE"
        }, "*");
      }
    }, 150);
  }
});

class AutomationEngine {
  static async executeSteps(steps) {
    console.log("[AutomationEngine] Executando passos:", steps);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        await this.executeStep(step);
      } catch (e) {
        console.error("[AutomationEngine] Erro no passo:", step, e);
        return { success: false, error: `Erro no passo ${i + 1}: ${e.message}` };
      }
    }
    return { success: true };
  }

  static async executeStep(step) {
    const { action, target, value, delay, from, to } = step;
    const waitTime = delay || 1200;

    if (action === "wait") {
      await new Promise(r => setTimeout(r, waitTime));
      return;
    }

    let element = null;
    let clickX = null;
    let clickY = null;

    if (target) {
      if (Array.isArray(target) && target.length === 2) {
        clickX = (target[0] / 1000) * window.innerWidth;
        clickY = (target[1] / 1000) * window.innerHeight;
        element = document.elementFromPoint(clickX, clickY);
      } else {
        element = this.findElement(target);
      }
    }

    if (!element && action !== "upload" && action !== "wait" && action !== "drag_drop") {
      throw new Error(`Alvo não encontrado: "${target}"`);
    }

    switch (action) {
      case "click":
        if (clickX !== null && clickY !== null) {
          console.log(`[AutomationEngine] Clicando na coordenada (${clickX}, ${clickY})`);
          if (element) element.focus();
          const md = new MouseEvent("mousedown", { bubbles: true, clientX: clickX, clientY: clickY });
          const cl = new MouseEvent("click", { bubbles: true, clientX: clickX, clientY: clickY });
          const mu = new MouseEvent("mouseup", { bubbles: true, clientX: clickX, clientY: clickY });
          if (element) {
            element.dispatchEvent(md);
            element.dispatchEvent(cl);
            element.dispatchEvent(mu);
          } else {
            document.dispatchEvent(md);
            document.dispatchEvent(cl);
            document.dispatchEvent(mu);
          }
        } else {
          console.log("[AutomationEngine] Clicando no elemento:", element);
          element.focus();
          element.click();
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        }
        break;

      case "type":
        console.log("[AutomationEngine] Digitando em:", element, "valor:", value);
        element.focus();
        if (element.getAttribute("contenteditable") === "true") {
          element.innerText = value;
          element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        } else {
          element.value = value;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }
        break;

      case "drag_drop":
        if (from && to && Array.isArray(from) && Array.isArray(to)) {
          const fx = (from[0] / 1000) * window.innerWidth;
          const fy = (from[1] / 1000) * window.innerHeight;
          const tx = (to[0] / 1000) * window.innerWidth;
          const ty = (to[1] / 1000) * window.innerHeight;
          console.log(`[AutomationEngine] Arrastando de (${fx}, ${fy}) para (${tx}, ${ty})`);
          
          const dragEl = document.elementFromPoint(fx, fy);
          if (dragEl) {
            dragEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: fx, clientY: fy }));
            await new Promise(r => setTimeout(r, 200));
            dragEl.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: tx, clientY: ty }));
            await new Promise(r => setTimeout(r, 200));
            dragEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: tx, clientY: ty }));
          }
        } else {
          throw new Error("Coordenadas 'from' e 'to' inválidas para drag_drop.");
        }
        break;

      case "upload":
        console.log("[AutomationEngine] Abrindo uploader de arquivo");
        const fileInput = document.querySelector("input[type='file']");
        if (fileInput) {
          fileInput.click();
        } else {
          throw new Error("Input de arquivo não encontrado.");
        }
        break;

      default:
        throw new Error(`Ação desconhecida: "${action}"`);
    }

    await new Promise(r => setTimeout(r, waitTime));
  }

  static findElement(query) {
    // 1. Tenta seletor CSS puro
    try {
      const el = document.querySelector(query);
      if (el) return el;
    } catch(e) {}

    // 2. Tenta busca por texto ou aria-label de forma difusa
    const elements = document.querySelectorAll("button, div, span, input, textarea, a, svg");
    const lowerQuery = query.toLowerCase().trim();
    
    // Prioridade 1: Match exato de aria-label ou title
    for (const el of elements) {
      const aria = el.getAttribute("aria-label");
      const title = el.getAttribute("title");
      if ((aria && aria.toLowerCase() === lowerQuery) || (title && title.toLowerCase() === lowerQuery)) {
        return el;
      }
    }

    // Prioridade 2: Match contido de aria-label ou title
    for (const el of elements) {
      const aria = el.getAttribute("aria-label");
      const title = el.getAttribute("title");
      if ((aria && aria.toLowerCase().includes(lowerQuery)) || (title && title.toLowerCase().includes(lowerQuery))) {
        return el;
      }
    }

    // Prioridade 3: Match exato de texto de botão
    for (const el of elements) {
      if (el.tagName === "BUTTON" && el.textContent && el.textContent.toLowerCase().trim() === lowerQuery) {
        return el;
      }
    }

    // Prioridade 4: Match contido de texto
    for (const el of elements) {
      if (el.textContent && el.textContent.toLowerCase().trim().includes(lowerQuery) && el.textContent.length < 40) {
        return el;
      }
    }

    return null;
  }
}

