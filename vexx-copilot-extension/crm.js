// CRM / Leads — Sistema de persistência de leads local
// Salva, lista, deleta e exporta leads para CSV

let savedLeads = [];

async function loadLeads() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      const data = await chrome.storage.local.get(["savedLeads"]);
      if (data.savedLeads && Array.isArray(data.savedLeads)) {
        savedLeads = data.savedLeads;
      }
    } catch (e) {
      console.warn("loadLeads failed:", e.message);
    }
  }
}

async function persistLeads() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({ savedLeads: savedLeads });
    } catch (e) {
      console.warn("persistLeads failed:", e.message);
    }
  }
}

function saveLead(aiResponseText) {
  if (!pageContext) {
    showToast("Nenhum contexto disponível para salvar.", "warning");
    return;
  }

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    platform: pageContext.platform || "desconhecido",
    contextType: pageContext.type || "desconhecido",
    contactName: pageContext.contactName || "Sem nome",
    contactUsername: pageContext.contactUsername || "",
    contactBio: pageContext.contactBio || "",
    messageCount: pageContext.messages ? pageContext.messages.length : 0,
    lastMessage: pageContext.messages && pageContext.messages.length > 0
      ? pageContext.messages[pageContext.messages.length - 1].text.substring(0, 200)
      : "",
    aiSummary: aiResponseText ? aiResponseText.substring(0, 300) : "",
    tags: [],
    notes: ""
  };

  // Verifica se já existe um lead com o mesmo contato recente (deduplica)
  const existingIdx = savedLeads.findIndex(
    l => l.contactName === lead.contactName && l.platform === lead.platform &&
         (Date.now() - new Date(l.timestamp).getTime()) < 3600000 // 1 hora
  );

  if (existingIdx !== -1) {
    // Atualiza o lead existente
    savedLeads[existingIdx] = { ...savedLeads[existingIdx], ...lead, id: savedLeads[existingIdx].id };
    showToast("Lead atualizado: " + lead.contactName, "success");
  } else {
    savedLeads.unshift(lead);
    showToast("Lead salvo: " + lead.contactName, "success");
  }

  persistLeads();
  renderLeadsPanel();
}

function deleteLead(leadId) {
  savedLeads = savedLeads.filter(l => l.id !== leadId);
  persistLeads();
  renderLeadsPanel();
  showToast("Lead removido.", "info");
}

function clearAllLeads() {
  if (confirm("Deseja remover TODOS os leads salvos? Esta ação não pode ser desfeita.")) {
    savedLeads = [];
    persistLeads();
    renderLeadsPanel();
    showToast("Todos os leads foram removidos.", "info");
  }
}

function renderLeadsPanel() {
  const container = document.getElementById("leads-list-container");
  const countEl = document.getElementById("leads-count");

  if (!container) return;

  if (countEl) countEl.textContent = savedLeads.length;

  if (savedLeads.length === 0) {
    container.innerHTML = `
      <div class="empty-state text-secondary italic" style="padding: 1rem;">
        Nenhum lead salvo ainda. Analise uma conversa e clique em "Salvar Lead".
      </div>
    `;
    return;
  }

  container.innerHTML = savedLeads.map(lead => {
    const date = new Date(lead.timestamp);
    const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const platformIcon = lead.platform === "instagram"
      ? '<i class="ti ti-brand-instagram" style="color: #e1306c;"></i>'
      : '<i class="ti ti-brand-whatsapp" style="color: #25d366;"></i>';
    const usernameStr = lead.contactUsername ? ` (@${lead.contactUsername})` : "";

    return `
      <div class="lead-item" data-lead-id="${lead.id}">
        <div class="lead-header">
          <div class="lead-contact-info">
            ${platformIcon}
            <span class="lead-name">${lead.contactName}${usernameStr}</span>
          </div>
          <div class="lead-meta">
            <span class="lead-date">${dateStr} ${timeStr}</span>
            <button class="lead-delete-btn" data-action="delete-lead" data-lead-id="${lead.id}" title="Remover lead">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>
        ${lead.contactBio ? `<div class="lead-bio">${lead.contactBio.substring(0, 100)}</div>` : ''}
        ${lead.lastMessage ? `<div class="lead-last-msg"><strong>Última msg:</strong> "${lead.lastMessage.substring(0, 120)}${lead.lastMessage.length > 120 ? '...' : ''}"</div>` : ''}
        ${lead.aiSummary ? `<div class="lead-ai-summary"><i class="ti ti-sparkles"></i> ${lead.aiSummary.substring(0, 150)}${lead.aiSummary.length > 150 ? '...' : ''}</div>` : ''}
        <div class="lead-footer">
          <span class="lead-tag">${lead.contextType}</span>
          <span class="lead-msg-count">${lead.messageCount} msgs</span>
        </div>
      </div>
    `;
  }).join("");
}

function exportLeadsCSV() {
  if (savedLeads.length === 0) {
    showToast("Nenhum lead para exportar.", "warning");
    return;
  }

  const headers = ["Data", "Plataforma", "Contato", "Username", "Bio", "Msgs", "Última Mensagem", "Resumo IA"];
  const rows = savedLeads.map(l => [
    new Date(l.timestamp).toLocaleString("pt-BR"),
    l.platform,
    l.contactName,
    l.contactUsername || "",
    (l.contactBio || "").replace(/"/g, '""'),
    l.messageCount,
    (l.lastMessage || "").replace(/"/g, '""'),
    (l.aiSummary || "").replace(/"/g, '""')
  ]);

  let csv = headers.join(",") + "\n";
  rows.forEach(row => {
    csv += row.map(val => `"${val}"`).join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vexx_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`${savedLeads.length} leads exportados com sucesso!`, "success");
}

function setupLeadsListeners() {
  const leadsContainer = document.getElementById("leads-list-container");
  if (leadsContainer) {
    leadsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='delete-lead']");
      if (btn) {
        const leadId = btn.dataset.leadId;
        if (leadId) deleteLead(leadId);
      }
    });
  }

  const exportBtn = document.getElementById("btn-export-leads");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportLeadsCSV);
  }

  const clearBtn = document.getElementById("btn-clear-leads");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearAllLeads);
  }
}
