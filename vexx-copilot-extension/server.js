// Local server health check and message routing

function checkServerHealth() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
    if (healthCheckIntervalId) {
      clearInterval(healthCheckIntervalId);
      healthCheckIntervalId = null;
    }
    return;
  }

  try {
    chrome.runtime.sendMessage({ action: "HEALTH_CHECK" }, (response) => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message || String(chrome.runtime.lastError || "Erro desconhecido");
        console.warn("Health check error:", errMsg);
        
        // Auto-clear context invalidation spam
        if (errMsg && (errMsg.includes("context invalidated") || errMsg.includes("Context invalidated"))) {
          if (healthCheckIntervalId) {
            clearInterval(healthCheckIntervalId);
            healthCheckIntervalId = null;
            console.log("Cleared health check interval due to context invalidation");
          }
        }
        setOfflineState();
        return;
      }
      
      const statusDiv = document.getElementById("server-status");
      if (!statusDiv) return;

      if (response && response.success) {
        if (!serverOnline) {
          serverOnline = true;
        }
        statusDiv.className = "server-status online";
        const textEl = statusDiv.querySelector(".status-text");
        if (textEl) textEl.textContent = "wifa jl OS";
        
        // Load active providers configurations
        try {
          chrome.runtime.sendMessage({ action: "GET_PROVIDERS" }, (provResponse) => {
            if (chrome.runtime.lastError) {
              const errMsg = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
              if (errMsg && (errMsg.includes("context invalidated") || errMsg.includes("Context invalidated"))) {
                if (healthCheckIntervalId) {
                  clearInterval(healthCheckIntervalId);
                  healthCheckIntervalId = null;
                  console.log("Cleared health check interval due to context invalidation in GET_PROVIDERS callback");
                }
              }
              setOfflineState();
              return;
            }
            if (provResponse && provResponse.success) {
              configuredProviders = provResponse.data.providers || {};
            } else {
              configuredProviders = {};
            }
            renderAgentsGrid();
          });
        } catch (err) {
          const errMsg = err && err.message ? err.message : String(err || "Erro desconhecido");
          console.warn("GET_PROVIDERS failed:", errMsg);
          if (errMsg && (errMsg.includes("context invalidated") || errMsg.includes("Context invalidated"))) {
            if (healthCheckIntervalId) {
              clearInterval(healthCheckIntervalId);
              healthCheckIntervalId = null;
              console.log("Cleared health check interval due to context invalidation during GET_PROVIDERS");
            }
          }
          setOfflineState();
        }
      } else {
        setOfflineState();
      }
    });
  } catch (error) {
    const errorMsg = error && error.message ? error.message : String(error || "Erro desconhecido");
    console.warn("checkServerHealth failed (context might be invalidated):", errorMsg);
    if (errorMsg && (errorMsg.includes("context invalidated") || errorMsg.includes("Context invalidated"))) {
      if (healthCheckIntervalId) {
        clearInterval(healthCheckIntervalId);
        healthCheckIntervalId = null;
      }
    }
    setOfflineState();
  }
}

function setOfflineState() {
  if (serverOnline) {
    serverOnline = false;
    configuredProviders = {};
    renderAgentsGrid();
  }
  const statusDiv = document.getElementById("server-status");
  if (statusDiv) {
    statusDiv.className = "server-status offline";
    const textEl = statusDiv.querySelector(".status-text");
    if (textEl) textEl.textContent = "Offline (Porta 3000)";
  }
}

function callChatAPI(payload) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      reject(new Error("Contexto da extensão não disponível. Recarregue a página."));
      return;
    }
    try {
      chrome.runtime.sendMessage({
        action: "CHAT_REQUEST",
        payload: payload
      }, (response) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
          reject(new Error("Erro de comunicação com extensão: " + errMsg));
          return;
        }
        if (response && response.success) {
          const choices = response.data.choices;
          if (choices && choices[0] && choices[0].message) {
            resolve(choices[0].message.content);
          } else {
            reject(new Error("Resposta do LLM no formato inválido"));
          }
        } else {
          reject(new Error(response ? response.error : "Falha na comunicação com o Service Worker"));
        }
      });
    } catch (e) {
      const errorMsg = e && e.message ? e.message : String(e || "Erro desconhecido");
      reject(new Error("Falha no envio da mensagem da extensão: " + errorMsg));
    }
  });
}

function requestScrape() {
  window.parent.postMessage({
    source: "vexx-sidebar",
    action: "SCRAPE_CONTEXT"
  }, "*");
}
