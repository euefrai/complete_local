// Vexx AI Copilot — Main Orchestrator and Initialization

document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedSettings();
  renderAgentsGrid();
  setupListeners();
  checkServerHealth();
  
  // Roda verificação de health check a cada 5 segundos e armazena o ID
  healthCheckIntervalId = setInterval(checkServerHealth, 5000);

  // Inicializa a Command Palette (Fase 4)
  if (typeof commandPalette !== "undefined" && typeof commandPalette.init === "function") {
    commandPalette.init();
  }

  // Inicializa módulos enterprise
  if (typeof setupQuickActionsListener === "function") setupQuickActionsListener();
  if (typeof loadLeads === "function") {
    await loadLeads();
    renderLeadsPanel();
  }
  if (typeof setupLeadsListeners === "function") setupLeadsListeners();

  // Inicializa o modo de abertura (Sidebar, Overlay, Mini, Full)
  initViewMode();

  // Solicita scrape inicial da página
  requestScrape();
});

// Escuta dados de contexto vindos do content.js
window.addEventListener("message", (event) => {
  if (event.data && event.data.source === "vexx-content") {
    const { action, payload } = event.data;
    
    if (action === "CONTEXT_UPDATED") {
      pageContext = payload;
      updateContextUI();
      if (typeof resolveActivePageIntelligence === "function") resolveActivePageIntelligence();
    }

    if (action === "PAGE_MUTATION_DETECTED") {
      showToast(`⚡ Nova ${payload.type} detectada na página! Recarregando contexto...`, "info");
      if (activeTab === 'workspace' && typeof requestWorkspaceState === "function") {
        requestWorkspaceState();
      }
    }

    // Feedback do Auto-Type (injeção de texto no chat)
    if (action === "INSERT_RESULT") {
      if (payload && payload.success) {
        showToast("✅ Texto inserido no chat com sucesso!", "success");
      } else {
        showToast("Não foi possível inserir o texto no campo de chat.", "warning");
      }
    }

    if (action === "AUTOMATION_RESULT") {
      // Find all run-automation buttons and restore their states
      const runButtons = document.querySelectorAll(".btn-run-automation");
      runButtons.forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = `<i class="ti ti-play" style="margin-right: 4px;"></i> Executar Ações na Tela`;
      });

      if (payload && payload.success) {
        showToast("✅ Automação concluída com sucesso na tela!", "success");
      } else {
        showToast("❌ Falha na automação: " + (payload ? payload.error : "Erro desconhecido"), "danger");
      }
    }
  }
});

