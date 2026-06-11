// Vexx AI Copilot — Command Palette (Ctrl+Shift+K Keyboard Spotlight Overlay)

class CommandPalette {
  static get COMMANDS() {
    return [
      { id: "refresh", label: "Analisar Página (Scrape)", icon: "ti-refresh", action: () => requestScrape() },
      { id: "autoscroll", label: "Rolar e Analisar Chat (Auto-Scroll)", icon: "ti-arrows-double-ne-sw", action: () => typeof triggerAutoScrollScrape === "function" ? triggerAutoScrollScrape() : null },
      { id: "generate", label: "Gerar Respostas com IA", icon: "ti-sparkles", action: () => typeof generateReplies === "function" ? generateReplies() : null },
      { id: "screenshot", label: "Capturar Tela (Screenshot)", icon: "ti-camera", action: () => typeof captureScreenshot === "function" ? captureScreenshot() : null },
      { id: "analyze_visual", label: "Analisar Imagem Capturada", icon: "ti-eye", action: () => typeof analyzeScreenshot === "function" ? analyzeScreenshot() : null },
      { id: "export_leads", label: "Exportar Leads para CSV", icon: "ti-download", action: () => typeof exportLeadsCSV === "function" ? exportLeadsCSV() : null },
      { id: "clear_leads", label: "Limpar Banco de Leads", icon: "ti-trash", action: () => typeof clearAllLeads === "function" ? clearAllLeads() : null },
      { id: "mode_debate", label: "Ativar Modo Debate (Arena)", icon: "ti-users", action: () => typeof setArenaMode === "function" ? setArenaMode(true) : null },
      { id: "mode_solo", label: "Ativar Modo Solo (Agente Único)", icon: "ti-user", action: () => typeof setArenaMode === "function" ? setArenaMode(false) : null },
      { id: "tab_copilot", label: "Ir para Aba Chat/Copilot", icon: "ti-message-circle", action: () => typeof switchTab === "function" ? switchTab("copilot") : null },
      { id: "tab_arena", label: "Ir para Aba Debate Geral", icon: "ti-messages", action: () => typeof switchTab === "function" ? switchTab("arena") : null },
      { id: "tab_settings", label: "Ir para Aba Ajustes e Leads", icon: "ti-settings", action: () => typeof switchTab === "function" ? switchTab("settings") : null },
      { id: "reset_usage", label: "Zerar Contadores de Uso", icon: "ti-calculator", action: () => typeof resetUsageTracker === "function" ? resetUsageTracker() : null },
      { id: "restore_prompt", label: "Restaurar Prompt de Sistema Padrão", icon: "ti-history", action: () => typeof restoreDefaultSystemPrompt === "function" ? restoreDefaultSystemPrompt() : null }
    ];
  }

  constructor() {
    this.overlay = null;
    this.input = null;
    this.listContainer = null;
    this.activeIndex = 0;
    this.filteredCommands = [];
  }

  init() {
    if (document.getElementById("vexx-command-palette")) return;

    // Create command palette elements dynamically
    this.overlay = document.createElement("div");
    this.overlay.id = "vexx-command-palette";
    this.overlay.className = "command-palette-overlay hidden";

    this.overlay.innerHTML = `
      <div class="command-palette-modal">
        <div class="command-palette-search">
          <i class="ti ti-search search-icon"></i>
          <input type="text" id="command-palette-input" placeholder="Digite um comando ou atalho..." autocomplete="off">
          <span class="command-palette-esc">ESC</span>
        </div>
        <div class="command-palette-results" id="command-palette-results-list">
          <!-- Commands rendered dynamically -->
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.input = document.getElementById("command-palette-input");
    this.listContainer = document.getElementById("command-palette-results-list");

    this.setupListeners();
    this.filterCommands("");
  }

  setupListeners() {
    // Backdrop click closes palette
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Input changes
    this.input.addEventListener("input", (e) => {
      this.filterCommands(e.target.value);
    });

    // Keyboard navigation
    this.overlay.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.navigate(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.navigate(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.triggerActiveCommand();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.hide();
      }
    });
  }

  show() {
    this.init();
    this.overlay.classList.remove("hidden");
    this.input.value = "";
    this.activeIndex = 0;
    this.filterCommands("");
    setTimeout(() => this.input.focus(), 50);
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.add("hidden");
      this.input.blur();
    }
  }

  filterCommands(query) {
    const cleanQuery = query.toLowerCase().trim();
    const all = CommandPalette.COMMANDS;

    if (!cleanQuery) {
      this.filteredCommands = all;
    } else {
      this.filteredCommands = all.filter(cmd => 
        cmd.label.toLowerCase().includes(cleanQuery) || 
        cmd.id.toLowerCase().includes(cleanQuery)
      );
    }

    this.activeIndex = 0;
    this.render();
  }

  navigate(direction) {
    if (this.filteredCommands.length === 0) return;
    
    this.activeIndex += direction;
    if (this.activeIndex < 0) {
      this.activeIndex = this.filteredCommands.length - 1;
    } else if (this.activeIndex >= this.filteredCommands.length) {
      this.activeIndex = 0;
    }

    this.render();
    this.scrollToActive();
  }

  scrollToActive() {
    const activeEl = this.listContainer.querySelector(".command-palette-item.active");
    if (activeEl) {
      const containerHeight = this.listContainer.clientHeight;
      const elemTop = activeEl.offsetTop;
      const elemHeight = activeEl.clientHeight;
      
      if (elemTop + elemHeight > this.listContainer.scrollTop + containerHeight) {
        this.listContainer.scrollTop = elemTop + elemHeight - containerHeight;
      } else if (elemTop < this.listContainer.scrollTop) {
        this.listContainer.scrollTop = elemTop;
      }
    }
  }

  triggerActiveCommand() {
    const activeCmd = this.filteredCommands[this.activeIndex];
    if (activeCmd && typeof activeCmd.action === "function") {
      this.hide();
      activeCmd.action();
    }
  }

  render() {
    if (!this.listContainer) return;

    if (this.filteredCommands.length === 0) {
      this.listContainer.innerHTML = `
        <div class="command-palette-empty">Nenhum comando correspondente encontrado.</div>
      `;
      return;
    }

    this.listContainer.innerHTML = this.filteredCommands.map((cmd, idx) => `
      <div class="command-palette-item ${idx === this.activeIndex ? 'active' : ''}" data-index="${idx}">
        <i class="ti ${cmd.icon} cmd-icon"></i>
        <span class="cmd-label">${cmd.label}</span>
      </div>
    `).join("");

    // Add click events to rendered items
    const items = this.listContainer.querySelectorAll(".command-palette-item");
    items.forEach(item => {
      item.addEventListener("click", () => {
        this.activeIndex = parseInt(item.dataset.index, 10);
        this.triggerActiveCommand();
      });
    });
  }
}

// Global instance in sidebar context
const commandPalette = new CommandPalette();
window.commandPalette = commandPalette;

// Listen to commands from content.js
window.addEventListener("message", (event) => {
  if (event.data && event.data.source === "vexx-content") {
    if (event.data.action === "OPEN_COMMAND_PALETTE") {
      commandPalette.show();
    }
  }
});
