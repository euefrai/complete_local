// Vexx AI Copilot — Permissions & Onboarding Manager

class PermissionsManager {
  static get REQUIRED_PERMISSIONS() {
    return ["microphone", "notifications"];
  }

  // Checks the status of all permissions and updates the banner UI
  static async checkAndPrompt() {
    const banner = document.getElementById("permissions-banner");
    if (!banner) return;

    // Skip if dismissed this session
    if (sessionStorage.getItem("vexx_permissions_dismissed") === "true") {
      banner.classList.add("hidden");
      return;
    }

    let micGranted = false;
    let notifGranted = false;

    // 1. Check Microphone Permission
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: "microphone" });
        micGranted = (status.state === "granted");
        
        // Listen to changes
        status.onchange = () => {
          this.checkAndPrompt();
        };
      } else {
        // Fallback check
        micGranted = false;
      }
    } catch (e) {
      console.warn("[Permissions] Erro ao consultar permissão de microfone:", e);
    }

    // 2. Check Notifications Permission
    try {
      if (typeof Notification !== "undefined") {
        notifGranted = (Notification.permission === "granted");
      }
    } catch (e) {
      console.warn("[Permissions] Erro ao consultar permissão de notificações:", e);
    }

    // Update individual UI items
    this.updateItemUI("perm-mic-item", micGranted);
    this.updateItemUI("perm-notif-item", notifGranted);

    // If both are granted, hide banner, else show it
    if (micGranted && notifGranted) {
      banner.classList.add("hidden");
    } else {
      banner.classList.remove("hidden");
    }
  }

  // Updates the visual state of a checklist item
  static updateItemUI(itemId, isGranted) {
    const item = document.getElementById(itemId);
    if (!item) return;

    const btn = item.querySelector(".perm-btn");
    const statusIcon = item.querySelector(".perm-icon");

    if (isGranted) {
      if (btn) {
        btn.textContent = "Ativo";
        btn.disabled = true;
        btn.style.background = "var(--color-background-success)";
        btn.style.color = "var(--color-text-success)";
        btn.style.borderColor = "var(--color-text-success)";
      }
      if (statusIcon) {
        statusIcon.className = "ti ti-circle-check perm-icon text-success";
        statusIcon.style.color = "var(--color-text-success)";
      }
    } else {
      if (btn) {
        btn.textContent = "Ativar";
        btn.disabled = false;
        btn.style.background = "";
        btn.style.color = "";
        btn.style.borderColor = "";
      }
      if (statusIcon) {
        const defaultIcon = itemId.includes("mic") ? "ti-microphone" : "ti-bell";
        statusIcon.className = `ti ${defaultIcon} perm-icon`;
        statusIcon.style.color = "";
      }
    }
  }

  // Requests Microphone access
  static async requestMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks immediately, we just want to trigger the prompt/approval
      stream.getTracks().forEach(track => track.stop());
      showToast("🎙️ Acesso ao microfone concedido!", "success");
      this.checkAndPrompt();
    } catch (error) {
      console.error("[Permissions] Erro ao obter permissão de microfone:", error);
      showToast("Não foi possível acessar o microfone. Permita nas configurações do Chrome.", "danger");
    }
  }

  // Requests Web Notifications access
  static async requestNotifications() {
    if (typeof Notification === "undefined") {
      showToast("Notificações não são suportadas neste navegador.", "warning");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        showToast("🔔 Notificações ativadas com sucesso!", "success");
        
        // Exibe uma notificação de boas-vindas como feedback
        this.triggerSystemNotification("Vexx Copilot v2", "As notificações estão configuradas e ativas!");
      } else {
        showToast("Notificações negadas pelo usuário.", "warning");
      }
      this.checkAndPrompt();
    } catch (error) {
      console.error("[Permissions] Erro ao obter permissão de notificações:", error);
    }
  }

  // Fires a native notification
  static triggerSystemNotification(title, message) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, {
        body: message,
        icon: chrome.runtime.getURL("vexx-copilot-extension/vexx_copilot_icon.png") // fallback if icon doesn't exist
      });
    }
  }

  // Dismisses the onboarding banner for this session
  static dismissBanner() {
    sessionStorage.setItem("vexx_permissions_dismissed", "true");
    const banner = document.getElementById("permissions-banner");
    if (banner) {
      banner.classList.add("hidden");
    }
    showToast("Você pode configurar as permissões mais tarde no painel.", "info");
  }
}

// Bind events on load
document.addEventListener("DOMContentLoaded", () => {
  PermissionsManager.checkAndPrompt();

  const btnMic = document.getElementById("btn-request-mic");
  if (btnMic) {
    btnMic.addEventListener("click", () => PermissionsManager.requestMicrophone());
  }

  const btnNotif = document.getElementById("btn-request-notif");
  if (btnNotif) {
    btnNotif.addEventListener("click", () => PermissionsManager.requestNotifications());
  }

  const btnDismiss = document.getElementById("btn-dismiss-permissions");
  if (btnDismiss) {
    btnDismiss.addEventListener("click", () => PermissionsManager.dismissBanner());
  }
});

window.PermissionsManager = PermissionsManager;
