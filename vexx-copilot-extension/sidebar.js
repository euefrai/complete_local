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
