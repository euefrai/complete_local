// Vexx AI Copilot — Context Engine Module
// Resilient DOM parser and deep contextual extractor for Instagram and WhatsApp

class ContextEngine {
  // Detects the current page type on Instagram/WhatsApp
  static detectPageType() {
    const url = window.location.href;
    const pathname = window.location.pathname.split("/").filter(Boolean);
    
    if (url.includes("whatsapp.com")) {
      return "whatsapp";
    }

    if (url.includes("instagram.com")) {
      // Creation screen (dialogs or /create/)
      if (url.includes("/create/") || url.includes("?next=%2Fcreate%2F")) {
        return "creation";
      }
      const dialogH2 = document.querySelector("div[role='dialog'] h2");
      if (dialogH2 && (dialogH2.textContent.includes("Criar") || dialogH2.textContent.includes("Create"))) {
        return "creation";
      }

      // Direct Messages
      if (url.includes("/direct/t/") || pathname[0] === "direct") {
        return "dm";
      }

      // Explore Page
      if (pathname[0] === "explore") {
        return "explore";
      }

      // Specific Post/Reel
      if (pathname[0] === "p") {
        return "post";
      }
      if (pathname[0] === "reel") {
        return "reel";
      }

      // Stories
      if (pathname[0] === "stories") {
        return "stories";
      }

      // Profile Page (Matches /username/ where username is not a reserved path)
      const reservedPaths = [
        "explore", "direct", "emails", "accounts", "developer", "about", 
        "legal", "press", "reels", "stories", "p", "reel", "create"
      ];
      if (pathname.length === 1 && !reservedPaths.includes(pathname[0])) {
        return "profile";
      }

      // Main Feed / Home
      if (pathname.length === 0 || pathname[0] === "") {
        return "feed";
      }
    }

    return "general";
  }

  // Master method to perform deep scraping of the current page context
  static scrapeDeep() {
    const url = window.location.href;
    const pageType = this.detectPageType();
    const timestamp = Date.now();

    const baseContext = {
      type: pageType,
      platform: url.includes("whatsapp.com") ? "whatsapp" : (url.includes("instagram.com") ? "instagram" : window.location.hostname),
      url: url,
      timestamp: timestamp,
      contactName: "",
      contactUsername: "",
      contactBio: "",
      messages: [],
      hashtags: [],
      mentions: [],
      emojis: [],
      visibleText: "",
      structure: { headers: [], sections: [] }
    };

    try {
      // Extract page structure and visible text for general fallback context
      baseContext.visibleText = this.getVisibleText();
      baseContext.structure = this.getStructuredDOM();
      baseContext.hashtags = this.extractHashtags(baseContext.visibleText);
      baseContext.mentions = this.extractMentions(baseContext.visibleText);
      baseContext.emojis = this.extractEmojis(baseContext.visibleText);

      let scrapedData = {};

      switch (pageType) {
        case "whatsapp":
          scrapedData = this.scrapeWhatsApp();
          break;
        case "dm":
          scrapedData = this.scrapeInstagramDM();
          break;
        case "profile":
          scrapedData = this.scrapeInstagramProfile();
          break;
        case "post":
        case "reel":
          scrapedData = this.scrapeInstagramPostOrReel(pageType);
          break;
        case "feed":
          scrapedData = this.scrapeInstagramFeed();
          break;
        case "explore":
          scrapedData = {
            contactName: "Explorar",
            messages: [{ sender: "system", senderName: "Explorar", text: "Usuário está navegando pela página Explorar do Instagram." }]
          };
          break;
        case "stories":
          scrapedData = this.scrapeInstagramStory();
          break;
        case "creation":
          scrapedData = {
            contactName: "Criar Conteúdo",
            messages: [{ sender: "system", senderName: "Criação", text: "Usuário está na tela de criação de post/story/reel." }]
          };
          break;
        case "general":
        default:
          const mockMessages = [];
          
          // 1. Tenta encontrar elementos de comentários ou posts de fóruns/redes comuns
          const generalTextSelectors = [
            ".comment-body", ".comment-content", ".comment-text", 
            "yt-attributed-string#content-text", "#content-text", 
            ".comment__text", "article p", ".post-text", ".post-body",
            ".TimelineItem-body", ".markdown-body p"
          ];
          
          let foundElements = [];
          for (const selector of generalTextSelectors) {
            const els = document.querySelectorAll(selector);
            if (els.length > 0) {
              foundElements = Array.from(els);
              break;
            }
          }
          
          if (foundElements.length > 0) {
            foundElements.forEach(el => {
              if (el.closest("#vexx-sidebar-container, #vexx-copilot-trigger")) return;
              const text = el.textContent.trim();
              if (text && text.length > 5) {
                let senderName = "Leitor";
                const parentComment = el.closest(".comment, ytd-comment-thread-renderer, .timeline-comment, .TimelineItem");
                if (parentComment) {
                  const authorEl = parentComment.querySelector(".author, #author-text, .comment-author, a[class*='author']");
                  if (authorEl) senderName = authorEl.textContent.trim();
                }
                mockMessages.push({
                  sender: "contact",
                  senderName: senderName,
                  text: text,
                  time: ""
                });
              }
            });
          }
          
          // 2. Se não encontrou comentários, usa cabeçalhos e parágrafos do corpo da página como mensagens
          if (mockMessages.length === 0) {
            const headings = document.querySelectorAll("h1, h2, h3");
            headings.forEach(h => {
              const text = h.textContent.trim();
              if (text && text.length > 3 && !h.closest("#vexx-sidebar-container, #vexx-copilot-trigger")) {
                mockMessages.push({
                  sender: "contact",
                  senderName: h.tagName,
                  text: text,
                  time: ""
                });
              }
            });
            
            const paras = document.querySelectorAll("main p, article p, p");
            let count = 0;
            for (const p of paras) {
              if (count >= 10) break;
              const text = p.textContent.trim();
              if (text && text.length > 20 && !p.closest("#vexx-sidebar-container, #vexx-copilot-trigger")) {
                mockMessages.push({
                  sender: "contact",
                  senderName: "Conteúdo",
                  text: text,
                  time: ""
                });
                count++;
              }
            }
          }

          scrapedData = {
            contactName: document.title || window.location.hostname,
            messages: mockMessages.slice(-15)
          };
          break;
      }

      const context = { ...baseContext, ...scrapedData };
      context.domIntelligence = this.mapDOMIntelligence();
      context.reverseEngineering = this.detectFrameworks();
      context.userActivity = this.detectUserActivity();
      return context;

    } catch (e) {
      console.error("[ContextEngine] Erro crítico no scrapeDeep:", e);
      return baseContext;
    }
  }

