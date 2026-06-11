// Vexx AI Debate Arena — Autonomous Task Scheduler
let countdownInterval = null;

export function renderTaskList(tasks) {
  const container = document.getElementById('scheduled-tasks-list');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = `<div class="empty-list-state" style="font-size: 11px; color: var(--text-tertiary); text-align: center; padding: 16px;">Nenhum agendamento ativo.</div>`;
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    return;
  }

  container.innerHTML = '';
  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = `task-item-card ${task.status}`;
    card.id = `task-card-${task.id}`;
    
    const timeStr = new Date(task.time).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const badgeClass = task.type === 'execute' ? 'badge-warning' : 'badge-info';
    const typeLabel = task.type === 'execute' ? 'Comando' : 'Alerta';
    
    card.innerHTML = `
      <div class="task-item-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <span class="task-item-time" style="font-size: 11px; font-weight: 600; color: var(--text-primary);"><i class="ti ti-clock" style="margin-right: 4px;"></i>${timeStr}</span>
        <div style="display: flex; gap: 4px; align-items: center;">
          <span class="task-item-badge ${badgeClass}" style="font-size: 9px; padding: 2px 6px; border-radius: 10px; font-weight: 500;">${typeLabel}</span>
          <button class="task-delete-btn" onclick="deleteTask('${task.id}')" style="background: transparent; border: none; color: var(--text-tertiary); cursor: pointer; padding: 2px; display: inline-flex;" title="Excluir agendamento"><i class="ti ti-trash" style="font-size: 13px;"></i></button>
        </div>
      </div>
      <div class="task-item-payload" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; font-family: var(--font-mono); white-space: pre-wrap; word-break: break-all; background: var(--bg-surface-alt); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border-light); max-height: 80px; overflow-y: auto;">${task.payload}</div>
      <div class="task-status-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-tertiary);">
        <span>Status: <strong class="status-label-${task.status}">${task.status}</strong></span>
        <span class="task-item-countdown" data-time="${task.time}" data-status="${task.status}">-</span>
      </div>
    `;
    container.appendChild(card);
  });

  if (countdownInterval) clearInterval(countdownInterval);
  updateAllCountdowns();
  countdownInterval = setInterval(updateAllCountdowns, 1000);
}

export function updateAllCountdowns() {
  const elements = document.querySelectorAll('.task-item-countdown');
  elements.forEach(el => {
    const targetStr = el.dataset.time;
    const status = el.dataset.status;
    if (status !== 'pending') {
      el.textContent = status === 'completed' ? 'Concluído' : 'Falhou';
      return;
    }

    const diff = new Date(targetStr) - new Date();
    if (diff <= 0) {
      el.textContent = 'Executando...';
      return;
    }

    const secs = Math.floor(diff / 1000) % 60;
    const mins = Math.floor(diff / 60000) % 60;
    const hours = Math.floor(diff / 3600000) % 24;
    const days = Math.floor(diff / 86400000);

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (mins > 0 || hours > 0 || days > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);

    el.innerHTML = `<i class="ti ti-hourglass" style="margin-right: 3px; font-size: 9px;"></i> Restam ${parts.join(' ')}`;
  });
}

export async function handleQuickSchedule(event) {
  event.preventDefault();
  const timeInput = document.getElementById('sched-time');
  const typeInput = document.getElementById('sched-type');
  const payloadInput = document.getElementById('sched-payload');
  if (!timeInput || !typeInput || !payloadInput) return;

  const time = timeInput.value;
  const type = typeInput.value;
  const payload = payloadInput.value.trim();

  try {
    const res = await fetch('/api/scheduler/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time, type, payload })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Falha ao agendar tarefa');
    }
    showVexxToast('Tarefa agendada com sucesso!', 'success');
    timeInput.value = '';
    payloadInput.value = '';
    loadSchedulerAndNotes();
  } catch (err) {
    alert(`Erro ao agendar: ${err.message}`);
  }
}