// Binds de eventos programáticos (sem inline HTML handlers)
function setupListeners() {
  // Configuração dos botões de modo
  const modeSingle = document.getElementById("mode-single");
  if (modeSingle) modeSingle.addEventListener("click", () => setArenaMode(false));
  const modeDebate = document.getElementById("mode-debate");
  if (modeDebate) modeDebate.addEventListener("click", () => setArenaMode(true));

  // Configuração dos botões de navegação
  const tabCopilot = document.getElementById("tab-copilot");
  if (tabCopilot) tabCopilot.addEventListener("click", () => switchTab('copilot'));
  const tabArena = document.getElementById("tab-arena");
  if (tabArena) tabArena.addEventListener("click", () => switchTab('arena'));
  const tabSettings = document.getElementById("tab-settings");
  if (tabSettings) tabSettings.addEventListener("click", () => switchTab('settings'));
  const tabSocial = document.getElementById("tab-social");
  if (tabSocial) tabSocial.addEventListener("click", () => {
    switchTab('social');
    if (typeof checkAuth === "function") checkAuth();
  });
  
  const tabWorkspace = document.getElementById("tab-workspace");
  if (tabWorkspace) tabWorkspace.addEventListener("click", () => switchTab('workspace'));

  // Botão de recarregar contexto da tela
  const btnRefreshContext = document.getElementById("btn-refresh-context");
  if (btnRefreshContext) btnRefreshContext.addEventListener("click", requestScrape);
  
  // Botão de recarregar visualizador de debug de scraping
  const btnDebugRefresh = document.getElementById("btn-debug-refresh");
  if (btnDebugRefresh) btnDebugRefresh.addEventListener("click", requestScrape);

  // Seletor de tom e campo custom
  const toneSelect = document.getElementById("tone-select");
  if (toneSelect) {
    toneSelect.addEventListener("change", () => {
      const customInput = document.getElementById("custom-prompt-input");
      if (customInput) {
        if (toneSelect.value === "custom") {
          customInput.classList.remove("hidden");
        } else {
          customInput.classList.add("hidden");
        }
      }
    });
  }

  // Botão de gerar resposta no Copilot
  const btnGenerateReplies = document.getElementById("btn-generate-replies");
  if (btnGenerateReplies) btnGenerateReplies.addEventListener("click", generateReplies);

  // Input de chat da Arena e botão de envio
  const chatInput = document.getElementById("arena-chat-input");
  if (chatInput) {
    chatInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        sendArenaMessage();
      }
    });
  }
  const btnSendArena = document.getElementById("btn-send-arena");
  if (btnSendArena) btnSendArena.addEventListener("click", sendArenaMessage);

  // Botões de ajustes
  const btnResetUsage = document.getElementById("btn-reset-usage");
  if (btnResetUsage) btnResetUsage.addEventListener("click", resetUsageTracker);
  const btnRestorePrompt = document.getElementById("btn-restore-prompt");
  if (btnRestorePrompt) btnRestorePrompt.addEventListener("click", restoreDefaultSystemPrompt);
  const btnSaveSettings = document.getElementById("btn-save-settings");
  if (btnSaveSettings) btnSaveSettings.addEventListener("click", saveSettings);

  // Botão de voz (VoiceRecorder)
  const btnVoice = document.getElementById("btn-voice-input");
  if (btnVoice && typeof voiceRecorder !== "undefined") {
    btnVoice.addEventListener("click", () => voiceRecorder.toggle());
  }

  // Botão de Detalhes Profundos do Contexto (Fase 1)
  const btnDeepToggle = document.getElementById("context-deep-toggle");
  if (btnDeepToggle) {
    btnDeepToggle.addEventListener("click", () => {
      const deepContainer = document.getElementById("context-deep-container");
      if (deepContainer) {
        const isHidden = deepContainer.classList.contains("hidden");
        if (isHidden) {
          deepContainer.classList.remove("hidden");
          btnDeepToggle.innerHTML = '<i class="ti ti-chevron-up"></i> Ocultar Detalhes';
        } else {
          deepContainer.classList.add("hidden");
          btnDeepToggle.innerHTML = '<i class="ti ti-chevron-down"></i> Detalhes Profundos';
        }
      }
    });
  }

  // Botões de Screenshot e Análise Visual (Fase 2)
  const btnCaptureScreen = document.getElementById("btn-capture-screen");
  if (btnCaptureScreen && typeof captureScreenshot === "function") {
    btnCaptureScreen.addEventListener("click", captureScreenshot);
  }
  const btnAnalyzeVisual = document.getElementById("btn-analyze-visual");
  if (btnAnalyzeVisual && typeof analyzeScreenshot === "function") {
    btnAnalyzeVisual.addEventListener("click", analyzeScreenshot);
  }

  // Botões de Auditoria Visual (visual-audit.js)
  const btnStartAudit = document.getElementById("btn-start-audit");
  if (btnStartAudit && typeof visualAuditManager !== "undefined") {
    btnStartAudit.addEventListener("click", () => visualAuditManager.start());
  }
  const btnNextAuditStep = document.getElementById("btn-next-audit-step");
  if (btnNextAuditStep && typeof visualAuditManager !== "undefined") {
    btnNextAuditStep.addEventListener("click", () => visualAuditManager.nextStep());
  }
  const btnStopAudit = document.getElementById("btn-stop-audit");
  if (btnStopAudit && typeof visualAuditManager !== "undefined") {
    btnStopAudit.addEventListener("click", () => visualAuditManager.stop());
  }

  // Botões de Memória (Fase 3)
  const btnExportMemory = document.getElementById("btn-export-memory");
  if (btnExportMemory && typeof MemoryStore !== "undefined") {
    btnExportMemory.addEventListener("click", async () => {
      try {
        const memoryData = await MemoryStore.exportAll();
        const blob = new Blob([JSON.stringify(memoryData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vexx_memory_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Memória exportada com sucesso!", "success");
      } catch (err) {
        showToast("Erro ao exportar memória: " + err.message, "danger");
      }
    });
  }

  const btnClearMemory = document.getElementById("btn-clear-memory");
  if (btnClearMemory && typeof MemoryStore !== "undefined") {
    btnClearMemory.addEventListener("click", async () => {
      if (confirm("Tem certeza que deseja apagar todo o histórico de perfis e interações na memória do Vexx?")) {
        try {
          await MemoryStore.clearAll();
          showToast("Memória limpa com sucesso!", "success");
          if (typeof renderMemoryPanel === "function") renderMemoryPanel();
        } catch (err) {
          showToast("Erro ao limpar memória: " + err.message, "danger");
        }
      }
    });
  }

  // Event Delegation para copiar, injetar e gerar imagens no Copilot
  const resultsDiv = document.getElementById("copilot-results");
  if (resultsDiv) {
    resultsDiv.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      
      const action = btn.dataset.action;
      if (!action) return;
      
      if (action === "copy" || action === "insert") {
        const encodedText = btn.dataset.text;
        if (!encodedText) return;
        const text = decodeURIComponent(encodedText);
        
        if (action === "copy") {
          navigator.clipboard.writeText(text).then(() => {
            const originalText = btn.innerHTML;
            btn.innerHTML = `<i class="ti ti-check"></i> Copiado!`;
            setTimeout(() => {
              btn.innerHTML = originalText;
            }, 1500);
          }).catch(err => {
            showToast("Erro ao copiar: " + (err && err.message ? err.message : String(err)), "danger");
          });
        } else if (action === "insert") {
          window.parent.postMessage({
            source: "vexx-sidebar",
            action: "INSERT_TEXT",
            text: text
          }, "*");
        }
      } 
      
      else if (action === "save-lead") {
        const encodedText = btn.dataset.text;
        const text = encodedText ? decodeURIComponent(encodedText) : "";
        if (typeof saveLead === "function") {
          saveLead(text);
          // Feedback visual no botão
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `<i class="ti ti-check"></i> Salvo!`;
          btn.style.borderColor = "var(--color-text-success)";
          btn.style.color = "var(--color-text-success)";
          setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.borderColor = "";
            btn.style.color = "";
          }, 2000);
        }
      }
      
      else if (action === "generate-image") {
        const encodedPrompt = btn.dataset.prompt;
        if (!encodedPrompt) return;
        const prompt = decodeURIComponent(encodedPrompt);
        
        const cardSection = btn.closest(".image-gen-section");
        if (!cardSection) return;
        
        const previewEl = cardSection.querySelector(".image-gen-preview");
        
        btn.classList.add("hidden");
        if (previewEl) previewEl.classList.remove("hidden");
        
        try {
          chrome.runtime.sendMessage({
            action: "GENERATE_IMAGE",
            payload: { prompt: prompt }
          }, (response) => {
            if (chrome.runtime.lastError) {
              showToast("Erro na extensão: " + chrome.runtime.lastError.message, "danger");
              btn.classList.remove("hidden");
              if (previewEl) previewEl.classList.add("hidden");
              return;
            }
            
            if (response && response.success && response.dataUrl) {
              if (previewEl) {
                previewEl.innerHTML = `
                  <img src="${response.dataUrl}" alt="Imagem Gerada" style="width: 100%; border-radius: 8px; margin-top: 8px; border: 0.5px solid var(--color-border-subtle); box-shadow: 0 4px 12px rgba(0,0,0,0.5);" />
                  <a href="${response.dataUrl}" download="vexx_image_${Date.now()}.webp" class="mini-btn mini-btn-primary" style="margin-top: 8px; display: inline-flex; width: 100%; justify-content: center; text-decoration: none; box-sizing: border-box; align-items: center; gap: 6px;">
                    <i class="ti ti-download"></i> Baixar Imagem
                  </a>
                `;
              }
            } else {
              showToast("Falha ao gerar imagem: " + (response ? response.error : "Erro desconhecido"), "danger");
              btn.classList.remove("hidden");
              if (previewEl) {
                previewEl.classList.add("hidden");
              }
            }
          });
        } catch (err) {
          showToast("Erro ao contatar extensão: " + err.message, "danger");
          btn.classList.remove("hidden");
          if (previewEl) previewEl.classList.add("hidden");
        }
      }
    });
  }
  setupWorkspaceListeners();
}

