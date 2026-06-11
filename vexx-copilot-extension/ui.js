// UI Rendering and Toast helpers

function renderAgentsGrid() {
  const grid = document.getElementById("agents-grid");
  if (!grid) return;

  if (serverOnline && Object.keys(configuredProviders).length > 0) {
    selectedAgents = selectedAgents.filter(id => configuredProviders[id] !== false);
    const activeAgents = Object.keys(PROVIDERS).filter(id => configuredProviders[id] !== false);
    if (selectedAgents.length === 0 && activeAgents.length > 0) {
      selectedAgents = [activeAgents[0]];
    }
  }

  grid.innerHTML = "";
  Object.keys(PROVIDERS).forEach(id => {
    const p = PROVIDERS[id];
    const isSelected = selectedAgents.includes(id);
    const isConfigured = !serverOnline || (configuredProviders[id] !== false);
    
    const item = document.createElement("div");
    item.className = `agent-item ${isSelected ? 'selected' : ''} ${!serverOnline ? 'offline-server' : ''}`;
    item.id = `agent-item-${id}`;
    
    const configLabel = isConfigured ? '' : ' (Sem Chave API no .env)';
    item.title = `${p.name} (${p.model})${configLabel}`;

    item.innerHTML = `
      <div class="agent-avatar ${p.bgClass}">${p.initials}</div>
      ${isSelected ? '<span class="agent-badge-dot"></span>' : ''}
    `;

    if (isConfigured) {
      item.addEventListener("click", () => handleAgentClick(id));
    } else {
      item.style.pointerEvents = "none";
      item.style.opacity = "0.25";
      item.style.cursor = "not-allowed";
    }
    grid.appendChild(item);
  });
}

function handleAgentClick(id) {
  if (!serverOnline) {
    showToast("Servidor local do wifa jl OS está offline. Inicie o servidor para interagir.", "danger");
    return;
  }

  if (isArenaMode) {
    if (selectedAgents.includes(id)) {
      if (selectedAgents.length > 1) {
        selectedAgents = selectedAgents.filter(a => a !== id);
      } else {
        showToast("Selecione pelo menos um agente para a Arena.", "warning");
      }
    } else {
      selectedAgents.push(id);
    }
  } else {
    selectedAgents = [id];
  }

  saveSettingsLocally();
  renderAgentsGrid();
}

function setArenaMode(arena) {
  isArenaMode = arena;
  
  if (!isArenaMode) {
    selectedAgents = [selectedAgents[0] || 'claude'];
  } else {
    if (selectedAgents.length === 1) {
      const remaining = Object.keys(PROVIDERS).filter(a => a !== selectedAgents[0]);
      selectedAgents.push(remaining[0] || 'gemini');
    }
  }

  updateModeButtons();
  saveSettingsLocally();
  renderAgentsGrid();
}

function updateModeButtons() {
  const btnSingle = document.getElementById("mode-single");
  const btnDebate = document.getElementById("mode-debate");
  
  if (!btnSingle || !btnDebate) return;
  
  if (isArenaMode) {
    btnSingle.classList.remove("active");
    btnDebate.classList.add("active");
  } else {
    btnSingle.classList.add("active");
    btnDebate.classList.remove("active");
  }
}

function switchTab(tabId) {
  activeTab = tabId;
  
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  const tabBtn = document.getElementById(`tab-${tabId}`);
  if (tabBtn) tabBtn.classList.add("active");

  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.remove("active");
  });
  const tabPane = document.getElementById(`pane-${tabId}`);
  if (tabPane) tabPane.classList.add("active");

  if (tabId === 'copilot') {
    requestScrape();
  } else if (tabId === 'settings') {
    if (typeof renderLeadsPanel === "function") renderLeadsPanel();
    if (typeof renderMemoryPanel === "function") renderMemoryPanel();
  }
}