  // 1. WhatsApp Scraping
  static scrapeWhatsApp() {
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
    
    contactName = contactName || "Conversa Ativa";

    const msgEls = document.querySelectorAll(".message-in, .message-out, div[data-id], [data-testid='msg-container']");
    const parsedMessages = [];
    const processedIds = new Set();

    msgEls.forEach(el => {
      const dataId = el.getAttribute("data-id");
      if (dataId) {
        if (processedIds.has(dataId)) return;
        processedIds.add(dataId);
      }

      let isOut = el.classList.contains("message-out");
      if (!isOut && dataId) {
        isOut = dataId.startsWith("true_");
      }
      
      let senderName = isOut ? "Você" : contactName;
      let time = "";

      const copyableEl = el.querySelector(".copyable-text");
      if (copyableEl && copyableEl.getAttribute("data-pre-plain-text")) {
        const preText = copyableEl.getAttribute("data-pre-plain-text");
        const timeMatch = preText.match(/\[(\d{2}:\d{2})/);
        if (timeMatch) time = timeMatch[1];
        const senderMatch = preText.match(/\]\s*([^:]+):/);
        if (senderMatch && !isOut) senderName = senderMatch[1].trim();
      }

      if (!time) {
        const timeEl = el.querySelector("span[data-testid='msg-meta'], .bubble-time, span");
        if (timeEl) {
          const timeText = timeEl.textContent.trim();
          const timeMatch = timeText.match(/(\d{2}:\d{2})/);
          if (timeMatch) time = timeMatch[1];
        }
      }

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

      if (!msgText) {
        if (el.querySelector("[data-testid='audio-play'], [data-testid='audio-pause'], audio, .audio-player")) {
          msgText = "[Áudio / Mensagem de Voz]";
        } else if (el.querySelector("img, [data-testid='image-thumb'], .image-thumb")) {
          msgText = "[Imagem / Mídia]";
        } else if (el.querySelector("[data-testid='video-play'], video")) {
          msgText = "[Vídeo]";
        } else {
          msgText = el.textContent.replace(/\d{2}:\d{2}$/, "").trim();
        }
      }

      if (msgText && msgText !== "Encaminhada" && msgText !== "Forwarded") {
        parsedMessages.push({
          sender: isOut ? "user" : "contact",
          senderName: senderName,
          text: msgText,
          time: time
        });
      }
    });

    return {
      contactName: contactName,
      messages: parsedMessages.slice(-15)
    };
  }