function resetUsageTracker() {
  if (confirm("Deseja zerar os contadores de uso da extensão?")) {
    usageCount = 0;
    saveSettingsLocally();
    updateUsageDashboard();
  }
}

async function saveSettings() {
  const textarea = document.getElementById("system-prompt-override");
  if (textarea) {
    systemPromptOverride = textarea.value;
    await saveSettingsLocally();
    
    const status = document.getElementById("save-status");
    if (status) {
      status.classList.remove("hidden");
      setTimeout(() => {
        status.classList.add("hidden");
      }, 1500);
    }
  }
}

function restoreDefaultSystemPrompt() {
  if (confirm("Deseja restaurar as diretrizes padrões do Copilot?")) {
    systemPromptOverride = DEFAULT_SYSTEM_PROMPT;
    const textarea = document.getElementById("system-prompt-override");
    if (textarea) textarea.value = DEFAULT_SYSTEM_PROMPT;
    saveSettingsLocally();
  }
}

// Dispara o auto-scroll no host DOM
function triggerAutoScrollScrape() {
  window.parent.postMessage({
    source: "vexx-sidebar",
    action: "AUTOSCROLL_SCRAPE"
  }, "*");
}

let workspaceProject = "Desenvolvimento do App Fitness";
let currentSiteIntelligence = null;
let selectedSynopsisLength = "short";

