// Vexx AI Debate Arena — IA Skills Manager Module

export async function loadSkillsList() {
  const tableBody = document.getElementById('skills-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="4" class="empty-table-row" style="text-align: center; padding: 24px;">
        <div class="dots-loader" style="margin: 0 auto;"><span></span><span></span><span></span></div>
      </td>
    </tr>
  `;

  try {
    const res = await fetch('/api/skills');
    if (!res.ok) throw new Error('Falha ao obter lista de habilidades');
    const data = await res.json();
    renderSkillsTable(data.skills || []);
  } catch (err) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-table-row" style="text-align: center; padding: 24px; color: var(--color-text-danger);">
          <i class="ti ti-alert-triangle" style="margin-right: 4px;"></i>Erro ao carregar habilidades: ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderSkillsTable(skills) {
  const tableBody = document.getElementById('skills-table-body');
  if (!tableBody) return;

  if (skills.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-table-row" style="text-align: center; padding: 24px; color: var(--text-tertiary);">
          Nenhuma habilidade criada ainda. As IAs podem criar scripts na pasta <code>skills/</code> de forma autônoma.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '';
  skills.forEach(skill => {
    const row = document.createElement('tr');
    const ext = skill.name.split('.').pop().toLowerCase();
    
    let languageLabel = 'Código';
    let badgeClass = 'badge-neutral';
    if (ext === 'py') {
      languageLabel = 'Python';
      badgeClass = 'badge-success';
    } else if (ext === 'js') {
      languageLabel = 'JavaScript';
      badgeClass = 'badge-warning';
    } else if (ext === 'sh' || ext === 'ps1' || ext === 'bat') {
      languageLabel = 'Script de Shell';
      badgeClass = 'badge-info';
    } else if (ext === 'md') {
      languageLabel = 'Markdown/Info';
      badgeClass = 'badge-purple';
    }

    const modifiedTime = new Date(skill.mtime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    row.innerHTML = `
      <td><strong style="color: var(--text-primary); font-family: var(--font-mono); font-size: 12px;">${skill.name}</strong></td>
      <td><span class="${badgeClass}">${languageLabel}</span></td>
      <td style="color: var(--text-secondary); font-size: 11px;">${modifiedTime}</td>
      <td style="text-align: right; display: flex; justify-content: flex-end; gap: 6px;">
        <button class="action-btn" onclick="viewSkillContent('${skill.name}')" style="padding: 3px 8px; font-size: 11px;">
          <i class="ti ti-eye"></i> Ver
        </button>
        <button class="action-btn" onclick="deleteSkill('${skill.name}')" style="padding: 3px 8px; font-size: 11px; color: var(--color-text-danger); border-color: rgba(239, 68, 68, 0.25);">
          <i class="ti ti-trash"></i> Excluir
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

export async function viewSkillContent(filename) {
  const viewport = document.getElementById('skill-editor-viewport');
  if (!viewport) return;

  viewport.style.display = 'block';
  viewport.innerHTML = `
    <div class="dots-loader" style="margin: auto;"><span></span><span></span><span></span></div>
  `;
  viewport.scrollIntoView({ behavior: 'smooth' });

  try {
    // Read the skill file using the terminal read route
    const res = await fetch('/api/terminal/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: `skills/${filename}` })
    });
    if (!res.ok) throw new Error('Falha ao ler conteúdo do arquivo');
    const data = await res.json();

    viewport.innerHTML = `
      <div class="card note-editor-container" style="display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg-surface);">
        <div class="note-editor-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 8px; margin-bottom: 8px;">
          <h3 style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0; font-family: var(--font-mono);">${filename}</h3>
          <div style="display: flex; gap: 6px;">
            <button class="action-btn success-btn" onclick="saveSkillContent('${filename}')" style="height: 28px; font-size: 10px; padding: 4px 10px; background: var(--text-success); color: white; border-color: var(--text-success);">
              <i class="ti ti-device-floppy"></i> Salvar
            </button>
            <button class="action-btn" onclick="closeSkillEditor()" style="height: 28px; font-size: 10px; padding: 4px 10px;">
              <i class="ti ti-x"></i> Fechar
            </button>
          </div>
        </div>
        <textarea id="active-skill-textarea" class="note-editor-textarea" style="flex-grow: 1; resize: none; background: var(--bg-surface-alt); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px; font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); line-height: 1.5; outline: none;" placeholder="Escreva o script aqui...">${data.content || ''}</textarea>
      </div>
    `;
  } catch (err) {
    viewport.innerHTML = `
      <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-danger); gap: 6px;">
        <i class="ti ti-alert-triangle" style="font-size: 24px;"></i>
        <span style="font-size: 11px;">Erro ao carregar conteúdo da habilidade: ${err.message}</span>
        <button class="action-btn" onclick="closeSkillEditor()" style="margin-top: 8px;">Fechar</button>
      </div>
    `;
  }
}

export async function saveSkillContent(filename) {
  const textarea = document.getElementById('active-skill-textarea');
  if (!textarea) return;

  const content = textarea.value;
  try {
    const res = await fetch('/api/skills/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content })
    });
    if (!res.ok) throw new Error('Falha ao salvar habilidade');
    
    if (typeof window.showVexxToast === 'function') {
      window.showVexxToast(`Habilidade "${filename}" salva com sucesso.`, 'success');
    }
    loadSkillsList();
    closeSkillEditor();
  } catch (err) {
    alert(`Erro ao salvar: ${err.message}`);
  }
}

export function closeSkillEditor() {
  const viewport = document.getElementById('skill-editor-viewport');
  if (viewport) {
    viewport.style.display = 'none';
    viewport.innerHTML = '';
  }
}

export async function deleteSkill(filename) {
  if (!confirm(`Deseja realmente remover a habilidade "${filename}"?`)) return;

  try {
    const res = await fetch('/api/skills/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    if (!res.ok) throw new Error('Falha ao excluir habilidade');

    if (typeof window.showVexxToast === 'function') {
      window.showVexxToast(`Habilidade "${filename}" excluída.`, 'info');
    }
    loadSkillsList();
    closeSkillEditor();
  } catch (err) {
    alert(`Erro ao excluir: ${err.message}`);
  }
}

export async function showNewSkillModal() {
  const name = prompt('Digite o nome da nova habilidade (ex: limpar_cache.py ou ping_teste.js):');
  if (!name) return;

  const filename = name.trim();
  const ext = filename.split('.').pop().toLowerCase();
  let defaultContent = '';
  if (ext === 'py') {
    defaultContent = '#!/usr/bin/env python\n# -*- coding: utf-8 -*-\n\ndef main():\n    print("Habilidade executada!")\n\nif __name__ == "__main__":\n    main()\n';
  } else if (ext === 'js') {
    defaultContent = '// Habilidade Javascript Autônoma\nconsole.log("Habilidade executada!");\n';
  }

  try {
    const res = await fetch('/api/skills/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content: defaultContent })
    });
    if (!res.ok) throw new Error('Falha ao criar habilidade');

    if (typeof window.showVexxToast === 'function') {
      window.showVexxToast(`Habilidade "${filename}" criada com sucesso.`, 'success');
    }
    loadSkillsList();
    setTimeout(() => viewSkillContent(filename), 300);
  } catch (err) {
    alert(`Erro ao criar: ${err.message}`);
  }
}

// Expose globally
window.loadSkillsList = loadSkillsList;
window.viewSkillContent = viewSkillContent;
window.saveSkillContent = saveSkillContent;
window.closeSkillEditor = closeSkillEditor;
window.deleteSkill = deleteSkill;
window.showNewSkillModal = showNewSkillModal;