function updateContextUI() {
  if (!pageContext) return;

  const pageTypeEl = document.getElementById("context-page-type");
  const contactNameEl = document.getElementById("context-contact-name");
  const lastMsgEl = document.getElementById("context-last-message");

  if (pageTypeEl) {
    if (pageContext.type === "whatsapp") {
      pageTypeEl.innerHTML = `<i class="ti ti-brand-whatsapp text-success"></i> WhatsApp Web`;
    } else if (pageContext.platform === "instagram" || pageContext.type === "instagram" || pageContext.type === "creation" || pageContext.type === "profile" || pageContext.type === "explore" || pageContext.type === "feed" || pageContext.type === "post" || pageContext.type === "reel" || pageContext.type === "stories") {
      let suffix = "";
      if (pageContext.type === "creation") suffix = " (Criação)";
      else if (pageContext.type === "profile") suffix = " (Perfil)";
      else if (pageContext.type === "explore") suffix = " (Explorar)";
      else if (pageContext.type === "feed") suffix = " (Feed)";
      else if (pageContext.type === "post") suffix = " (Post)";
      else if (pageContext.type === "reel") suffix = " (Reel)";
      else if (pageContext.type === "stories") suffix = " (Stories)";
      pageTypeEl.innerHTML = `<i class="ti ti-brand-instagram" style="color: #e1306c;"></i> Instagram${suffix}`;
    } else {
      pageTypeEl.textContent = "Desconhecido";
    }
  }

  if (contactNameEl) {
    let contactDisplay = pageContext.contactName || "Nenhum chat selecionado";
    if (pageContext.contactUsername) {
      contactDisplay += ` <span class="context-username">@${pageContext.contactUsername}</span>`;
    }
    contactNameEl.innerHTML = contactDisplay;
  }

  // Exibe bio do contato se disponível
  const bioEl = document.getElementById("context-bio");
  if (bioEl) {
    if (pageContext.contactBio) {
      bioEl.innerHTML = `<span class="context-bio-text">${pageContext.contactBio}</span>`;
      bioEl.classList.remove("hidden");
    } else {
      bioEl.classList.add("hidden");
      bioEl.innerHTML = "";
    }
  }

  if (lastMsgEl) {
    if (pageContext.messages && pageContext.messages.length > 0) {
      const last = pageContext.messages[pageContext.messages.length - 1];
      lastMsgEl.innerHTML = `<strong>${last.senderName}:</strong> "${last.text}"`;
      lastMsgEl.classList.remove("italic");
    } else {
      lastMsgEl.textContent = "Nenhuma mensagem encontrada na conversa ativa.";
      lastMsgEl.classList.add("italic");
    }
  }

  // --- RENDERING METADADOS APROFUNDADOS (Fase 1 e Fase 6) ---
  const followersEl = document.getElementById("context-followers");
  const followersRow = followersEl ? followersEl.closest(".context-row") : null;
  if (pageContext.profile && followersRow) {
    followersRow.classList.remove("hidden");
    const p = pageContext.profile;
    followersEl.innerHTML = `<strong>${p.followers.toLocaleString("pt-BR")}</strong> seg. | <strong>${p.following.toLocaleString("pt-BR")}</strong> seg.`;
  } else if (followersRow) {
    followersRow.classList.add("hidden");
  }

  const engagementEl = document.getElementById("context-engagement");
  const engagementRow = engagementEl ? engagementEl.closest(".context-row") : null;
  if (pageContext.post && engagementRow) {
    engagementRow.classList.remove("hidden");
    const po = pageContext.post;
    engagementEl.innerHTML = `<strong>${po.likes.toLocaleString("pt-BR")}</strong> curtidas | <strong>${po.commentsCount}</strong> coment.`;
  } else if (engagementRow) {
    engagementRow.classList.add("hidden");
  }

  // Análise de Sentimento (Fase 6)
  const sentimentEl = document.getElementById("context-sentiment");
  const sentimentRow = sentimentEl ? sentimentEl.closest(".context-row") : null;
  if (sentimentRow) {
    if (pageContext.messages && pageContext.messages.length > 0 && typeof SentimentAnalyzer !== "undefined") {
      const res = SentimentAnalyzer.summarizeAudience(pageContext.messages);
      sentimentRow.classList.remove("hidden");
      sentimentEl.innerHTML = `${res.emoji} <strong>${res.summary}</strong> (${res.percentagePositive}% pos / ${res.percentageNegative}% neg)`;
    } else {
      sentimentRow.classList.add("hidden");
    }
  }

  // Hashtags (Fase 1)
  const hashtagsEl = document.getElementById("context-hashtags");
  const hashtagsRow = hashtagsEl ? hashtagsEl.closest(".context-row") : null;
  if (hashtagsRow) {
    const list = pageContext.hashtags || (pageContext.post && pageContext.post.hashtags) || [];
    if (list.length > 0) {
      hashtagsRow.classList.remove("hidden");
      hashtagsEl.innerHTML = list.map(h => `<span class="hashtag-chip">${h}</span>`).join("");
      
      // Vincula clique para injetar no campo customizado
      hashtagsEl.querySelectorAll(".hashtag-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          const customPrompt = document.getElementById("custom-prompt-input");
          if (customPrompt) {
            customPrompt.value += (customPrompt.value ? " " : "") + chip.textContent;
            customPrompt.classList.remove("hidden");
          }
        });
      });
    } else {
      hashtagsRow.classList.add("hidden");
    }
  }

  // Renderiza Quick Actions contextuais
  if (typeof renderQuickActions === "function") {
    renderQuickActions(pageContext.type);
  }

  // Atualiza a visualização do debug de scraping
  updateDebugScrapingView();
}

