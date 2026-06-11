// wifa jl — Plugins Manager Lógica

export async function loadPluginsList() {
  try {
    const res = await fetch('/api/plugins/list');
    if (!res.ok) throw new Error('Plugins fetch failed');
    const plugins = await res.json();

    const listEl = document.getElementById('installed-plugins-list');
    if (!listEl) return;

    if (plugins.length === 0) {
      listEl.innerHTML = '<div style="font-size: 11px; text-align: center; color: var(--text-tertiary); padding: 20px;">Nenhum plugin instalado ainda.</div>';
      return;
    }

    listEl.innerHTML = '';
    plugins.forEach(plugin => {
      const item = document.createElement('div');
      item.className = 'card';
      item.style.background = 'var(--bg-surface-alt)';
      item.style.padding = '10px';
      item.style.borderRadius = 'var(--radius-sm)';
      item.style.border = '1px solid var(--border-light)';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '6px';

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; font-size: 13px;">${plugin.name}</span>
          <span class="badge-neutral" style="font-size: 8px;">v${plugin.version}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary);">
          ${plugin.description}
        </div>
        <div style="font-size: 9px; font-family: var(--font-mono); color: var(--text-tertiary);">
          ID: ${plugin.id} | Main: ${plugin.main}
        </div>
        <div style="display: flex; gap: 6px; margin-top: 4px; justify-content: flex-end;">
          <button class="action-btn" onclick="deletePlugin('${plugin.id}')" style="height: 22px; font-size: 9px; padding: 0 8px; border-color: transparent; color: var(--color-text-danger);">
            <i class="ti ti-trash"></i> Desinstalar
          </button>
        </div>
      `;
      listEl.appendChild(item);

      // Dynamically load JS/CSS assets of the plugin
      loadPluginAssets(plugin);
    });

  } catch (e) {
    console.error('[Plugins] Error loading plugins list:', e.message);
  }
}

// Dynamically inject script and style tags into document head
function loadPluginAssets(plugin) {
  const scriptId = `plugin-script-${plugin.id}`;
  const styleId = `plugin-style-${plugin.id}`;

  if (!document.getElementById(scriptId)) {
    console.log(`[Plugins] Loading plugin script: ${plugin.name}`);
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `/api/plugins/assets/${plugin.folderName}/${plugin.main}`;
    script.type = 'text/javascript';
    document.head.appendChild(script);
  }

  if (plugin.styles && !document.getElementById(styleId)) {
    console.log(`[Plugins] Loading plugin CSS: ${plugin.name}`);
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = `/api/plugins/assets/${plugin.folderName}/${plugin.styles}`;
    document.head.appendChild(link);
  }
}

// Create/Install Plugin
window.handleCreatePlugin = async function(event) {
  event.preventDefault();
  try {
    const name = document.getElementById('plugin-name-input').value.trim();
    const id = document.getElementById('plugin-id-input').value.trim();
    const description = document.getElementById('plugin-desc-input').value.trim();
    const code = document.getElementById('plugin-code-input').value;
    const css = document.getElementById('plugin-css-input').value;

    const res = await fetch('/api/plugins/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id, description, code, css })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Plugin creation failed');
    }

    // Clear form
    document.getElementById('create-plugin-form').reset();
    
    // Reload UI
    await loadPluginsList();
  } catch (e) {
    alert(`Erro ao criar plugin: ${e.message}`);
  }
};

// Delete Plugin
window.deletePlugin = async function(id) {
  if (!confirm(`Deseja realmente remover o plugin "${id}"?`)) return;
  try {
    const res = await fetch('/api/plugins/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error('Plugin delete failed');

    // Remove script and link tags from DOM
    const script = document.getElementById(`plugin-script-${id}`);
    const style = document.getElementById(`plugin-style-${id}`);
    if (script) script.remove();
    if (style) style.remove();

    await loadPluginsList();
  } catch (e) {
    console.error('[Plugins] Error deleting plugin:', e.message);
  }
};