  // 2. Instagram DM Scraping
  static scrapeInstagramDM() {
    const container = this.findInstagramMessageContainer();
    let contactName = this.extractInstagramContactName(container);
    let contactUsername = "";
    
    // Extract username from Header link
    try {
      const headerLinks = document.querySelectorAll("div[role='main'] header a, main header a, section header a");
      for (const link of headerLinks) {
        const href = link.getAttribute("href") || "";
        const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
        if (match && match[1] && !['direct', 'explore', 'accounts', 'p', 'reel', 'stories'].includes(match[1])) {
          contactUsername = match[1];
          break;
        }
      }

      if (!contactUsername) {
        const titleEls = document.querySelectorAll("div[role='main'] header span[title], main header span[title]");
        for (const el of titleEls) {
          const title = el.getAttribute("title") || "";
          if (title && title.length > 1 && title.length < 40) {
            contactUsername = title;
            break;
          }
        }
      }

      if (contactUsername && !contactName) {
        contactName = contactUsername;
      }
    } catch (e) {
      console.warn("[ContextEngine] Erro ao extrair username na DM:", e);
    }

    const dmMessages = [];
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const midpoint = containerRect.left + containerRect.width / 2;
      const topThreshold = containerRect.top + 80;
      const bottomThreshold = containerRect.bottom - 100;

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
        if (rect.width > 0 && rect.height > 0 && rect.top >= topThreshold && rect.bottom <= bottomThreshold) {
          candidatesWithLayout.push({
            element: el,
            text: text,
            rect: rect
          });
        }
      });

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

      uniqueCandidates.forEach(c => {
        const text = c.text;
        if (text === contactName) return;
        
        const elCenter = c.rect.left + c.rect.width / 2;
        const distance = Math.abs(elCenter - midpoint);
        
        const isCentered = distance < (containerRect.width * 0.08);
        if (isCentered && text.length < 25) {
          return;
        }
        
        const isOut = elCenter > midpoint;

        // Message time detection (if any timestamp element nearby)
        let time = "";
        try {
          const siblingTime = c.element.querySelector("span[color*='secondary'], span[style*='color'], div[style*='color']");
          if (siblingTime) {
            const tText = siblingTime.textContent.trim();
            if (/^\d{1,2}:\d{2}$/.test(tText)) time = tText;
          }
        } catch (err) {}

        dmMessages.push({
          sender: isOut ? "user" : "contact",
          senderName: isOut ? "Você" : contactName,
          text: text,
          time: time
        });
      });
    }

    return {
      contactName: contactName,
      contactUsername: contactUsername,
      messages: dmMessages.slice(-15)
    };
  }

  // Helper: Find DM message container
  static findInstagramMessageContainer() {
    const activeTextarea = document.querySelector("textarea, [contenteditable='true']");
    if (activeTextarea) {
      let current = activeTextarea;
      for (let i = 0; i < 15; i++) {
        if (!current.parentElement) break;
        current = current.parentElement;

        const sibling = current.previousElementSibling;
        if (sibling && sibling.getBoundingClientRect().height > 250) {
          const scrollable = sibling.querySelector("div[style*='overflow-y'], div[style*='overflow: scroll'], div[style*='overflow: auto']");
          if (scrollable) return scrollable;
          return sibling;
        }
      }
    }

    const scrollableDivs = Array.from(document.querySelectorAll("div[style*='overflow-y'], div[style*='overflow: scroll']"));
    const bestScrollable = scrollableDivs.find(div => {
      const rect = div.getBoundingClientRect();
      return rect.height > 300 && rect.width > 250 && div.querySelectorAll("div[dir='auto']").length > 4;
    });

    if (bestScrollable) return bestScrollable;

    const mainElement = document.querySelector("div[role='main'] section, main section");
    if (mainElement) {
      const innerScrollable = mainElement.querySelector("div[style*='overflow']");
      if (innerScrollable) return innerScrollable;
      return mainElement;
    }

    return document.querySelector("div[role='main']");
  }

  // Helper: Extract DM Contact Name
  static extractInstagramContactName(container) {
    let name = "";
    
    // 1. Search for online indicator and walk to name sibling
    const statusIndicators = Array.from(document.querySelectorAll("span, div")).filter(el => {
      const t = el.textContent.trim().toLowerCase();
      return t === "online" || t.startsWith("ativo ") || t.startsWith("active ") || t.startsWith("online ");
    });

    for (let indicator of statusIndicators) {
      let parent = indicator.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!parent) break;
        const links = parent.querySelectorAll("a, span[style*='font-weight'], div[style*='font-weight']");
        for (let link of links) {
          const txt = link.textContent.trim();
          if (txt && txt.length > 2 && txt !== indicator.textContent.trim()) {
            name = txt;
            break;
          }
        }
        if (name) break;
        parent = parent.parentElement;
      }
      if (name) break;
    }

    if (name) return name;

    // 2. Search main header links
    const header = document.querySelector("div[role='main'] header, main header");
    if (header) {
      const links = header.querySelectorAll("a, span");
      for (let link of links) {
        const txt = link.textContent.trim();
        if (txt && txt.length > 2 && !txt.includes("\n") && !txt.includes("Active") && !txt.includes("Ativo") && !txt.includes("online")) {
          return txt;
        }
      }
    }

    return "Conversa Direct";
  }

  // 3. Instagram Profile Scraping
  static scrapeInstagramProfile() {
    const url = window.location.href;
    const pathname = window.location.pathname.split("/").filter(Boolean);
    const username = pathname[0];

    const profile = {
      username: username,
      fullName: "",
      bio: "",
      website: "",
      followers: 0,
      following: 0,
      posts: 0,
      isVerified: false,
      category: "",
      profilePicUrl: ""
    };

    try {
      const headerSection = document.querySelector("header section");
      if (headerSection) {
        // Name
        const nameEl = headerSection.querySelector("h1, h2, span[style*='font-weight: 600']");
        if (nameEl) {
          profile.fullName = nameEl.textContent.trim();
        }

        // Verified
        const verifiedEl = headerSection.querySelector("svg[aria-label*='Verificado'], svg[aria-label*='Verified'], svg[title*='Verified'], span[title*='Verified']");
        profile.isVerified = !!verifiedEl;

        // Profile Picture
        const imgEl = document.querySelector("header img");
        if (imgEl) {
          profile.profilePicUrl = imgEl.getAttribute("src") || "";
        }

        // Category (Usually grey text)
        const allSpans = Array.from(headerSection.querySelectorAll("span, div"));
        const categoryEl = allSpans.find(el => {
          const style = window.getComputedStyle(el);
          const color = style.color; // Usually grey: rgb(142, 142, 142) or similar
          return (color.includes("142") || color.includes("115") || el.classList.contains("_ap30")) && el.textContent.trim().length > 2 && !el.querySelector("a") && el.textContent.trim().length < 40 && !/seguidores|followers|following|seguindo|publicações|posts/i.test(el.textContent);
        });
        if (categoryEl) {
          profile.category = categoryEl.textContent.trim();
        }

        // Website / Links
        const linkEl = headerSection.querySelector("a[target='_blank'], a[href*='l.php']");
        if (linkEl) {
          profile.website = linkEl.getAttribute("href") || linkEl.textContent.trim();
          // Decodes instagram l.php links if applicable
          if (profile.website.includes("instagram.com/l.php?u=")) {
            const urlObj = new URL(profile.website);
            profile.website = urlObj.searchParams.get("u") || profile.website;
          }
        }

        // Bio: Find the longest text div in the header section that doesn't contain buttons or numbers
        const divs = Array.from(headerSection.querySelectorAll("div"));
        let maxBioLength = 0;
        divs.forEach(div => {
          const txt = div.textContent.trim();
          if (txt && !div.querySelector("button") && !div.querySelector("li") && !/seguidores|followers|following|seguindo|publicações|posts/i.test(txt)) {
            if (txt.length > maxBioLength && txt.length < 300) {
              maxBioLength = txt.length;
              profile.bio = txt;
            }
          }
        });
      }

      // Followers, Following, Posts counts via regex (language-agnostic)
      const pageText = document.body.textContent;
      
      const countsTextElements = Array.from(document.querySelectorAll("header li, header span, header a"));
      countsTextElements.forEach(el => {
        const txt = el.textContent.trim();
        
        const postMatch = txt.match(/([\d.,]+[KkMm]?)\s*(?:publicações|posts)/i);
        if (postMatch) profile.posts = this.parseInstagramNumber(postMatch[1]);

        const followerMatch = txt.match(/([\d.,]+[KkMm]?)\s*(?:seguidores|followers)/i);
        if (followerMatch) profile.followers = this.parseInstagramNumber(followerMatch[1]);

        const followingMatch = txt.match(/([\d.,]+[KkMm]?)\s*(?:seguindo|following)/i);
        if (followingMatch) profile.following = this.parseInstagramNumber(followingMatch[1]);
      });

      // Fallback from document title or global description if values are 0
      if (profile.followers === 0 || profile.following === 0) {
        const metaDesc = document.querySelector("meta[name='description']");
        if (metaDesc) {
          const descVal = metaDesc.getAttribute("content");
          const followMatch = descVal.match(/([\d.,]+[KkMm]?)\s*(?:Followers|Seguidores)/i);
          if (followMatch) profile.followers = this.parseInstagramNumber(followMatch[1]);

          const followingMatch = descVal.match(/([\d.,]+[KkMm]?)\s*(?:Following|Seguindo)/i);
          if (followingMatch) profile.following = this.parseInstagramNumber(followingMatch[1]);

          const postMatch = descVal.match(/([\d.,]+[KkMm]?)\s*(?:Posts|Publicações)/i);
          if (postMatch) profile.posts = this.parseInstagramNumber(postMatch[1]);
        }
      }

    } catch (e) {
      console.error("[ContextEngine] Erro ao parsear perfil:", e);
    }

    return {
      contactName: `@${username}`,
      contactUsername: username,
      contactBio: profile.bio,
      profile: profile,
      messages: [{ sender: "system", senderName: "Perfil", text: `Perfil: @${username}\nNome: ${profile.fullName}\nBio: ${profile.bio}\nSeguidores: ${profile.followers}\nSeguindo: ${profile.following}\nPosts: ${profile.posts}\nVerified: ${profile.isVerified ? 'Sim' : 'Não'}` }]
    };
  }

  // 4. Instagram Post or Reel Scraping
  static scrapeInstagramPostOrReel(type) {
    const authorEl = document.querySelector("header a[href*='/'], h2 a[href*='/'], a[style*='font-weight: 600']");
    const authorName = authorEl ? authorEl.textContent.trim() : "Autor do Post";

    // Extract caption (Instagram uses h1 or div._a9zs span for caption)
    const captionEl = document.querySelector("h1, div._a9zs span, ._a9zs");
    const captionText = captionEl ? captionEl.textContent.trim() : "";

    // Extract hashtags/mentions from caption
    const postHashtags = this.extractHashtags(captionText);
    const postMentions = this.extractMentions(captionText);

    // Extract likes
    let likes = 0;
    const likesTextElements = Array.from(document.querySelectorAll("button, span, div"));
    for (let el of likesTextElements) {
      const txt = el.textContent.trim();
      const match = txt.match(/([\d.,]+[KkMm]?)\s*(?:curtidas|likes)/i);
      if (match) {
        likes = this.parseInstagramNumber(match[1]);
        break;
      }
    }

    // Extract comments
    const comments = [];
    if (captionText) {
      comments.push({
        sender: "contact",
        senderName: authorName,
        text: `[Legenda do Post]: ${captionText}`,
        time: ""
      });
    }

    const commentListItems = document.querySelectorAll("ul._a9z6, ul._a9za, div[role='dialog'] ul li, ul li, [role='listitem']");
    commentListItems.forEach(el => {
      const usernameEl = el.querySelector("h3 a, h2 a, a[style*='font-weight: 600'], a[href*='/']");
      if (!usernameEl) return;
      const commenter = usernameEl.textContent.trim();
      if (commenter === authorName && comments.length > 1) {
        // Skip author's comment duplicate caption if already captured
        const txt = el.textContent.trim();
        if (txt.includes(captionText.substring(0, 30))) return;
      }

      const textSpans = Array.from(el.querySelectorAll("span"));
      const commentTextEl = textSpans.find(span => {
        const text = span.textContent.trim();
        return text.length > 0 && 
               text !== commenter && 
               !span.querySelector("a") && 
               !text.match(/^\d+[smhd]/) && 
               text !== "Reply" && text !== "Responder" &&
               text !== "See translation" && text !== "Ver tradução";
      });

      if (commenter && commentTextEl) {
        // Comment Likes (if available near comments)
        let cLikes = 0;
        const likeBtn = el.querySelector("button[title*='like'], button[title*='curtir']");
        // Often comment has a tiny button with number of likes
        const cLikesEl = el.querySelector("span[style*='color'], button");
        if (cLikesEl) {
          const match = cLikesEl.textContent.trim().match(/(\d+)\s*(?:like|curtida)/i);
          if (match) cLikes = parseInt(match[1], 10);
        }

        comments.push({
          sender: commenter === authorName ? "author" : "contact",
          senderName: commenter,
          text: commentTextEl.textContent.trim(),
          likes: cLikes,
          time: ""
        });
      }
    });

    const postContext = {
      author: authorName,
      caption: captionText,
      hashtags: postHashtags,
      mentions: postMentions,
      likes: likes,
      commentsCount: comments.length - (captionText ? 1 : 0),
      comments: comments.slice(1, 11), // 10 top comments
      mediaType: type === "reel" ? "reel" : "post"
    };

    return {
      contactName: authorName,
      post: postContext,
      messages: comments.slice(-12) // Last 12 for the chat sidebar to read
    };
  }

  // 5. Instagram Feed Scraping
  static scrapeInstagramFeed() {
    const articles = document.querySelectorAll("article");
    const visiblePosts = [];

    articles.forEach((art, index) => {
      const rect = art.getBoundingClientRect();
      // Only process articles that are somewhat visible in viewport
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const authorEl = art.querySelector("header a[href*='/'], h2 a[href*='/'], a[style*='font-weight: 600']");
        const author = authorEl ? authorEl.textContent.trim() : "Autor";
        
        const captionEl = art.querySelector("h1, div._a9zs span, ._a9zs");
        const caption = captionEl ? captionEl.textContent.trim() : "";

        visiblePosts.push({
          index: index,
          author: author,
          caption: caption.substring(0, 100) + (caption.length > 100 ? "..." : "")
        });
      }
    });

    return {
      contactName: "Feed Principal",
      feedPosts: visiblePosts,
      messages: [{ sender: "system", senderName: "Feed", text: `Navegando no Feed principal. Encontrados ${visiblePosts.length} posts visíveis. Post mais alto por: ${visiblePosts[0]?.author || 'Desconhecido'}` }]
    };
  }

  // 6. Instagram Story Scraping
  static scrapeInstagramStory() {
    const authorEl = document.querySelector("header a, main a[href*='/'], section a[href*='/'], a[style*='font-weight: 600']");
    const author = authorEl ? authorEl.textContent.trim() : "Autor Story";

    // Stories usually don't have text comments but can have stickers, text elements overlays.
    const textOverlays = [];
    const textEls = document.querySelectorAll("span[style*='color'], div[style*='color']");
    textEls.forEach(el => {
      const text = el.textContent.trim();
      // Look for relative layout elements with styled text overlay
      if (text && text.length > 1 && text.length < 150 && !el.querySelector("a")) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          textOverlays.push(text);
        }
      }
    });

    return {
      contactName: author,
      story: {
        author: author,
        textOverlays: [...new Set(textOverlays)]
      },
      messages: [{ sender: "system", senderName: "Story", text: `Visualizando Stories de @${author}. Texto na tela: ${textOverlays.join(" | ")}` }]
    };
  }

  // Auto Scroll and Deep scraping for Fase 5
  static async autoScrollAndScrape(container, maxScrolls = 5) {
    console.log(`[ContextEngine] Iniciando auto-scroll no contêiner. Máximo scrolls: ${maxScrolls}`);
    const scrollTarget = container || window;
    let scrollCount = 0;
    
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (scrollCount >= maxScrolls) {
          clearInterval(interval);
          console.log("[ContextEngine] Auto-scroll finalizado.");
          resolve(this.scrapeDeep());
          return;
        }

        if (scrollTarget === window) {
          window.scrollBy(0, 400);
        } else {
          scrollTarget.scrollTop += 300;
        }

        scrollCount++;
      }, 600);
    });
  }

  // Clica no botão de carregar mais comentários (Fase 5)
  static async loadMoreComments() {
    const loadButtons = Array.from(document.querySelectorAll("button, span[role='button']")).filter(btn => {
      const txt = btn.textContent.toLowerCase();
      return txt.includes("ver mais") || txt.includes("load more") || txt.includes("plus de") || txt.includes("view replies") || txt.includes("ver respostas");
    });

    if (loadButtons.length > 0) {
      console.log(`[ContextEngine] Localizados ${loadButtons.length} botões de comentários. Clicando no primeiro...`);
      loadButtons[0].click();
      return new Promise(r => setTimeout(r, 1200)); // Espera carregar os novos elementos
    }
    return Promise.resolve();
  }

  // Coleta URLs das imagens visíveis (Fase 5)
  static scrapeVisibleImages() {
    const images = Array.from(document.querySelectorAll("img")).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > 50 && rect.height > 50 && rect.top < window.innerHeight && rect.bottom > 0;
    });

    return images.map(img => ({
      src: img.getAttribute("src"),
      alt: img.getAttribute("alt") || "",
      width: img.naturalWidth || img.clientWidth,
      height: img.naturalHeight || img.clientHeight
    }));
  }

  // --- Auxiliaries and Utility Parsers ---

  // Parses followers/posts count like "1.2M" or "25,4K" into real integer
  static parseInstagramNumber(val) {
    if (!val) return 0;
    let clean = val.replace(/\s+/g, "").replace(",", ".").trim().toLowerCase();
    let multiplier = 1;

    if (clean.endsWith("k")) {
      multiplier = 1000;
      clean = clean.slice(0, -1);
    } else if (clean.endsWith("m")) {
      multiplier = 1000000;
      clean = clean.slice(0, -1);
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num * multiplier);
  }

  // Extracts hashtags
  static extractHashtags(text) {
    if (!text) return [];
    const matches = text.match(/#([a-zA-Z0-9_À-ÿ]+)/g);
    return matches ? matches.map(h => h.toLowerCase()) : [];
  }

  // Extracts mentions
  static extractMentions(text) {
    if (!text) return [];
    const matches = text.match(/@([a-zA-Z0-9._]+)/g);
    return matches ? matches.map(m => m.toLowerCase()) : [];
  }

  // Extracts dominant emojis
  static extractEmojis(text) {
    if (!text) return [];
    const regex = /[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    const matches = text.match(regex);
    return matches ? Array.from(new Set(matches)) : [];
  }

  // Traverses the entire DOM to extract all visible text in viewport
  static getVisibleText() {
    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const rect = parent.getBoundingClientRect();
          const style = window.getComputedStyle(parent);
          
          // Reject hidden, extension containers, or script/style nodes
          if (
            style.display === "none" || 
            style.visibility === "hidden" || 
            style.opacity === "0" ||
            parent.closest("#vexx-sidebar-container, #vexx-copilot-trigger") ||
            ["script", "style", "noscript", "iframe"].includes(parent.tagName.toLowerCase())
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Only accept if inside or close to viewport
          if (rect.top < window.innerHeight + 200 && rect.bottom > -200 && rect.width > 0) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      const text = currentNode.textContent.trim();
      if (text) textNodes.push(text);
    }

    return textNodes.join(" | ");
  }

  // Builds a semantic structure of headers and sections
  static getStructuredDOM() {
    const structure = { headers: [], sections: [] };
    try {
      const headings = document.querySelectorAll("h1, h2, h3, h4");
      headings.forEach(h => {
        if (!h.closest("#vexx-sidebar-container")) {
          structure.headers.push({
            tag: h.tagName.toLowerCase(),
            text: h.textContent.trim()
          });
        }
      });

      const sections = document.querySelectorAll("article, section, [role='main']");
      sections.forEach((sec, idx) => {
        if (!sec.closest("#vexx-sidebar-container")) {
          const secTitle = sec.querySelector("h2, h3")?.textContent.trim() || `Seção ${idx + 1}`;
          structure.sections.push({
            title: secTitle,
            role: sec.getAttribute("role") || sec.tagName.toLowerCase()
          });
        }
      });
    } catch (e) {}
    
    return structure;
  }

  static mapDOMIntelligence() {
    const map = {
      inputs: [],
      buttons: [],
      dropdowns: [],
      links: [],
      menus: [],
      forms: [],
      tables: [],
      modals: [],
      charts: []
    };

    try {
      // 1. Inputs & Textareas
      const inputElements = document.querySelectorAll("input, textarea, [contenteditable='true'], [role='textbox']");
      inputElements.forEach((el, index) => {
        if (index > 30) return;
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        if (!visible) return;
        
        let label = el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.name || el.id || "";
        if (!label) {
          const parentLabel = el.closest("label")?.textContent?.trim();
          if (parentLabel) label = parentLabel;
        }
        
        map.inputs.push({
          type: el.tagName.toLowerCase() === "input" ? el.getAttribute("type") || "text" : "textbox",
          label: label.substring(0, 50),
          placeholder: (el.getAttribute("placeholder") || "").substring(0, 50),
          id: el.id || "",
          name: el.name || "",
          value: el.tagName.toLowerCase() === "input" && el.type === "password" ? "[senha]" : (el.value || el.textContent || "").substring(0, 100),
          coords: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)]
        });
      });

      // 2. Buttons
      const buttonElements = document.querySelectorAll("button, input[type='button'], input[type='submit'], [role='button'], a.btn, a.button");
      buttonElements.forEach((el, index) => {
        if (index > 30) return;
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        if (!visible) return;

        const text = el.textContent?.trim() || el.getAttribute("aria-label") || el.value || el.title || "";
        if (!text) return;

        map.buttons.push({
          text: text.substring(0, 50),
          id: el.id || "",
          className: el.className || "",
          coords: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)]
        });
      });

      // 3. Dropdowns
      const selectElements = document.querySelectorAll("select, [role='listbox'], [aria-haspopup='listbox']");
      selectElements.forEach((el, index) => {
        if (index > 15) return;
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        if (!visible) return;

        map.dropdowns.push({
          id: el.id || "",
          label: (el.getAttribute("aria-label") || el.name || "").substring(0, 50),
          optionsCount: el.options ? el.options.length : 0,
          coords: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)]
        });
      });

      // 4. Links
      const linkElements = document.querySelectorAll("a[href]");
      linkElements.forEach((el, index) => {
        if (index > 30) return;
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        if (!visible) return;

        const text = el.textContent?.trim() || "";
        const href = el.getAttribute("href") || "";
        if (!text && !el.querySelector("img, svg")) return;

        map.links.push({
          text: text.substring(0, 50) || "[Link com imagem/ícone]",
          href: href.startsWith("http") ? href : window.location.origin + href,
          coords: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)]
        });
      });

      // 5. Menus
      const menuElements = document.querySelectorAll("nav, [role='navigation'], [role='menubar'], header nav, sidebar nav");
      menuElements.forEach((el, index) => {
        if (index > 5) return;
        const links = Array.from(el.querySelectorAll("a")).map(a => a.textContent?.trim()).filter(Boolean);
        map.menus.push({
          role: el.getAttribute("role") || "nav",
          items: links.slice(0, 10)
        });
      });

      // 6. Forms
      const formElements = document.querySelectorAll("form");
      formElements.forEach((el, index) => {
        if (index > 5) return;
        const inputs = Array.from(el.querySelectorAll("input, textarea")).map(i => i.name || i.placeholder || i.id).filter(Boolean);
        map.forms.push({
          id: el.id || "",
          action: el.getAttribute("action") || "",
          fields: inputs
        });
      });

      // 7. Tables
      const tableElements = document.querySelectorAll("table");
      tableElements.forEach((el, index) => {
        if (index > 5) return;
        const headers = Array.from(el.querySelectorAll("th")).map(th => th.textContent?.trim()).filter(Boolean);
        const rows = el.querySelectorAll("tr").length;
        map.tables.push({
          headers: headers.slice(0, 10),
          rowCount: rows
        });
      });

      // 8. Modals / Dialogs
      const modalElements = document.querySelectorAll("[role='dialog'], .modal, .popup, .dialog, [id*='modal'], [class*='modal']");
      modalElements.forEach((el, index) => {
        if (index > 5) return;
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 100 && rect.height > 100 && window.getComputedStyle(el).display !== 'none';
        if (!visible) return;

        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'absolute') return;

        const title = el.querySelector("h1, h2, h3, h4, .modal-title, .title")?.textContent?.trim() || "Modal Sem Título";
        map.modals.push({
          title: title.substring(0, 50),
          coords: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)]
        });
      });

      // 9. Charts
      const chartElements = document.querySelectorAll("canvas, svg, [class*='chart'], [id*='chart']");
      chartElements.forEach((el, index) => {
        if (index > 5) return;
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 50 && rect.height > 50 && window.getComputedStyle(el).display !== 'none';
        if (!visible) return;

        const className = el.className || "";
        const id = el.id || "";
        const isChart = (typeof className === 'string' && className.toLowerCase().includes('chart')) || 
                        (typeof id === 'string' && id.toLowerCase().includes('chart')) ||
                        el.tagName.toLowerCase() === 'canvas';
        if (!isChart) return;

        map.charts.push({
          tag: el.tagName.toLowerCase(),
          id: id,
          coords: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)]
        });
      });

    } catch (e) {
      console.error("[DOMIntelligence] Erro ao mapear DOM:", e);
    }

    return map;
  }

  static detectFrameworks() {
    const info = {
      framework: "Custom HTML/JS",
      libraries: [],
      architecture: "Client-Server Monolith",
      apis: [],
      database: "Não Identificado"
    };

    try {
      const html = document.documentElement.innerHTML;
      const scripts = Array.from(document.querySelectorAll("script")).map(s => s.src || s.textContent || "");

      // 1. Framework
      if (window.React || document.querySelector("[data-reactroot]") || html.includes("react-data") || scripts.some(s => s.includes("react"))) {
        info.framework = "React";
        if (html.includes("_next/static") || window.__NEXT_DATA__) {
          info.framework = "Next.js (React)";
          info.architecture = "SSR / Jamstack";
        }
      } else if (window.Vue || html.includes("v-") || scripts.some(s => s.includes("vue"))) {
        info.framework = "Vue.js";
        if (html.includes("nuxt") || window.__NUXT__) {
          info.framework = "Nuxt.js (Vue)";
          info.architecture = "SSR / Static Site";
        }
      } else if (window.angular || html.includes("ng-version") || html.includes("ng-app")) {
        info.framework = "Angular";
        info.architecture = "SPA (Single Page App)";
      } else if (window.jQuery || scripts.some(s => s.includes("jquery"))) {
        info.framework = "jQuery / Vanilla JS";
      }

      // 2. Libraries
      if (window.Redux || html.includes("redux")) info.libraries.push("Redux");
      if (window.TailwindCss || html.includes("tailwind") || Array.from(document.styleSheets).some(s => {
        try { return Array.from(s.cssRules || []).some(r => r.tw || r.selectorText?.includes('.tw-') || r.cssText?.includes('--tw-')); } catch(e) { return false; }
      })) {
        info.libraries.push("TailwindCSS");
      }
      if (window.bootstrap || html.includes("bootstrap")) info.libraries.push("Bootstrap");
      if (window.Chart || html.includes("chart.js")) info.libraries.push("Chart.js");
      if (window.FramerMotion || html.includes("framer-motion")) info.libraries.push("Framer Motion");

      // 3. APIs / Services
      if (html.includes("supabase.co") || window.supabase || scripts.some(s => s.includes("supabase"))) {
        info.apis.push("Supabase REST/Realtime API");
        info.database = "PostgreSQL (via Supabase)";
      }
      if (html.includes("firebaseio.com") || window.firebase || scripts.some(s => s.includes("firebase"))) {
        info.apis.push("Firebase Firestore/RTDB");
        info.database = "NoSQL Firestore";
      }
      if (html.includes("api.stripe.com") || window.Stripe) info.apis.push("Stripe Payment API");
      if (html.includes("graphql") || html.includes("__typename")) {
        info.apis.push("GraphQL API");
      }

      // Find probable APIs based on URL fetch patterns in scripts
      const scriptsUrls = Array.from(document.querySelectorAll("script[src]")).map(s => s.src);
      scriptsUrls.forEach(url => {
        if (url.includes("api.")) {
          try {
            const domain = new URL(url).hostname;
            if (!info.apis.includes(domain)) info.apis.push(domain);
          } catch(e){}
        }
      });

      // Default Architecture heuristically
      if (info.framework.includes("Next.js") || info.framework.includes("Nuxt.js")) {
        info.architecture = "Jamstack / Serverless Microservices";
      } else if (info.apis.length > 0) {
        info.architecture = "Client-Directed API Backend (SPA)";
      }

    } catch (e) {
      console.error("[SiteReverseEngineering] Erro no reverse engineering:", e);
    }

    return info;
  }

  static detectUserActivity() {
    const url = window.location.href;
    const title = document.title || "";
    let activity = "Navegando";

    try {
      if (url.includes("github.com")) {
        if (url.includes("/edit/") || url.includes("/_edit/")) {
          activity = "Editando código direto no repositório";
        } else if (url.includes("/pull/")) {
          activity = "Revisando Pull Request";
        } else if (url.includes("/issues/new")) {
          activity = "Criando Issue";
        } else if (url.includes("/issues/")) {
          activity = "Discutindo Issue";
        } else if (url.includes("/blob/")) {
          activity = "Visualizando arquivo de código";
        } else {
          activity = "Navegando no repositório GitHub";
        }
      } else if (url.includes("figma.com")) {
        if (url.includes("/file/")) {
          activity = "Projetando interface UI/UX no Figma";
        } else if (url.includes("/proto/")) {
          activity = "Testando protótipo interativo no Figma";
        } else {
          activity = "Navegando no Figma";
        }
      } else if (url.includes("canva.com")) {
        if (url.includes("/design/")) {
          activity = "Criando arte gráfica no Canva";
        } else {
          activity = "Navegando no Canva";
        }
      } else if (url.includes("supabase.com") || url.includes("supabase.co")) {
        if (url.includes("/editor/")) {
          activity = "Editando banco de dados no Supabase";
        } else if (url.includes("/sql")) {
          activity = "Executando queries SQL no Supabase";
        } else {
          activity = "Configurando serviços no Supabase";
        }
      } else if (url.includes("firebase.google.com")) {
        activity = "Gerenciando backend no Firebase Console";
      } else if (url.includes("youtube.com")) {
        if (url.includes("watch?v=")) {
          activity = `Assistindo vídeo: "${title.replace(" - YouTube", "")}"`;
        } else {
          activity = "Navegando no YouTube";
        }
      } else if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
        activity = "Consultando inteligência artificial (ChatGPT)";
      } else {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
          const form = activeEl.closest('form');
          const placeholder = activeEl.getAttribute('placeholder') || '';
          if (placeholder.toLowerCase().includes('buscar') || placeholder.toLowerCase().includes('pesquisar')) {
            activity = "Pesquisando conteúdo na página";
          } else if (activeEl.type === 'password') {
            activity = "Preenchendo formulário de login/segurança";
          } else if (form) {
            activity = "Preenchendo formulário de dados";
          } else {
            activity = "Digitando texto na página";
          }
        } else {
          activity = `Lendo conteúdo em "${title}"`;
        }
      }
    } catch(e){}

    return activity;
  }
}

// Attach to window for global content scope access
window.ContextEngine = ContextEngine;