function setupWorkspaceListeners() {
  const btnSaveProject = document.getElementById("btn-save-project");
  if (btnSaveProject) {
    btnSaveProject.addEventListener("click", () => {
      const projInput = document.getElementById("workspace-project-input");
      if (projInput && projInput.value.trim()) {
        const val = projInput.value.trim();
        workspaceProject = val;
        try {
          chrome.runtime.sendMessage({
            action: "SET_WORKSPACE_PROJECT",
            payload: { project: val }
          }, (res) => {
            if (chrome.runtime.lastError) {
              console.warn("SET_WORKSPACE_PROJECT failed:", chrome.runtime.lastError.message);
              return;
            }
            showToast("💼 Projeto salvo no Workspace!", "success");
            requestWorkspaceState();
          });
        } catch (e) {
          console.warn("SET_WORKSPACE_PROJECT failed:", e.message);
        }
      }
    });
  }

  const synContainer = document.querySelector(".synopsis-tabs");
  if (synContainer) {
    synContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".syn-tab-btn");
      if (!btn) return;
      
      document.querySelectorAll(".syn-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedSynopsisLength = btn.dataset.len;
      updateSynopsisDisplay();
    });
  }

  const btnAddTask = document.getElementById("btn-add-task");
  if (btnAddTask) {
    btnAddTask.addEventListener("click", async () => {
      const input = document.getElementById("workspace-task-input");
      if (input && input.value.trim()) {
        projectGoals.push({
          text: input.value.trim(),
          done: false
        });
        input.value = "";
        await saveWorkspaceGoals();
        renderWorkspaceGoals();
        renderRelationshipGraph();
        showToast("🎯 Objetivo adicionado!", "success");
      }
    });
  }

  const taskInput = document.getElementById("workspace-task-input");
  if (taskInput) {
    taskInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter" && taskInput.value.trim()) {
        projectGoals.push({
          text: taskInput.value.trim(),
          done: false
        });
        taskInput.value = "";
        await saveWorkspaceGoals();
        renderWorkspaceGoals();
        renderRelationshipGraph();
        showToast("🎯 Objetivo adicionado!", "success");
      }
    });
  }
}

function requestWorkspaceState() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
  try {
    chrome.runtime.sendMessage({ action: "GET_WORKSPACE_STATE" }, (state) => {
      if (chrome.runtime.lastError) {
        console.warn("GET_WORKSPACE_STATE failed:", chrome.runtime.lastError.message);
        return;
      }
      if (state) {
        renderWorkspace(state);
      }
    });
  } catch (e) {
    console.warn("GET_WORKSPACE_STATE failed:", e.message);
  }
}

