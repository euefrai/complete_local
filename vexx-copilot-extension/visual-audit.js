// Vexx AI Copilot — Interactive Visual Audit Module

class VisualAuditManager {
  constructor() {
    this.isActive = false;
    this.step = 0;
    this.history = [];
    this.scrollResolve = null;
    this.lastReport = null;
    this.lastHistory = [];
  }

  // Starts the audit workflow
  async start() {
    if (this.isActive) return;

    this.isActive = true;
    this.step = 1;
    this.history = [];

    this.updateUIState("active");
    showToast("🔍 Iniciando Auditoria Visual Passo a Passo!", "info");

    const resultsDiv = document.getElementById("copilot-results");
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div class="response-card" style="border-left: 4px solid var(--color-accent-amethyst); background: rgba(167, 139, 250, 0.03);">
          <div class="response-body" style="font-size: 12px; color: var(--color-text-secondary); text-align: center; padding: 10px;">
            <i class="ti ti-device-analytics" style="font-size: 16px; margin-bottom: 4px; display: block;"></i>
            <strong>Sessão de Auditoria Visual Iniciada</strong><br>
            A IA analisará a parte visível da tela. Prossiga rolando a tela conforme as instruções.
          </div>
        </div>
      ` + resultsDiv.innerHTML;
    }

    await this.processCurrentView();
  }

  // Requests page scroll, waits for confirmation, then captures and processes the new view
  async nextStep() {
    if (!this.isActive) return;

    this.step += 1;
    this.updateUIState("loading");

    // 1. Send scroll command to content script
    window.parent.postMessage({
      source: "vexx-sidebar",
      action: "SCROLL_PAGE",
      payload: { amount: window.innerHeight * 0.7 }
    }, "*");

    // 2. Wait for scroll animation to settle
    showToast("Rolando a página...", "info");
    await new Promise((resolve) => {
      this.scrollResolve = resolve;
    });

    // Small stabilization delay
    await new Promise(r => setTimeout(r, 300));

    await this.processCurrentView();
  }

  // Stops the audit and generates the final action plan summary
  async stop() {
    if (!this.isActive) return;

    if (this.history.length === 0) {
      showToast("Nenhuma parte foi analisada com sucesso para gerar o relatório.", "warning");
      this.isActive = false;
      this.step = 0;
      this.history = [];
      this.updateUIState("idle");
      return;
    }

    this.updateUIState("loading");
    showToast("Finalizando auditoria e compilando plano...", "info");

    try {
      // Prompt for consolidation using the accumulated history
      let historyText = "";
      this.history.forEach(item => {
        historyText += `\n--- ANÁLISE DA PARTE ${item.step} ---\n${item.analysis}\n`;
      });

      const prompt = `Você analisou ${this.history.length} partes do perfil do Instagram deste lead. Aqui estão as observações detalhadas de cada parte:\n${historyText}\n\nCom base nessas observações de identidade visual, design, CTAs e conteúdo, elabore um plano de ação tático consolidado (formato Markdown) com as 5 melhorias prioritárias de design e conversão que este perfil precisa aplicar para aumentar seguidores e fechar mais vendas. Seja prático, persuasivo e objetivo.`;
      
      const payload = {
        provider: (configuredProviders && configuredProviders.gemini !== false) ? "gemini" : "openai",
        model: (configuredProviders && configuredProviders.gemini !== false) ? "gemini-2.5-flash" : "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5
      };

      const response = await callChatAPI(payload);
      this.lastReport = response;
      this.lastHistory = [...this.history];

      // Render Final Report
      const resultsDiv = document.getElementById("copilot-results");
      if (resultsDiv) {
        const formatted = response.replace(/\n/g, "<br>");
        resultsDiv.innerHTML = `
          <div class="response-card consensus-card" style="border-left: 4px solid var(--color-text-success); background: rgba(151, 196, 89, 0.03);">
            <div class="response-header">
              <div class="response-agent-info">
                <div class="mini-avatar success-bg"><i class="ti ti-trophy"></i></div>
                <span class="response-agent-name" style="color: var(--color-text-success);">Relatório Final da Auditoria</span>
              </div>
            </div>
            <div class="response-body" style="font-size: 13px; line-height: 1.5; color: var(--color-text-primary);">
              ${formatted}
            </div>
            <div class="response-actions">
              <button class="mini-btn mini-btn-save" data-action="save-lead" data-text="${encodeURIComponent(response)}"><i class="ti ti-bookmark"></i> Salvar no CRM</button>
            </div>
          </div>
        ` + resultsDiv.innerHTML;
      }

      showToast("🏆 Auditoria concluída! Relatório gerado.", "success");

    } catch (e) {
      showToast("Erro ao finalizar auditoria: " + e.message, "danger");
    } finally {
      this.isActive = false;
      this.step = 0;
      this.history = [];
      this.updateUIState("idle");
    }
  }

  // Internal: captures screenshot, sends to vision API and renders step result
  async processCurrentView() {
    this.updateUIState("loading");

    try {
      // 1. Capture screen via background proxy
      const dataUrl = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "CAPTURE_SCREENSHOT" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (response && response.success) {
            resolve(response.dataUrl);
          } else {
            reject(new Error(response ? response.error : "Erro na captura"));
          }
        });
      });

      // Show screenshot in the preview area
      const previewArea = document.getElementById("screenshot-area");
      const imgPreview = document.getElementById("screenshot-preview");
      if (previewArea && imgPreview) {
        imgPreview.src = dataUrl;
        previewArea.classList.remove("hidden");
      }

      // 2. Vision API Call
      let prompt = "";
      if (this.step === 1) {
        prompt = "Você é o Auditor Visual do Vexx Copilot, um especialista sênior em design de conversão, marketing e branding no Instagram. Analise a imagem da tela (Parte 1). Forneça um feedback estruturado contendo:\n1. 🎨 Identidade Visual (Cores, Fontes, Harmonização)\n2. 📄 Legibilidade e Clareza da Proposta de Valor\n3. 💡 Recomendações Imediatas de Melhoria.\nNo final da resposta, escreva apenas uma linha curta solicitando para o usuário rolar a página para a próxima seção e clicar em 'Analisar Próxima Parte'.";
      } else {
        prompt = `Você está auditando a Parte ${this.step} da tela do perfil do usuário. Com base na imagem anterior e nesta nova imagem, analise os novos posts/conteúdos carregados e forneça:\n1. 📊 Análise do Design dos Posts / Linha Editorial\n2. ✍️ Qualidade das Chamadas de Ação (CTA) e Thumbnails\n3. 💡 Dicas de Ajuste.\nNo final da resposta, escreva apenas uma linha curta solicitando para o usuário rolar a página para a próxima seção ou clicar em 'Parar' para ver o Relatório Final.`;
      }

      let chosenProvider = "openai"; 
      let chosenModel = "gpt-4o-mini";

      if (configuredProviders && configuredProviders.gemini !== false) {
        chosenProvider = "gemini";
        chosenModel = "gemini-2.5-flash";
      }

      const payload = {
        provider: chosenProvider,
        model: chosenModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0.7
      };

      const response = await callChatAPI(payload);
      this.history.push({ step: this.step, analysis: response });

      // Render Step Result
      const resultsDiv = document.getElementById("copilot-results");
      if (resultsDiv) {
        const formatted = response.replace(/\n/g, "<br>");
        resultsDiv.innerHTML = `
          <div class="response-card" style="border-left: 4px solid var(--color-accent-amethyst);">
            <div class="response-header">
              <div class="response-agent-info">
                <div class="mini-avatar purple-bg"><i class="ti ti-device-analytics"></i></div>
                <span class="response-agent-name">Auditoria Visual (Parte ${this.step})</span>
              </div>
            </div>
            <div class="response-body" style="font-size: 13px; line-height: 1.5; color: var(--color-text-primary);">
              ${formatted}
            </div>
          </div>
        ` + resultsDiv.innerHTML;
      }

      this.updateUIState("active");

    } catch (err) {
      console.error("[VisualAudit] Erro ao auditar view:", err);
      showToast("Erro ao processar parte " + this.step + ": " + err.message, "danger");
      this.updateUIState("active");
    }
  }

  // Manages the state of the UI controls
  updateUIState(state) {
    const btnStart = document.getElementById("btn-start-audit");
    const btnNext = document.getElementById("btn-next-audit-step");
    const btnStop = document.getElementById("btn-stop-audit");
    const progressDiv = document.getElementById("audit-progress");
    const countEl = document.getElementById("audit-parts-count");
    const spinner = document.getElementById("audit-loading-spinner");
    const badge = document.getElementById("audit-status-badge");

    if (countEl) countEl.textContent = this.step;

    switch (state) {
      case "active":
        if (btnStart) btnStart.classList.add("hidden");
        if (btnNext) {
          btnNext.classList.remove("hidden");
          btnNext.disabled = false;
        }
        if (btnStop) {
          btnStop.classList.remove("hidden");
          btnStop.disabled = false;
        }
        if (progressDiv) progressDiv.classList.remove("hidden");
        if (spinner) spinner.classList.add("hidden");
        if (badge) {
          badge.textContent = `Parte ${this.step}`;
          badge.style.display = "inline-block";
        }
        break;

      case "loading":
        if (btnNext) btnNext.disabled = true;
        if (btnStop) btnStop.disabled = true;
        if (spinner) spinner.classList.remove("hidden");
        break;

      case "idle":
      default:
        if (btnStart) btnStart.classList.remove("hidden");
        if (btnNext) btnNext.classList.add("hidden");
        if (btnStop) btnStop.classList.add("hidden");
        if (progressDiv) progressDiv.classList.add("hidden");
        if (spinner) spinner.classList.add("hidden");
        if (badge) badge.style.display = "none";
        break;
    }
  }

  // Resolves the pending scroll promise when SCROLL_DONE arrives
  handleScrollDone() {
    if (this.scrollResolve) {
      this.scrollResolve();
      this.scrollResolve = null;
    }
  }
}

// Global instance in sidebar context
const visualAuditManager = new VisualAuditManager();
window.visualAuditManager = visualAuditManager;

// Listen to messages from content.js
window.addEventListener("message", (event) => {
  if (event.data && event.data.source === "vexx-content") {
    if (event.data.action === "SCROLL_DONE") {
      visualAuditManager.handleScrollDone();
    }
  }
});
