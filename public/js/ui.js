// Vexx AI Debate Arena — UI Helper Functions

export function switchTab(tabId) {
  // Hide all panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  // Deactivate all segment buttons
  document.querySelectorAll('.segment-btn').forEach(item => {
    item.classList.remove('active');
  });

  // Activate selected
  const panel = document.getElementById(`tab-content-${tabId}`);
  if (panel) panel.classList.add('active');
  
  const navBtn = document.getElementById(`nav-${tabId}`);
  if (navBtn) navBtn.classList.add('active');

  if (tabId === 'brain') {
    if (typeof window.loadSchedulerAndNotes === 'function') {
      window.loadSchedulerAndNotes();
    }
  } else if (tabId === 'skills') {
    if (typeof window.loadSkillsList === 'function') {
      window.loadSkillsList();
    }
  } else if (tabId === 'dashboard') {
    import('./dashboard.js').then(mod => {
      if (typeof mod.refreshDashboard === 'function') mod.refreshDashboard();
    });
  } else if (tabId === 'plugins') {
    import('./plugins.js').then(mod => {
      if (typeof mod.loadPluginsList === 'function') mod.loadPluginsList();
    });
  }
}

export function switchHistoryTab(tabName) {
  document.querySelectorAll('.history-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.history-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const tabBtn = document.getElementById(`history-tab-${tabName}`);
  if (tabBtn) tabBtn.classList.add('active');
  const section = document.getElementById(`history-section-${tabName}`);
  if (section) section.classList.add('active');
}

export function togglePasswordVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (el) {
    el.type = el.type === 'password' ? 'text' : 'password';
  }
}

export function toggleTheme() {
  const body = document.body;
  const isDark = body.classList.toggle('theme-dark');
  
  const themeToggleIcons = document.querySelectorAll('.theme-toggle-icon i');
  themeToggleIcons.forEach(icon => {
    icon.className = isDark ? 'ti ti-sun' : 'ti ti-moon';
  });
  
  localStorage.setItem('vexx-theme', isDark ? 'dark' : 'light');
}

export function toggleDebateTurns(isDebateActive) {
  const turnsContainer = document.getElementById('debate-turns-container');
  if (turnsContainer) {
    turnsContainer.style.display = isDebateActive ? 'flex' : 'none';
  }
}

export function adjustTextareaHeight(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = (textarea.scrollHeight - 4) + 'px';
}

export function triggerFileInput() {
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.click();
}

export function handleFileSelect(e) {
  const files = e.target.files;
  for (const file of files) {
    const isImage = file.type.startsWith('image/');
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      window.attachedFiles.push({
        name: file.name,
        type: file.type,
        data: evt.target.result,
        isImage: isImage
      });
      renderAttachmentPreviews();
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }
  e.target.value = '';
}