function renderWorkspace(state) {
  workspaceProject = state.project || "Desenvolvimento do App Fitness";
  const projInput = document.getElementById("workspace-project-input");
  if (projInput && document.activeElement !== projInput) {
    projInput.value = workspaceProject;
  }
  
  // Renderiza Abas
  const tabsCount = document.getElementById("workspace-tabs-count");
  const tabsList = document.getElementById("workspace-tabs-list");
  if (tabsCount) tabsCount.textContent = state.tabs ? state.tabs.length : 0;
  
  if (tabsList) {
    const tabs = state.tabs || [];
    if (tabs.length === 0) {
      tabsList.innerHTML = `<div class="empty-state text-secondary italic" style="font-size: 11px; text-align: center; padding: 10px;">Nenhuma aba aberta no workspace.</div>`;
    } else {
      tabsList.innerHTML = tabs.map(t => {
        return `
          <div class="workspace-tab-item" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: 6px; font-size: 11px; margin-bottom: 4px;">
            <span class="text-primary" style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;" title="${t.title}">${t.title}</span>
            <span class="tab-badge ${t.platform}">${t.platform}</span>
          </div>
        `;
      }).join("");
    }
  }
  
  // Renderiza Erros
  const errCount = document.getElementById("observer-errors-count");
  const errList = document.getElementById("observer-errors-list");
  if (errCount) errCount.textContent = state.errorLogs ? state.errorLogs.length : 0;
  
  if (errList) {
    const errors = state.errorLogs || [];
    if (errors.length === 0) {
      errList.innerHTML = `
        <div class="empty-state text-success italic" style="font-size: 11px; text-align: center; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(151,196,89,0.03); border-radius: 6px; border: 0.5px dashed rgba(151,196,89,0.15);">
          <i class="ti ti-shield-check" style="font-size:14px;"></i> Nenhum erro detectado na página ativa.
        </div>
      `;
    } else {
      errList.innerHTML = errors.map((err, idx) => {
        const encodedMsg = encodeURIComponent(`Conserte este erro no meu site:\nMensagem: ${err.message}\nStack trace: ${err.stack}\nURL: ${err.url}`);
        return `
          <div class="error-item" style="background: rgba(239, 68, 68, 0.04); border: 0.5px solid rgba(239, 68, 68, 0.15); border-radius: 6px; padding: 8px; font-size: 11px; margin-bottom: 6px;">
            <div class="error-item-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; color: #ef4444; font-weight: 600;">
              <span>[${err.type}] ${err.timestamp}</span>
              <button class="mini-btn" onclick="switchTab('arena'); setTimeout(() => { const inp = document.getElementById('arena-chat-input'); if(inp) { inp.value = decodeURIComponent('${encodedMsg}'); const send = document.getElementById('btn-send-arena'); if(send) send.click(); } }, 300);" style="background:#ef4444; color:white; font-size:9px; height:18px; padding:0 6px; border:none; border-radius:4px; cursor:pointer;">Corrigir</button>
            </div>
            <div class="error-item-msg" style="color: #fca5a5; margin-bottom: 4px; font-family: var(--font-mono); font-size: 10px; word-break: break-all;">${err.message}</div>
            <div class="text-tertiary" style="font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Origem: ${err.url}</div>
          </div>
        `;
      }).join("");
    }
  }
  
  // Renderiza Session Replay
  const replayList = document.getElementById("session-replay-list");
  if (replayList) {
    const replay = state.sessionReplay || [];
    if (replay.length === 0) {
      replayList.innerHTML = `<div class="empty-state text-secondary italic" style="font-size: 11px; text-align: center; padding: 10px;">Aguardando interações do usuário...</div>`;
    } else {
      replayList.innerHTML = [...replay].reverse().map(log => {
        return `
          <div class="replay-log-item" style="display: flex; gap: 8px; font-size: 10.5px; padding: 4px 6px; border-bottom: 0.5px solid var(--color-border-tertiary);">
            <span class="replay-log-time" style="color: var(--color-text-tertiary); font-family: var(--font-mono); flex-shrink: 0;">${log.timestamp}</span>
            <span class="replay-log-text" style="color: var(--color-text-secondary);">${log.text}</span>
          </div>
        `;
      }).join("");
    }
  }
 
  if (typeof loadWorkspaceGoals === "function") {
    loadWorkspaceGoals().then(() => {
      renderWorkspaceGoals();
      renderRelationshipGraph();
    });
  } else {
    renderRelationshipGraph();
  }
}

