// wifa jl — Main Module Entry Point and Bootstrapper
import './state.js';
import './security.js';
import './ui.js';
import './debate.js';
import './terminal.js';
import './scheduler.js';
import './notes.js';
import './skills.js';
import './dashboard.js';
import './plugins.js';


async function bootstrap() {
  const mainContent = document.querySelector('.app-main-content');
  if (!mainContent) return;

  try {
    // 1. Fetch and inject components sequentially
    const components = [
      { name: 'dashboard.html' },
      { name: 'arena.html' },
      { name: 'settings.html' },
      { name: 'terminal.html' },
      { name: 'notes.html' },
      { name: 'skills.html' },
      { name: 'plugins.html' }
    ];
    
    let htmlContent = '';
    for (const comp of components) {
      const res = await fetch(`components/${comp.name}`);
      if (!res.ok) throw new Error(`Failed to load component: ${comp.name}`);
      const text = await res.text();
      htmlContent += text;
    }
    
    // Clear loading card and mount all components
    mainContent.innerHTML = htmlContent;
    
    // 2. Initialize application state and UI indicators
    if (typeof window.loadConfig === 'function') window.loadConfig();
    if (typeof window.loadLongTermMemories === 'function') window.loadLongTermMemories();
    if (typeof window.loadSystemPaths === 'function') window.loadSystemPaths();
    if (typeof window.updateProviderStatuses === 'function') window.updateProviderStatuses();
    if (typeof window.loadChatMessages === 'function') window.loadChatMessages();
    if (typeof window.updateActiveModelDisplay === 'function') window.updateActiveModelDisplay();
    if (typeof window.loadModelUsage === 'function') window.loadModelUsage();
    
    // Initialize wifa jl dashboard and plugins
    import('./dashboard.js').then(mod => {
      if (typeof mod.refreshDashboard === 'function') mod.refreshDashboard();
    });
    import('./plugins.js').then(mod => {
      if (typeof mod.loadPluginsList === 'function') mod.loadPluginsList();
    });
    if (typeof window.switchTab === 'function') window.switchTab('dashboard');

    
    // 3. Setup event listeners
    const textInput = document.getElementById('chat-message-input');
    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (typeof window.startDebate === 'function') {
            window.startDebate();
          }
        }
      });
    }

    // Restore Collapsed Sidebar state
    const sidebarCollapsed = localStorage.getItem('vexx_sidebar_collapsed') === 'true';
    if (sidebarCollapsed) {
      const sidebar = document.querySelector('.app-sidebar');
      if (sidebar) {
        sidebar.classList.add('collapsed');
        const icon = sidebar.querySelector('.toggle-sidebar-btn i');
        if (icon) icon.className = 'ti ti-chevron-right';
      }
    }

    // Check theme preference
    const savedTheme = localStorage.getItem('vexx-theme') || 'system';
    const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
    
    // Sync theme toggle icons
    const themeToggleIcons = document.querySelectorAll('.theme-toggle-icon i');
    themeToggleIcons.forEach(icon => {
      icon.className = isDark ? 'ti ti-sun' : 'ti ti-moon';
    });

    console.log('[Vexx AI Arena] Application bootstrapped successfully.');
  } catch (error) {
    console.error('[Vexx AI Arena] Bootstrapping failed:', error);
    mainContent.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--color-text-danger);">
        <i class="ti ti-alert-triangle" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
        <h2>Erro ao iniciar aplicativo</h2>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Boot on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