function updateDebugScrapingView() {
  const countEl = document.getElementById("debug-msg-count");
  const listEl = document.getElementById("debug-msg-list");
  
  if (!countEl || !listEl) return;
  
  if (!pageContext) {
    countEl.textContent = "0";
    listEl.innerHTML = `<span class="text-secondary italic">Nenhum contexto de página disponível.</span>`;
    return;
  }
  
  const count = pageContext.messages ? pageContext.messages.length : 0;
  countEl.textContent = count;
  
  if (count === 0) {
    listEl.innerHTML = `
      <div style="color: var(--color-text-warning); font-style: italic; line-height: 1.4;">
        Nenhuma mensagem raspada no chat.
        <div style="margin-top: 6px; font-size: 10px; color: var(--color-text-secondary);">
          Dicas:<br>
          1. Certifique-se de que o chat está visível na tela.<br>
          2. Clique em "Recarregar dados da tela" no topo ou no botão do visualizador.<br>
          3. Verifique o console do desenvolvedor da aba (F12) para ver os logs do Vexx Scraper.
        </div>
      </div>
    `;
    return;
  }
  
  let html = "";
  pageContext.messages.forEach((m) => {
    const senderColor = m.sender === "user" ? "var(--color-accent-amethyst)" : "#3b82f6";
    html += `
      <div style="margin-bottom: 6px; border-bottom: 0.5px solid var(--color-border-quaternary); padding-bottom: 6px; line-height: 1.3;">
        <span style="color: ${senderColor}; font-weight: bold;">[${m.sender === "user" ? "VOCÊ" : "CONTATO"}]</span>
        <span style="color: var(--color-text-secondary); font-size: 9px; float: right;">${m.time || ""}</span>
        <div style="color: var(--color-text-primary); margin-top: 2px; font-family: var(--font-family-sans); font-size: 11px;">${m.text}</div>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

function updateUsageDashboard() {
  const usageNum = document.getElementById("main-usage-num");
  const usagePct = document.getElementById("main-usage-pct");
  const totalRequests = document.getElementById("usage-total-requests");
  const usageBar = document.getElementById("main-usage-bar");

  if (usageNum) usageNum.textContent = usageCount;
  if (totalRequests) totalRequests.textContent = usageCount;

  const pct = Math.min(100, Math.round((usageCount / usageLimit) * 100));
  if (usagePct) usagePct.textContent = `${pct}%`;

  if (usageBar) {
    const offset = 100 - pct;
    usageBar.style.strokeDashoffset = offset;

    if (pct >= 90) {
      usageBar.style.stroke = "var(--color-text-danger)";
    } else if (pct >= 75) {
      usageBar.style.stroke = "var(--color-text-warning)";
    } else {
      usageBar.style.stroke = "var(--color-accent-amethyst)";
    }
  }
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.style.position = "fixed";
  toast.style.bottom = "10px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.padding = "8px 16px";
  toast.style.borderRadius = "8px";
  toast.style.fontSize = "12px";
  toast.style.zIndex = "9999";
  toast.style.transition = "opacity 0.2s ease";
  
  if (type === "success") {
    toast.style.backgroundColor = "var(--color-background-success)";
    toast.style.color = "var(--color-text-success)";
    toast.style.border = "0.5px solid var(--color-text-success)";
  } else if (type === "danger") {
    toast.style.backgroundColor = "var(--color-background-danger)";
    toast.style.color = "var(--color-text-danger)";
    toast.style.border = "0.5px solid var(--color-text-danger)";
  } else if (type === "warning") {
    toast.style.backgroundColor = "var(--color-background-warning)";
    toast.style.color = "var(--color-text-warning)";
    toast.style.border = "0.5px solid var(--color-text-warning)";
  } else {
    toast.style.backgroundColor = "var(--color-background-secondary)";
    toast.style.color = "var(--color-text-primary)";
    toast.style.border = "0.5px solid var(--color-border-secondary)";
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// Renderiza os dados salvos na memória persistente na aba Painel (Fase 3)
async function renderMemoryPanel() {
  if (typeof MemoryStore === "undefined") return;

  try {
    const stats = await MemoryStore.getStats();
    
    const profilesEl = document.getElementById("memory-stat-profiles");
    const interactionsEl = document.getElementById("memory-stat-interactions");
    const recurrenceEl = document.getElementById("memory-stat-recurrence");

    if (profilesEl) profilesEl.textContent = stats.totalProfiles;
    if (interactionsEl) interactionsEl.textContent = stats.totalInteractions;
    if (recurrenceEl) recurrenceEl.textContent = stats.visitedMultipleTimes;

    // Recent profiles list
    const recentList = document.getElementById("memory-recent-list");
    if (recentList) {
      const recents = await MemoryStore.getRecentProfiles(5);
      if (recents.length === 0) {
        recentList.innerHTML = `<span class="text-secondary italic" style="font-size: 11px; padding: 4px;">Nenhum perfil memorizado ainda.</span>`;
      } else {
        recentList.innerHTML = recents.map(p => {
          const lastVisitText = new Date(p.lastVisit).toLocaleDateString("pt-BR");
          return `
            <div class="recent-profile-item" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; margin-bottom: 4px; background: rgba(255,255,255,0.02); border-radius: 4px; font-size: 11px; border: 0.5px solid var(--color-border-tertiary);">
              <span style="color: var(--color-accent-amethyst); font-weight: 500;">@${p.username}</span>
              <span style="color: var(--color-text-tertiary); font-size: 10px;">${p.visits} vis. | ${lastVisitText}</span>
            </div>
          `;
        }).join("");
      }
    }

    // Trends
    const trends = await MemoryStore.getTrends();
    const hashtagsEl = document.getElementById("memory-trends-hashtags");
    const nichesEl = document.getElementById("memory-trends-niches");
    const hoursEl = document.getElementById("memory-trends-hours");

    if (hashtagsEl) {
      const topH = Object.entries(trends.hashtags || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0])
        .join(", ");
      hashtagsEl.textContent = topH || "Nenhuma";
    }

    if (nichesEl) {
      const topN = Object.entries(trends.niches || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0])
        .join(", ");
      nichesEl.textContent = topN || "Nenhum";
    }

    if (hoursEl) {
      const topHrs = Object.entries(trends.peakHours || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(e => `${e[0]}h`)
        .join(", ");
      hoursEl.textContent = topHrs || "Nenhum";
    }

  } catch (err) {
    console.warn("Erro ao renderizar painel de memória:", err);
  }
}