function resolveActivePageIntelligence() {
  if (!pageContext || !pageContext.url || pageContext.url.startsWith("chrome")) return;
  
  let domain = "web";
  try {
    const urlObj = new URL(pageContext.url);
    domain = urlObj.hostname;
  } catch(e) {
    return;
  }
  
  const loadingDiv = document.getElementById("intel-loading");
  const contentDiv = document.getElementById("intel-content");
  
  if (loadingDiv) loadingDiv.classList.remove("hidden");
  if (contentDiv) contentDiv.classList.add("hidden");
  
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
  try {
    chrome.runtime.sendMessage({
      action: "RESOLVE_SITE_INTELLIGENCE",
      payload: {
        domain: domain,
        url: pageContext.url,
        title: pageContext.contactName || domain,
        visibleText: pageContext.visibleText || "",
        reverseEngineering: pageContext.reverseEngineering || {}
      }
    }, (response) => {
      if (loadingDiv) loadingDiv.classList.add("hidden");
      if (contentDiv) contentDiv.classList.remove("hidden");
      
      if (chrome.runtime.lastError) {
        console.warn("RESOLVE_SITE_INTELLIGENCE failed:", chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.success && response.data) {
        currentSiteIntelligence = response.data;
        renderSiteIntelligence();
        if (typeof MemoryStore !== "undefined") {
          MemoryStore.saveRelationship(domain, workspaceProject);
        }
        renderRelationshipGraph();
      }
    });
  } catch (e) {
    if (loadingDiv) loadingDiv.classList.add("hidden");
    if (contentDiv) contentDiv.classList.remove("hidden");
    console.warn("RESOLVE_SITE_INTELLIGENCE failed:", e.message);
  }
}

function renderSiteIntelligence() {
  if (!currentSiteIntelligence) return;
  
  const nameEl = document.getElementById("intel-site-name");
  const catEl = document.getElementById("intel-site-category");
  const objEl = document.getElementById("intel-site-objective");
  const audEl = document.getElementById("intel-site-audience");
  const featEl = document.getElementById("intel-site-features");
  const riskEl = document.getElementById("intel-site-risks");
  
  const fwEl = document.getElementById("reverse-framework");
  const archEl = document.getElementById("reverse-architecture");
  const dbEl = document.getElementById("reverse-database");
  const libEl = document.getElementById("reverse-libraries");
  const apiEl = document.getElementById("reverse-apis");
  
  if (nameEl) nameEl.textContent = currentSiteIntelligence.siteName || "Web Page";
  if (catEl) catEl.textContent = currentSiteIntelligence.category || "General";
  if (objEl) objEl.textContent = currentSiteIntelligence.objective || "-";
  if (audEl) audEl.textContent = currentSiteIntelligence.targetAudience || "-";
  
  if (featEl) {
    const features = currentSiteIntelligence.features || [];
    featEl.innerHTML = features.length > 0 ? features.map(f => `<li>${f}</li>`).join("") : "<li>Nenhuma detectada</li>";
  }
  
  if (riskEl) {
    const risks = currentSiteIntelligence.risks || [];
    riskEl.innerHTML = risks.length > 0 ? risks.map(r => `<li>${r}</li>`).join("") : "<li>Nenhum risco detectado</li>";
  }
  
  // Synopsis Answers
  const whatIsEl = document.getElementById("synopsis-what-is");
  const whatIsForEl = document.getElementById("synopsis-what-is-for");
  const whoUsesEl = document.getElementById("synopsis-who-uses");
  const howWorksEl = document.getElementById("synopsis-how-works");
  
  if (whatIsEl) whatIsEl.textContent = currentSiteIntelligence.whatIs || "-";
  if (whatIsForEl) whatIsForEl.textContent = currentSiteIntelligence.whatIsFor || "-";
  if (whoUsesEl) whoUsesEl.textContent = currentSiteIntelligence.whoUsesIt || "-";
  if (howWorksEl) howWorksEl.textContent = currentSiteIntelligence.howItWorks || "-";

  updateSynopsisDisplay();
  
  const rev = currentSiteIntelligence.reverseEngineering || {};
  if (fwEl) fwEl.textContent = rev.framework || "-";
  if (archEl) archEl.textContent = rev.architecture || "-";
  if (dbEl) dbEl.textContent = rev.database || "-";
  
  if (libEl) {
    const libs = rev.libraries || [];
    libEl.innerHTML = libs.length > 0 ? libs.map(l => `<span class="tech-badge" style="margin-right: 4px; margin-bottom: 4px;">${l}</span>`).join("") : `<span class="text-tertiary" style="font-size:10px;">Nenhuma detectada</span>`;
  }
  
  if (apiEl) {
    const apis = rev.apis || [];
    apiEl.innerHTML = apis.length > 0 ? apis.map(a => `<span class="tech-badge" style="background:rgba(151,196,89,0.06); border-color:rgba(151,196,89,0.2); color:var(--color-text-success); margin-right: 4px; margin-bottom: 4px;">${a}</span>`).join("") : `<span class="text-tertiary" style="font-size:10px;">Nenhuma detectada</span>`;
  }

  // Knowledge Map
  const kmModEl = document.getElementById("km-modules");
  const kmFlowEl = document.getElementById("km-flows");
  const kmDepEl = document.getElementById("km-dependencies");
  const km = currentSiteIntelligence.knowledgeMap || {};
  
  if (kmModEl) kmModEl.innerHTML = km.modules && km.modules.length > 0 ? km.modules.map(m => `<div style="padding: 2px 4px; background: rgba(255,255,255,0.03); border-radius:4px; margin-bottom:2px; font-weight:500;">• ${m}</div>`).join("") : "-";
  if (kmFlowEl) kmFlowEl.innerHTML = km.flows && km.flows.length > 0 ? km.flows.map(f => `<div style="padding: 2px 4px; color: var(--color-accent-amethyst); background: rgba(167,139,250,0.03); border-radius:4px; margin-bottom:2px;">→ ${f}</div>`).join("") : "-";
  if (kmDepEl) kmDepEl.innerHTML = km.dependencies && km.dependencies.length > 0 ? km.dependencies.map(d => `<span class="tech-badge" style="margin-right:4px; margin-bottom:4px;">${d}</span>`).join("") : "-";
}

function updateSynopsisDisplay() {
  const synEl = document.getElementById("intel-site-synopsis");
  if (!synEl || !currentSiteIntelligence) return;
  
  let text = "";
  if (selectedSynopsisLength === "short") {
    text = currentSiteIntelligence.shortSummary || "";
  } else if (selectedSynopsisLength === "medium") {
    text = currentSiteIntelligence.mediumSummary || "";
  } else if (selectedSynopsisLength === "full") {
    text = currentSiteIntelligence.fullSummary || "";
  }
  
  synEl.textContent = text || "-";
}

let projectGoals = [];

async function loadWorkspaceGoals() {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    const fallback = localStorage.getItem(`vexx_goals_${workspaceProject}`);
    projectGoals = fallback ? JSON.parse(fallback) : [];
    return;
  }
  return new Promise((resolve) => {
    chrome.storage.local.get([`vexx_goals_${workspaceProject}`], (res) => {
      projectGoals = res[`vexx_goals_${workspaceProject}`] || [];
      resolve();
    });
  });
}

