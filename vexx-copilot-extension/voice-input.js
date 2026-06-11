// Voice Input — Gravação de áudio e transcrição via Whisper
// Toggle: clique 1 = grava, clique 2 = para e transcreve

class VoiceRecorder {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.startTime = null;
    this.timerInterval = null;
  }

  async startRecording() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType()
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(250); // Coleta chunks a cada 250ms
      this.isRecording = true;
      this.startTime = Date.now();

      this.updateUI("recording");
      this.startTimer();

      console.log("[Vexx Voice] Gravação iniciada.");
    } catch (error) {
      console.error("[Vexx Voice] Erro ao acessar microfone:", error);
      if (error.name === "NotAllowedError") {
        showToast("Permissão de microfone negada. Permita o acesso nas configurações do navegador.", "danger");
      } else {
        showToast("Erro ao acessar microfone: " + error.message, "danger");
      }
    }
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopTimer();
      this.updateUI("processing");

      console.log("[Vexx Voice] Gravação parada, processando...");
    });
  }

  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.audioChunks = [];
    this.mediaRecorder = null;
  }

  async transcribe(audioBlob) {
    if (!audioBlob || audioBlob.size === 0) {
      showToast("Nenhum áudio capturado.", "warning");
      this.updateUI("idle");
      return null;
    }

    // Converte blob para base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binary);

    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
        showToast("Extensão desconectada. Recarregue a página.", "danger");
        this.updateUI("idle");
        resolve(null);
        return;
      }

      try {
        chrome.runtime.sendMessage({
          action: "TRANSCRIBE_AUDIO",
          payload: {
            audio: base64Audio,
            mimeType: audioBlob.type || "audio/webm"
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            showToast("Erro de comunicação: " + chrome.runtime.lastError.message, "danger");
            this.updateUI("idle");
            resolve(null);
            return;
          }

          if (response && response.success && response.text) {
            resolve(response.text);
          } else {
            const errorMsg = response ? response.error : "Erro desconhecido na transcrição";
            showToast("Falha na transcrição: " + errorMsg, "danger");
            resolve(null);
          }
          this.updateUI("idle");
        });
      } catch (err) {
        showToast("Erro ao enviar áudio: " + err.message, "danger");
        this.updateUI("idle");
        resolve(null);
      }
    });
  }

  async toggle() {
    if (this.isRecording) {
      const audioBlob = await this.stopRecording();
      if (audioBlob) {
        const transcribedText = await this.transcribe(audioBlob);
        if (transcribedText) {
          this.onTranscription(transcribedText);
        }
      }
    } else {
      await this.startRecording();
    }
  }

  onTranscription(text) {
    // Insere o texto transcrito no campo custom
    const customInput = document.getElementById("custom-prompt-input");
    const toneSelect = document.getElementById("tone-select");

    if (customInput) {
      customInput.value = text;
      customInput.classList.remove("hidden");
    }
    if (toneSelect) {
      toneSelect.value = "custom";
      toneSelect.dispatchEvent(new Event("change"));
    }

    showToast("🎙️ Áudio transcrito com sucesso!", "success");

    // Highlight o campo custom com uma animação sutil
    if (customInput) {
      customInput.style.borderColor = "var(--color-text-success)";
      customInput.style.boxShadow = "0 0 8px rgba(151, 196, 89, 0.3)";
      setTimeout(() => {
        customInput.style.borderColor = "";
        customInput.style.boxShadow = "";
      }, 2000);
    }
  }

  getSupportedMimeType() {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4"
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "audio/webm"; // Fallback
  }

  updateUI(state) {
    const btn = document.getElementById("btn-voice-input");
    const statusEl = document.getElementById("voice-status");
    const timerEl = document.getElementById("voice-timer");

    if (!btn) return;

    btn.classList.remove("voice-recording", "voice-processing");

    switch (state) {
      case "recording":
        btn.classList.add("voice-recording");
        btn.innerHTML = '<i class="ti ti-player-stop-filled"></i>';
        btn.title = "Parar gravação";
        if (statusEl) {
          statusEl.classList.remove("hidden");
          statusEl.textContent = "Gravando...";
        }
        break;

      case "processing":
        btn.classList.add("voice-processing");
        btn.innerHTML = '<i class="ti ti-loader-2 voice-spin"></i>';
        btn.title = "Transcrevendo áudio...";
        if (statusEl) {
          statusEl.textContent = "Transcrevendo...";
        }
        break;

      case "idle":
      default:
        btn.innerHTML = '<i class="ti ti-microphone"></i>';
        btn.title = "Gravar áudio para transcrição";
        if (statusEl) {
          statusEl.classList.add("hidden");
          statusEl.textContent = "";
        }
        if (timerEl) {
          timerEl.classList.add("hidden");
          timerEl.textContent = "0:00";
        }
        break;
    }
  }

  startTimer() {
    const timerEl = document.getElementById("voice-timer");
    if (!timerEl) return;

    timerEl.classList.remove("hidden");
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

// Instância global do gravador
const voiceRecorder = new VoiceRecorder();