export function renderAttachmentPreviews() {
  const container = document.getElementById('attachments-preview');
  if (!container) return;
  if (window.attachedFiles.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.innerHTML = '';
  container.style.display = 'flex';

  window.attachedFiles.forEach((file, index) => {
    const badge = document.createElement('div');
    badge.className = 'attachment-badge';
    
    const iconClass = file.isImage ? 'ti-star' : 'ti-file';
    badge.innerHTML = `
      <i class="ti ${iconClass}" aria-hidden="true"></i>
      <span>${file.name}</span>
      <button class="remove-attach" onclick="removeAttachment(${index})" aria-label="Remover anexo">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    `;
    container.appendChild(badge);
  });
}

export function removeAttachment(index) {
  window.attachedFiles.splice(index, 1);
  renderAttachmentPreviews();
}

export function setInputDisabled(disabled) {
  const textInput = document.getElementById('chat-message-input');
  const attachBtn = document.getElementById('attach-btn');
  const actionBtns = document.querySelectorAll('.chat-input-area .input-action-btn');
  
  if (textInput) {
    textInput.disabled = disabled;
    if (disabled) {
      textInput.placeholder = 'Aguarde a resposta das IAs...';
    } else {
      textInput.placeholder = 'Escreva uma mensagem...';
    }
  }
  
  if (attachBtn) {
    attachBtn.disabled = disabled;
  }
  
  actionBtns.forEach(btn => {
    if (!btn.getAttribute('onclick') || !btn.getAttribute('onclick').includes('speakLastMessage')) {
      btn.disabled = disabled;
    }
  });

  const inputArea = document.querySelector('.chat-input-area');
  if (inputArea) {
    if (disabled) {
      inputArea.classList.add('input-disabled');
    } else {
      inputArea.classList.remove('input-disabled');
    }
  }
}

let recognition = null;
let isRecording = false;

export function toggleSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('vexx_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  
  const icon = sidebar.querySelector('.toggle-sidebar-btn i');
  if (icon) {
    icon.className = isCollapsed ? 'ti ti-chevron-right' : 'ti ti-chevron-left';
  }
}

export function toggleSpeechRecognition() {
  const micBtn = document.querySelector('.input-right-controls button[title="Usar microfone"]');
  const inputEl = document.getElementById('chat-message-input');
  
  if (!micBtn || !inputEl) return;
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('A API de reconhecimento de fala não é suportada neste navegador.');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      isRecording = true;
      micBtn.classList.add('recording-pulse');
      inputEl.placeholder = 'Ouvindo... fale agora';
    };
    
    recognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove('recording-pulse');
      inputEl.placeholder = 'Escreva uma mensagem...';
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      isRecording = false;
      micBtn.classList.remove('recording-pulse');
      inputEl.placeholder = 'Escreva uma mensagem...';
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (inputEl.value) {
        inputEl.value += ' ' + transcript;
      } else {
        inputEl.value = transcript;
      }
      adjustTextareaHeight(inputEl);
    };
  }
  
  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
  }
}

export function speakLastMessage() {
  const assistantMessages = window.chatMessages.filter(m => m.role === 'assistant');
  
  if (assistantMessages.length === 0) {
    const inputEl = document.getElementById('chat-message-input');
    if (inputEl && inputEl.value.trim()) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(inputEl.value.trim());
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
    return;
  }
  
  const lastMsg = assistantMessages[assistantMessages.length - 1];
  speakMessage(lastMsg.id);
}

export function speakMessage(messageId) {
  const bubble = document.getElementById(messageId);
  if (!bubble) return;
  
  window.speechSynthesis.cancel();
  
  const text = bubble.innerText || bubble.textContent;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  window.speechSynthesis.speak(utterance);
}

export function rateMessage(buttonEl, rating) {
  const parent = buttonEl.parentElement;
  if (!parent) return;
  
  const buttons = parent.querySelectorAll('.msg-action-btn');
  buttons.forEach(btn => {
    const icon = btn.querySelector('i');
    if (icon && (icon.className.includes('thumb-up') || icon.className.includes('thumb-down'))) {
      btn.style.color = '';
    }
  });
  
  buttonEl.style.color = rating === 'up' ? 'var(--color-text-success)' : 'var(--color-text-danger)';
  
  const statusEl = document.getElementById('save-status');
  if (statusEl) {
    statusEl.innerHTML = `<i class="ti ti-circle-check" aria-hidden="true"></i> ${rating === 'up' ? 'Gostei!' : 'Não gostei.'}`;
    statusEl.style.display = 'inline-flex';
    clearTimeout(window.saveStatusTimeout);
    window.saveStatusTimeout = setTimeout(() => {
      statusEl.style.display = 'none';
      statusEl.innerHTML = '<i class="ti ti-circle-check" aria-hidden="true"></i> Salvo Localmente';
    }, 1500);
  }
}

export function regenerateDebate(messageId) {
  const userMsgs = window.chatMessages.filter(m => m.role === 'user');
  if (userMsgs.length === 0) return;
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  
  const idx = window.chatMessages.findIndex(m => m.id === lastUserMsg.id);
  if (idx !== -1) {
    window.chatMessages = window.chatMessages.slice(0, idx + 1);
    if (typeof window.saveChatMessages === 'function') {
      window.saveChatMessages();
    }
    
    const feed = document.getElementById('chat-feed');
    if (feed) {
      feed.innerHTML = '';
      window.chatMessages.forEach(msg => {
        if (typeof window.renderMessage === 'function') {
          window.renderMessage(msg);
        }
      });
      feed.scrollTop = feed.scrollHeight;
    }
    
    const lastAttachedFiles = lastUserMsg.imageAttachments || [];
    window.attachedFiles = lastAttachedFiles.map(att => ({
      name: att.name,
      isImage: att.isImage,
      data: att.data,
      type: att.isImage ? 'image/png' : 'text/plain'
    }));
    
    const textInput = document.getElementById('chat-message-input');
    if (textInput) {
      textInput.value = lastUserMsg.text;
    }
    if (typeof window.startDebate === 'function') {
      window.startDebate();
    }
  }
}