async function saveWorkspaceGoals() {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    localStorage.setItem(`vexx_goals_${workspaceProject}`, JSON.stringify(projectGoals));
    return;
  }
  return new Promise((resolve) => {
    chrome.storage.local.set({ [`vexx_goals_${workspaceProject}`]: projectGoals }, () => {
      resolve();
    });
  });
}

function renderWorkspaceGoals() {
  const container = document.getElementById("workspace-tasks-list");
  if (!container) return;
  
  if (projectGoals.length === 0) {
    container.innerHTML = `<div class="empty-state text-secondary italic" style="font-size: 11px; text-align: center; padding: 10px;">Nenhum objetivo cadastrado.</div>`;
    return;
  }
  
  container.innerHTML = projectGoals.map((g, idx) => {
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: 6px; font-size: 11px; margin-bottom: 4px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-decoration: ${g.done ? 'line-through' : 'none'}; color: ${g.done ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)'}; flex: 1; margin:0;">
          <input type="checkbox" class="task-checkbox" data-idx="${idx}" ${g.done ? 'checked' : ''} style="cursor: pointer; accent-color: var(--color-accent-amethyst);" />
          <span>${g.text}</span>
        </label>
        <button class="btn-delete-task" data-idx="${idx}" style="background: transparent; border: none; color: #ef4444; cursor: pointer; display: flex; align-items: center; padding: 2px;"><i class="ti ti-trash"></i></button>
      </div>
    `;
  }).join("");
  
  container.querySelectorAll(".task-checkbox").forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const idx = parseInt(e.target.dataset.idx);
      projectGoals[idx].done = e.target.checked;
      await saveWorkspaceGoals();
      renderWorkspaceGoals();
      renderRelationshipGraph();
    });
  });
  
  container.querySelectorAll(".btn-delete-task").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx);
      projectGoals.splice(idx, 1);
      await saveWorkspaceGoals();
      renderWorkspaceGoals();
      renderRelationshipGraph();
    });
  });
}

async function renderRelationshipGraph() {
  const container = document.getElementById("relationship-graph");
  if (!container) return;
  
  if (typeof MemoryStore === "undefined") {
    container.innerHTML = `<div class="text-secondary italic" style="font-size: 11px; text-align: center;">Módulo de armazenamento não disponível.</div>`;
    return;
  }
  
  const rels = await MemoryStore.getRelationships();
  let activeDomain = null;
  if (pageContext && pageContext.url) {
    try {
      activeDomain = new URL(pageContext.url).hostname;
    } catch(e){}
  }
  
  const domainsInProject = Object.entries(rels)
    .filter(([dom, proj]) => proj === workspaceProject)
    .map(([dom, proj]) => dom);
    
  if (activeDomain && !domainsInProject.includes(activeDomain) && !activeDomain.startsWith("chrome")) {
    domainsInProject.push(activeDomain);
  }
  
  if (domainsInProject.length === 0 && projectGoals.length === 0) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px;">
        <div class="graph-node project"><i class="ti ti-briefcase" style="color:var(--color-accent-amethyst);"></i> ${workspaceProject}</div>
        <div class="graph-edge"></div>
        <div class="graph-node" style="color:var(--color-text-tertiary); font-style:italic;"><i class="ti ti-link"></i> Sem conexões mapeadas ainda</div>
      </div>
    `;
    return;
  }
  
  let html = `
    <div style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:5px;">
      <div class="graph-node project"><i class="ti ti-briefcase" style="color:var(--color-accent-amethyst);"></i> ${workspaceProject}</div>
  `;
  
  domainsInProject.forEach((dom) => {
    let border = "";
    if (dom === activeDomain) {
      border = "border-color: var(--color-accent-amethyst); background: rgba(167, 139, 250, 0.04);";
    }
    
    let icon = "ti-world";
    if (dom.includes("github.com")) icon = "ti-brand-github";
    else if (dom.includes("figma.com")) icon = "ti-device-laptop";
    else if (dom.includes("supabase.co") || dom.includes("supabase.com")) icon = "ti-database";
    else if (dom.includes("firebase")) icon = "ti-server";
    else if (dom.includes("youtube.com")) icon = "ti-brand-youtube";
    else if (dom.includes("chatgpt.com") || dom.includes("openai.com")) icon = "ti-cpu";
    else if (dom.includes("whatsapp.com")) icon = "ti-brand-whatsapp";
    else if (dom.includes("instagram.com")) icon = "ti-brand-instagram";
    
    html += `
      <div class="graph-edge"></div>
      <div class="graph-node" style="${border} display: inline-flex; align-items: center; gap: 6px; background: var(--color-background-secondary); border: 0.5px solid var(--color-border-tertiary); padding: 6px 10px; border-radius: 6px; font-size: 11px;">
        <i class="ti ${icon}" style="color:var(--color-accent-amethyst);"></i>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px;">${dom}</span>
        ${dom === activeDomain ? '<span class="badge" style="font-size:7px; padding:1px 3px; background:var(--color-accent-amethyst); color:var(--color-background-primary); font-weight:bold; margin-left:4px;">foco</span>' : ''}
      </div>
    `;
  });

  projectGoals.forEach(g => {
    html += `
      <div class="graph-edge"></div>
      <div class="graph-node" style="border-color: ${g.done ? 'rgba(151,196,89,0.3)' : 'var(--color-border-tertiary)'}; background: ${g.done ? 'rgba(151,196,89,0.02)' : 'var(--color-background-primary)'}; opacity: ${g.done ? 0.6 : 1}; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; font-size: 11px;">
        <i class="ti ${g.done ? 'ti-circle-check text-success' : 'ti-circle-dashed text-secondary'}"></i>
        <span style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-decoration: ${g.done ? 'line-through' : 'none'};">${g.text}</span>
      </div>
    `;
  });
  
  html += `</div>`;
  container.innerHTML = html;
}

function initViewMode() {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
  
  chrome.storage.local.get("vexx_copilot_view_mode", (res) => {
    const mode = res.vexx_copilot_view_mode || "sidebar";
    setActiveModeButton(mode);
    
    // Informa a página pai (content.js) sobre o modo inicial salvo
    window.parent.postMessage({
      source: "vexx-sidebar",
      action: "CHANGE_VIEW_MODE",
      payload: { mode: mode }
    }, "*");
  });

  const modes = ["sidebar", "overlay", "mini", "full"];
  modes.forEach(m => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (btn) {
      btn.addEventListener("click", () => {
        chrome.storage.local.set({ "vexx_copilot_view_mode": m }, () => {
          setActiveModeButton(m);
          window.parent.postMessage({
            source: "vexx-sidebar",
            action: "CHANGE_VIEW_MODE",
            payload: { mode: m }
          }, "*");
        });
      });
    }
  });
}

function setActiveModeButton(mode) {
  const modes = ["sidebar", "overlay", "mini", "full"];
  modes.forEach(m => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (btn) {
      if (m === mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  });
}
