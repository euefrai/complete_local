// Vexx AI Copilot — Background Service Worker

// Escuta mensagens vindas do content script ou da sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CAPTURE_SCREENSHOT") {
    chrome.tabs.captureVisibleTab(null, { format: 'png' })
      .then(dataUrl => {
        sendResponse({ success: true, dataUrl: dataUrl });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "HEALTH_CHECK") {
    fetch("http://127.0.0.1:3000/api/health")
      .then(response => {
        if (!response.ok) throw new Error("Server response not OK");
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "GET_PROVIDERS") {
    fetch("http://127.0.0.1:3000/api/chat/providers")
      .then(response => {
        if (!response.ok) throw new Error("Server response not OK");
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "CHAT_REQUEST") {
    const { provider, model, messages, temperature, max_tokens } = request.payload;

    fetch("http://127.0.0.1:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        provider: provider,
        model: model,
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2048
      })
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errData => {
            throw new Error(errData.error || errData.details || "Erro desconhecido no servidor local");
          });
        }
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "GENERATE_IMAGE") {
    const { prompt } = request.payload;
    fetch(`http://127.0.0.1:3000/api/generate-image?prompt=${encodeURIComponent(prompt)}`)
      .then(response => {
        if (!response.ok) throw new Error("Erro ao gerar imagem no servidor local.");
        return response.arrayBuffer();
      })
      .then(buffer => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        sendResponse({ success: true, dataUrl: `data:image/webp;base64,${base64}` });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }

  if (request.action === "TRANSCRIBE_AUDIO") {
    const { audio, mimeType } = request.payload;
    fetch("http://127.0.0.1:3000/api/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        audio: audio,
        mimeType: mimeType || "audio/webm"
      })
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errData => {
            throw new Error(errData.error || "Erro na transcrição");
          });
        }
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, text: data.text || data.transcription || "" });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }
});
