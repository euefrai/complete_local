// Vexx AI Copilot — Screenshot & Visual Analysis Module

async function captureScreenshot() {
  const btnCapture = document.getElementById("btn-capture-screen");
  const previewArea = document.getElementById("screenshot-area");
  const imgPreview = document.getElementById("screenshot-preview");
  
  if (btnCapture) {
    btnCapture.disabled = true;
    btnCapture.innerHTML = '<i class="ti ti-loader-2 voice-spin"></i>';
  }

  try {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "CAPTURE_SCREENSHOT" }, (response) => {
        if (btnCapture) {
          btnCapture.disabled = false;
          btnCapture.innerHTML = '<i class="ti ti-camera"></i>';
        }

        if (chrome.runtime.lastError) {
          showToast("Erro ao contatar background: " + chrome.runtime.lastError.message, "danger");
          reject(chrome.runtime.lastError);
          return;
        }

        if (response && response.success) {
          if (previewArea && imgPreview) {
            imgPreview.src = response.dataUrl;
            previewArea.classList.remove("hidden");
            showToast("📸 Captura de tela realizada com sucesso!", "success");
          }
          resolve(response.dataUrl);
        } else {
          showToast("Falha na captura: " + (response ? response.error : "Erro desconhecido"), "danger");
          reject(new Error(response ? response.error : "Erro desconhecido"));
        }
      });
    });
  } catch (err) {
    if (btnCapture) {
      btnCapture.disabled = false;
      btnCapture.innerHTML = '<i class="ti ti-camera"></i>';
    }
    showToast("Erro ao capturar tela: " + err.message, "danger");
  }
}

async function analyzeScreenshot() {
  const imgPreview = document.getElementById("screenshot-preview");
  if (!imgPreview || !imgPreview.src || imgPreview.src.startsWith("data:") === false) {
    showToast("Nenhuma captura de tela disponível para analisar.", "warning");
    return;
  }

  const btnAnalyze = document.getElementById("btn-analyze-visual");
  if (btnAnalyze) {
    btnAnalyze.disabled = true;
    btnAnalyze.innerHTML = '<i class="ti ti-loader-2 voice-spin"></i> Analisando...';
  }

  try {
    const base64Data = imgPreview.src;
    
    // Prompt to guide the visual analysis
    const prompt = "Analise esta imagem da tela do Instagram. Identifique elementos visuais, layout, cores, branding, tipo de conteúdo, ou qualquer detalhe relevante do perfil/post para nos ajudar a bolar a melhor estratégia de vendas ou engajamento. Retorne uma análise sucinta e profissional.";
    
    // Choose model with vision support: Olavo (gpt-4o-mini), Clara (claude) or Gael (gemini)
    // We prioritize olavo (gpt-4o-mini) or gemini if they are configured
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
            { type: "image_url", image_url: { url: base64Data } }
          ]
        }
      ],
      temperature: 0.7
    };

    const response = await callChatAPI(payload);
    
    if (btnAnalyze) {
      btnAnalyze.disabled = false;
      btnAnalyze.innerHTML = '<i class="ti ti-eye"></i> Analisar Visualmente';
    }

    // Render results in the response feed
    const resultsDiv = document.getElementById("copilot-results");
    if (resultsDiv) {
      const formattedResponse = response.replace(/\n/g, "<br>");
      resultsDiv.innerHTML = `
        <div class="response-card" style="border-left: 4px solid var(--color-accent-amethyst);">
          <div class="response-header">
            <div class="response-agent-info">
              <div class="mini-avatar purple-bg"><i class="ti ti-eye"></i></div>
              <span class="response-agent-name">Análise Visual</span>
            </div>
            <div class="response-actions-top">
              <button class="mini-btn-icon" title="Fechar" onclick="this.closest('.response-card').remove()"><i class="ti ti-x"></i></button>
            </div>
          </div>
          <div class="response-body" style="font-size: 13px; line-height: 1.5; color: var(--color-text-primary);">
            ${formattedResponse}
          </div>
        </div>
      ` + resultsDiv.innerHTML;
    }

    showToast("Análise visual concluída!", "success");

  } catch (err) {
    if (btnAnalyze) {
      btnAnalyze.disabled = false;
      btnAnalyze.innerHTML = '<i class="ti ti-eye"></i> Analisar Visualmente';
    }
    showToast("Erro na análise visual: " + err.message, "danger");
  }
}