export function updateActiveModelDisplay() {
  const primaryEl = document.getElementById('param-primary');
  if (!primaryEl) return;
  const leader = primaryEl.value;
  const modelInput = document.getElementById(`model-${leader}`);
  const displayEl = document.getElementById('active-model-name-display');
  if (displayEl && modelInput) {
    displayEl.textContent = modelInput.value;
  }
}

// Expose functions globally for inline HTML event handlers
window.switchTab = switchTab;
window.switchHistoryTab = switchHistoryTab;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleTheme = toggleTheme;
window.toggleDebateTurns = toggleDebateTurns;
window.adjustTextareaHeight = adjustTextareaHeight;
window.triggerFileInput = triggerFileInput;
window.handleFileSelect = handleFileSelect;
window.renderAttachmentPreviews = renderAttachmentPreviews;
window.removeAttachment = removeAttachment;
window.setInputDisabled = setInputDisabled;
window.toggleSidebar = toggleSidebar;
window.toggleSpeechRecognition = toggleSpeechRecognition;
window.speakLastMessage = speakLastMessage;
window.speakMessage = speakMessage;
window.rateMessage = rateMessage;
window.regenerateDebate = regenerateDebate;
window.updateActiveModelDisplay = updateActiveModelDisplay;

export function toggleThoughtsDrawer() {
  const drawer = document.getElementById('thought-timeline-drawer');
  if (drawer) {
    drawer.classList.toggle('collapsed');
  }
}

export function addThoughtToTimeline(name, providerKey, text, isSilent = false) {
  const listEl = document.getElementById('thought-timeline-list');
  if (!listEl) return;

  const emptyState = listEl.querySelector('.drawer-empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const provider = window.PROVIDERS[providerKey] || {
    name: name,
    initials: name ? name.substring(0, 2).toUpperCase() : 'IA',
    bgClass: 'neutral-bg'
  };

  const item = document.createElement('div');
  item.className = `thought-timeline-item ${isSilent ? 'silent' : ''}`;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const escapedText = (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  item.innerHTML = `
    <div class="thought-timeline-header">
      <div class="thought-timeline-sender">
        <div class="avatar-circle ${provider.bgClass}">${provider.initials}</div>
        <span>${provider.name}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        ${isSilent ? '<span class="thought-timeline-badge warning-bg" style="color:white; padding: 1px 3px; border-radius: 3px; font-size: 8px;">Silencioso</span>' : ''}
        <span class="thought-timeline-time">${timeStr}</span>
      </div>
    </div>
    <div class="thought-timeline-content">${escapedText}</div>
  `;

  listEl.appendChild(item);
  listEl.scrollTop = listEl.scrollHeight;
}

export function switchMemoryTab(type) {
  window.activeMemoryTab = type;
  document.querySelectorAll('.memory-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.color = 'var(--text-tertiary)';
  });
  const activeBtn = document.getElementById(`mem-tab-${type}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.color = 'var(--text-secondary)';
  }
  if (typeof window.renderMemories === 'function') {
    window.renderMemories();
  }
}

export function clearCurrentMemories() {
  const currentTab = window.activeMemoryTab || 'long';
  if (currentTab === 'long') {
    if (typeof window.clearAllMemories === 'function') window.clearAllMemories();
  } else if (currentTab === 'vector') {
    if (typeof window.clearAllVectorMemories === 'function') window.clearAllVectorMemories();
  } else if (currentTab === 'short') {
    alert('A memória de curto prazo é baseada no histórico recente do chat e não pode ser limpa diretamente.');
  }
}

window.toggleThoughtsDrawer = toggleThoughtsDrawer;
window.addThoughtToTimeline = addThoughtToTimeline;
window.switchMemoryTab = switchMemoryTab;
window.clearCurrentMemories = clearCurrentMemories;

