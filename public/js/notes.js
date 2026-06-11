// Vexx AI Debate Arena — Notes and Obsidian Integration
let activeNoteFilename = null;

export function renderNotesList(notes, activePath) {
  const container = document.getElementById('notes-files-list');
  const indicator = document.getElementById('active-vault-indicator');
  if (indicator) {
    let displayPath = activePath ? activePath.replace(/\\/g, '/') : 'notes/';
    if (displayPath.length > 30) {
      const parts = displayPath.split('/');
      if (parts.length > 2) {
        displayPath = '.../' + parts.slice(-2).join('/');
      }
    }
    indicator.textContent = displayPath;
    indicator.title = activePath || 'notes/';
  }
  if (!container) return;

  if (notes.length === 0) {
    container.innerHTML = `<div class="empty-list-state" style="font-size: 10px; color: var(--text-tertiary); text-align: center; padding: 16px;">Nenhuma nota.</div>`;
    return;
  }

  container.innerHTML = '';
  notes.forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-sidebar-item';
    if (note.name === activeNoteFilename) {
      item.classList.add('active');
    }
    
    const sizeKB = (note.size / 1024).toFixed(1);
    
    item.innerHTML = `
      <div class="note-item-meta" style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;">
        <span class="note-title" style="font-size: 11px; font-weight: 500; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${note.name}</span>
        <span class="note-size" style="font-size: 9px; color: var(--text-tertiary);">${sizeKB} KB</span>
      </div>
      <button class="note-delete-btn" onclick="event.stopPropagation(); deleteNote('${note.name}')" style="background: transparent; border: none; color: var(--text-tertiary); cursor: pointer; padding: 2px; display: none;" title="Excluir nota"><i class="ti ti-trash" style="font-size: 11px;"></i></button>
    `;
    
    item.addEventListener('click', () => selectNote(note.name));
    
    item.addEventListener('mouseenter', () => {
      const delBtn = item.querySelector('.note-delete-btn');
      if (delBtn) delBtn.style.display = 'inline-flex';
    });
    item.addEventListener('mouseleave', () => {
      const delBtn = item.querySelector('.note-delete-btn');
      if (delBtn) delBtn.style.display = 'none';
    });
    
    container.appendChild(item);
  });
}

export async function selectNote(filename) {
  activeNoteFilename = filename;
  const viewport = document.getElementById('note-editor-viewport');
  if (!viewport) return;

  viewport.innerHTML = `
    <div class="dots-loader" style="margin: auto;">
      <span></span><span></span><span></span>
    </div>
  `;

  document.querySelectorAll('.note-sidebar-item').forEach(item => {
    const title = item.querySelector('.note-title')?.textContent;
    if (title === filename) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  try {
    const res = await fetch('/api/notes/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, vaultPath: window.config?.obsidian_path || '' })
    });
    if (!res.ok) throw new Error('Falha ao ler nota');
    const data = await res.json();
    
    viewport.innerHTML = `
      <div class="note-editor-container" style="display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden;">
        <div class="note-editor-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 8px; margin-bottom: 8px;">
          <h3 style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0; font-family: var(--font-mono); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 70%;">${filename}</h3>
          <button class="action-btn success-btn" onclick="saveActiveNote()" style="height: 28px; font-size: 10px; padding: 4px 10px; background: var(--text-success); color: white; border-color: var(--text-success);">
            <i class="ti ti-device-floppy"></i> Salvar
          </button>
        </div>
        <textarea id="active-note-textarea" class="note-editor-textarea" style="flex-grow: 1; resize: none; background: var(--bg-surface-alt); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px; font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); line-height: 1.5; outline: none; margin-bottom: 8px;" placeholder="Escreva conteúdo em Markdown aqui...">${data.content || ''}</textarea>
      </div>
    `;
  } catch (err) {
    viewport.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-danger); gap: 6px;">
        <i class="ti ti-alert-triangle" style="font-size: 24px;"></i>
        <span style="font-size: 11px;">Erro ao carregar a nota: ${err.message}</span>
      </div>
    `;
  }
}

export async function saveActiveNote() {
  if (!activeNoteFilename) return;
  const textarea = document.getElementById('active-note-textarea');
  if (!textarea) return;

  const content = textarea.value;
  try {
    const res = await fetch('/api/notes/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: activeNoteFilename, content, vaultPath: window.config?.obsidian_path || '' })
    });
    if (!res.ok) throw new Error('Falha ao salvar nota');
    
    if (typeof window.showVexxToast === 'function') {
      window.showVexxToast(`Nota "${activeNoteFilename}" salva com sucesso.`, 'success');
    }
    
    if (typeof window.loadSchedulerAndNotes === 'function') {
      window.loadSchedulerAndNotes();
    }
  } catch (err) {
    alert(`Erro ao salvar nota: ${err.message}`);
  }
}

export async function deleteNote(filename) {
  if (!confirm(`Deseja realmente excluir a nota "${filename}"?`)) return;
  try {
    const res = await fetch('/api/notes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, vaultPath: window.config?.obsidian_path || '' })
    });
    if (!res.ok) throw new Error('Falha ao excluir nota');
    
    if (typeof window.showVexxToast === 'function') {
      window.showVexxToast(`Nota "${filename}" excluída.`, 'info');
    }
    
    if (activeNoteFilename === filename) {
      activeNoteFilename = null;
      const viewport = document.getElementById('note-editor-viewport');
      if (viewport) {
        viewport.innerHTML = `
          <div class="editor-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-tertiary); height: 100%; gap: 8px;">
            <i class="ti ti-edit" style="font-size: 32px; color: var(--border-medium);"></i>
            <p style="font-size: 11px; margin: 0; max-width: 280px; line-height: 1.5;">Selecione uma nota markdown na lista ou crie uma nova para visualizar e editar o cérebro das IAs.</p>
          </div>
        `;
      }
    }
    
    if (typeof window.loadSchedulerAndNotes === 'function') {
      window.loadSchedulerAndNotes();
    }
  } catch (err) {
    alert(`Erro ao excluir nota: ${err.message}`);
  }
}

export async function showNewNoteModal() {
  const name = prompt('Digite o nome da nova nota (ex: diario.md ou vocabulario.md):');
  if (!name) return;
  
  let filename = name.trim();
  if (!filename.endsWith('.md')) {
    filename += '.md';
  }

  try {
    const res = await fetch('/api/notes/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content: '# ' + filename.replace('.md', '') + '\n\n', vaultPath: window.config?.obsidian_path || '' })
    });
    if (!res.ok) throw new Error('Falha ao criar nota');
    
    if (typeof window.showVexxToast === 'function') {
      window.showVexxToast(`Nota "${filename}" criada.`, 'success');
    }
    
    if (typeof window.loadSchedulerAndNotes === 'function') {
      window.loadSchedulerAndNotes();
    }
    setTimeout(() => selectNote(filename), 300);
  } catch (err) {
    alert(`Erro ao criar nota: ${err.message}`);
  }
}

// Expose globally
window.renderNotesList = renderNotesList;
window.selectNote = selectNote;
window.deleteNote = deleteNote;
window.saveActiveNote = saveActiveNote;
window.showNewNoteModal = showNewNoteModal;