export async function deleteTask(id) {
  if (!confirm('Deseja realmente remover esta tarefa agendada?')) return;
  try {
    const res = await fetch('/api/scheduler/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error('Falha ao remover tarefa');
    showVexxToast('Agendamento removido.', 'info');
    loadSchedulerAndNotes();
  } catch (err) {
    alert(`Erro ao remover: ${err.message}`);
  }
}

export function playAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // A5
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  } catch (e) {
    console.error('Audio synthesizer error:', e);
  }
}

export function showVexxToast(message, type = 'info') {
  let container = document.querySelector('.vexx-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'vexx-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'vexx-toast';
  
  let iconClass = 'ti ti-info-circle';
  if (type === 'success') {
    iconClass = 'ti ti-circle-check';
    toast.style.borderLeftColor = 'var(--text-success)';
  } else if (type === 'execute') {
    iconClass = 'ti ti-terminal';
    toast.style.borderLeftColor = 'var(--accent)';
  } else if (type === 'warning') {
    iconClass = 'ti ti-alert-triangle';
    toast.style.borderLeftColor = 'var(--color-text-warning)';
  } else if (type === 'danger') {
    iconClass = 'ti ti-circle-x';
    toast.style.borderLeftColor = 'var(--color-text-danger)';
  }

  toast.innerHTML = `
    <i class="${iconClass} vexx-toast-icon"></i>
    <div class="vexx-toast-body">
      <div class="vexx-toast-title">${type === 'success' ? 'Sucesso' : type === 'execute' ? 'Execução de Comando' : 'Notificação'}</div>
      <div class="vexx-toast-text">${message}</div>
    </div>
    <button class="vexx-toast-close" onclick="this.parentElement.remove()"><i class="ti ti-x"></i></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 6000);
}

export async function loadSchedulerAndNotes() {
  const tasksContainer = document.getElementById('scheduled-tasks-list');
  const notesContainer = document.getElementById('notes-files-list');

  if (tasksContainer) {
    tasksContainer.innerHTML = `
      <div class="skeleton-loading" style="height: 48px; width: 100%; margin-bottom: 8px;"></div>
      <div class="skeleton-loading" style="height: 48px; width: 100%; margin-bottom: 8px;"></div>
      <div class="skeleton-loading" style="height: 48px; width: 100%;"></div>
    `;
  }
  if (notesContainer) {
    notesContainer.innerHTML = `
      <div class="skeleton-loading" style="height: 32px; width: 100%; margin-bottom: 6px;"></div>
      <div class="skeleton-loading" style="height: 32px; width: 100%; margin-bottom: 6px;"></div>
      <div class="skeleton-loading" style="height: 32px; width: 100%;"></div>
    `;
  }

  try {
    const res = await fetch('/api/scheduler/list');
    if (res.ok) {
      const data = await res.json();
      renderTaskList(data.tasks || []);
    }
  } catch (err) {
    console.error('Error listing tasks', err);
  }

  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath: window.config?.obsidian_path || '' })
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof window.renderNotesList === 'function') {
        window.renderNotesList(data.notes || [], data.path || '');
      } else {
        console.warn('window.renderNotesList is not defined yet');
      }
    }
  } catch (err) {
    console.error('Error listing notes', err);
  }
}

// Background alert poller
setInterval(async () => {
  try {
    const res = await fetch('/api/scheduler/alerts');
    if (res.ok) {
      const data = await res.json();
      if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach(alert => {
          showVexxToast(alert.payload, alert.type);
          playAlertSound();
        });
        const activeTab = document.querySelector('.segment-btn.active');
        if (activeTab && activeTab.id === 'nav-brain') {
          loadSchedulerAndNotes();
        }
      }
    }
  } catch (e) {
    console.error('Failed to poll alerts', e);
  }
}, 3000);

// Expose globally
window.renderTaskList = renderTaskList;
window.updateAllCountdowns = updateAllCountdowns;
window.handleQuickSchedule = handleQuickSchedule;
window.deleteTask = deleteTask;
window.playAlertSound = playAlertSound;
window.showVexxToast = showVexxToast;
window.loadSchedulerAndNotes = loadSchedulerAndNotes;
