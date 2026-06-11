// wifa jl — Executive Dashboard & Command Palette Lógica

let activeGraphData = { nodes: [], relations: [] };
let planCreatorSteps = [];

// Command Palette options
const commandsList = [
  { name: 'Debate Arena - Abrir Chat', action: () => window.switchTab('arena'), icon: 'ti-message-2' },
  { name: 'Configurações - Chaves de API', action: () => window.switchTab('settings'), icon: 'ti-settings' },
  { name: 'Histórico - Ver Arquivos e Imagens', action: () => window.switchTab('history'), icon: 'ti-folder' },
  { name: 'Cérebro - Notas do Obsidian', action: () => window.switchTab('brain'), icon: 'ti-brain' },
  { name: 'Habilidades - Scripts Locais', action: () => window.switchTab('skills'), icon: 'ti-code' },
  { name: 'Plugins - Expandir Capacidades', action: () => window.switchTab('plugins'), icon: 'ti-plug' },
  { name: 'Escanear Grafo de Dependências', action: () => triggerGraphScan(), icon: 'ti-scan' },
  { name: 'Indexar RAG semântico', action: () => triggerRAGIndexation(), icon: 'ti-database' },
  { name: 'Criar Novo Plano Autônomo', action: () => openNewPlanModal(), icon: 'ti-checklist' },
  { name: 'Limpar Arena de Chat', action: () => { if (typeof window.clearChat === 'function') window.clearChat(); }, icon: 'ti-trash' }
];

export async function refreshDashboard() {
  console.log('[Dashboard] Refreshing dashboard modules...');
  await Promise.all([
    loadHardwareStatus(),
    loadGraphData(),
    loadPlannerPlans(),
    loadSystemInsights(),
    loadAuditLogs()
  ]);
}

// 1. Load Hardware CPU/RAM/Disk details
async function loadHardwareStatus() {
  try {
    const res = await fetch('/api/apps/status');
    if (!res.ok) throw new Error('Status request failed');
    const data = await res.json();

    // Set gauges
    const cpuPct = parseFloat(data.hardware.memoryUsagePercent || data.processes[0]?.cpu || 12); // placeholder or process cpu
    const ramPct = parseFloat(data.hardware.memoryPercent || 0);

    // Update SVG circles
    const cpuCircle = document.getElementById('cpu-gauge');
    const ramCircle = document.getElementById('ram-gauge');
    
    if (cpuCircle) {
      const offset = 100 - cpuPct;
      cpuCircle.style.strokeDashoffset = offset;
    }
    if (ramCircle) {
      const offset = 100 - ramPct;
      ramCircle.style.strokeDashoffset = offset;
    }

    // Update Text
    const cpuText = document.getElementById('cpu-text');
    const ramText = document.getElementById('ram-text');
    if (cpuText) cpuText.textContent = `${cpuPct.toFixed(0)}%`;
    if (ramText) ramText.textContent = `${ramPct.toFixed(0)}%`;

    // Metadata
    const platformEl = document.getElementById('hw-platform');
    const cpuModelEl = document.getElementById('hw-cpu-model');
    const ramFreeEl = document.getElementById('hw-ram-free');
    const uptimeEl = document.getElementById('hw-uptime');

    if (platformEl) platformEl.textContent = `${data.hardware.platform} (${data.hardware.arch})`;
    if (cpuModelEl) {
      cpuModelEl.textContent = data.hardware.cpuModel;
      cpuModelEl.title = data.hardware.cpuModel;
    }
    if (ramFreeEl) ramFreeEl.textContent = `${data.hardware.freeMemoryGB} GB livres / ${data.hardware.totalMemoryGB} GB`;
    if (uptimeEl) uptimeEl.textContent = `${data.hardware.uptimeHours} horas`;

    // Disk space lists
    const diskContainer = document.getElementById('disk-list-container');
    if (diskContainer) {
      diskContainer.innerHTML = '';
      if (data.disks.length === 0) {
        diskContainer.innerHTML = '<div style="font-size: 10px; color: var(--text-tertiary);">Nenhum disco detectado.</div>';
      }
      data.disks.forEach(d => {
        const diskDiv = document.createElement('div');
        diskDiv.style.fontSize = '10px';
        diskDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><i class="ti ti-device-sd-card"></i> <strong>Disk ${d.drive}</strong> (${d.label})</span>
            <span>${d.freeGB} GB livres de ${d.sizeGB} GB</span>
          </div>
          <div style="height: 4px; background: var(--bg-surface-alt); border-radius: 2px; overflow: hidden;">
            <div style="height: 100%; width: ${d.usedPercent}%; background: ${parseFloat(d.usedPercent) > 90 ? 'var(--color-text-danger)' : 'var(--accent)'};"></div>
          </div>
        `;
        diskContainer.appendChild(diskDiv);
      });
    }

  } catch (e) {
    console.error('[Dashboard] Error fetching hardware status:', e.message);
  }
}

// 2. Load Knowledge Graph data
async function loadGraphData() {
  try {
    const res = await fetch('/api/knowledge/graph');
    if (!res.ok) throw new Error('Graph request failed');
    const data = await res.json();
    
    activeGraphData = data;
    
    const nodesCountEl = document.getElementById('graph-stats-nodes');
    const edgesCountEl = document.getElementById('graph-stats-edges');
    if (nodesCountEl) nodesCountEl.textContent = `Nós: ${data.nodes.length}`;
    if (edgesCountEl) edgesCountEl.textContent = `Relações: ${data.relations.length}`;

    drawKnowledgeGraph(data.nodes, data.relations);
  } catch (e) {
    console.error('[Dashboard] Error fetching graph:', e.message);
  }
}

// 3. Simple Force-directed SVG Graph layout engine
function drawKnowledgeGraph(nodes, relations) {
  const svg = document.getElementById('dashboard-graph-svg');
  if (!svg) return;
  svg.innerHTML = ''; // clear

  const width = svg.clientWidth || 300;
  const height = svg.clientHeight || 180;

  if (nodes.length === 0) {
    const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textNode.setAttribute('x', width / 2);
    textNode.setAttribute('y', height / 2);
    textNode.setAttribute('text-anchor', 'middle');
    textNode.setAttribute('fill', 'var(--text-tertiary)');
    textNode.setAttribute('font-size', '10px');
    textNode.textContent = 'Grafo vazio. Clique em escanear para gerar.';
    svg.appendChild(textNode);
    return;
  }

  // Position nodes radially/randomly
  const nodeMap = {};
  nodes.forEach((n, idx) => {
    const angle = (idx / nodes.length) * 2 * Math.PI;
    const radius = Math.min(width, height) * 0.35 + (idx % 2 === 0 ? 10 : -10);
    n.x = width / 2 + Math.cos(angle) * radius;
    n.y = height / 2 + Math.sin(angle) * radius;
    nodeMap[n.id] = n;
  });

  // Run simple force relaxation/repulsion loop for better node layouts
  const iterations = 50;
  for (let iter = 0; iter < iterations; iter++) {
    // 1. Repulsion between nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 40) {
          const force = (40 - dist) / dist * 0.3;
          nodes[i].x += dx * force;
          nodes[i].y += dy * force;
          nodes[j].x -= dx * force;
          nodes[j].y -= dy * force;
        }
      }
    }

    // 2. Attraction along relations/edges
    relations.forEach(rel => {
      const fromNode = nodeMap[rel.from];
      const toNode = nodeMap[rel.to];
      if (fromNode && toNode) {
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 50) {
          const force = (dist - 50) / dist * 0.05;
          fromNode.x += dx * force;
          fromNode.y += dy * force;
          toNode.x -= dx * force;
          toNode.y -= dy * force;
        }
      }
    });

    // 3. Keep within bounds
    nodes.forEach(n => {
      n.x = Math.max(12, Math.min(width - 12, n.x));
      n.y = Math.max(12, Math.min(height - 12, n.y));
    });
  }

  // Draw relations/links
  relations.forEach(rel => {
    const fromNode = nodeMap[rel.from];
    const toNode = nodeMap[rel.to];
    if (fromNode && toNode) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromNode.x);
      line.setAttribute('y1', fromNode.y);
      line.setAttribute('x2', toNode.x);
      line.setAttribute('y2', toNode.y);
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }
  });

  // Draw node circles
  nodes.forEach(n => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Choose color
    let color = 'var(--accent)';
    if (n.type === 'directory') color = 'var(--color-text-warning)';
    else if (n.type === 'file') color = 'var(--color-text-info)';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', n.x);
    circle.setAttribute('cy', n.y);
    circle.setAttribute('r', n.type === 'directory' ? '5' : '4');
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', 'rgba(255,255,255,0.2)');
    circle.setAttribute('stroke-width', '1');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${n.label} (${n.type})`;
    circle.appendChild(title);

    group.appendChild(circle);

    // Label (if few nodes)
    if (nodes.length < 25) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', n.x + 8);
      text.setAttribute('y', n.y + 3);
      text.setAttribute('fill', 'var(--text-secondary)');
      text.setAttribute('font-size', '8px');
      text.setAttribute('font-family', 'sans-serif');
      text.textContent = n.label;
      group.appendChild(text);
    }

    // Drag support
    let dragging = false;
    circle.addEventListener('mousedown', (e) => {
      dragging = true;
      svg.style.cursor = 'grabbing';
    });

    svg.addEventListener('mousemove', (e) => {
      if (dragging) {
        const rect = svg.getBoundingClientRect();
        n.x = e.clientX - rect.left;
        n.y = e.clientY - rect.top;
        drawKnowledgeGraph(nodes, relations);
      }
    });

    window.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        if (svg) svg.style.cursor = 'grab';
      }
    });

    svg.appendChild(group);
  });
}

// 4. Trigger Graph scan on server
export async function triggerGraphScan() {
  try {
    const statusEl = document.getElementById('audit-logs-viewport');
    if (statusEl) {
      statusEl.innerHTML += `<div>[SYSTEM] Iniciando escaneamento automático do grafo...</div>`;
    }
    const res = await fetch('/api/knowledge/scan', { method: 'POST' });
    if (!res.ok) throw new Error('Scan failed');
    const data = await res.json();
    
    if (statusEl) {
      statusEl.innerHTML += `<div>[SYSTEM] Escaneamento concluído! Nós: ${data.summary.nodes}, Relações: ${data.summary.relations}.</div>`;
      statusEl.scrollTop = statusEl.scrollHeight;
    }
    
    // Refresh UI
    await loadGraphData();
  } catch (e) {
    console.error('[Dashboard] Error scanning graph:', e.message);
  }
}

// 5. Trigger RAG indexation
export async function triggerRAGIndexation() {
  try {
    const statusEl = document.getElementById('audit-logs-viewport');
    if (statusEl) {
      statusEl.innerHTML += `<div>[RAG] Iniciando indexação semântica de arquivos do workspace...</div>`;
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    const res = await fetch('/api/rag/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkSize: 600, overlap: 150 })
    });
    if (!res.ok) throw new Error('RAG index request failed');
    const data = await res.json();

    if (statusEl) {
      statusEl.innerHTML += `<div>[RAG] Indexação concluída! Documentos: ${data.summary.documents}, Chunks de contexto: ${data.summary.chunks}</div>`;
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    await loadSystemInsights(); // Reload insights to reflect index status
  } catch (e) {
    console.error('[Dashboard] Error indexing RAG:', e.message);
  }
}

// 6. Load Planner tasks list
async function loadPlannerPlans() {
  try {
    const res = await fetch('/api/planner/list');
    if (!res.ok) throw new Error('Planner list failed');
    const plans = await res.json();

    const container = document.getElementById('planner-plans-container');
    if (!container) return;

    if (plans.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; text-align: center; color: var(--text-tertiary); padding: 20px;">Nenhum plano de tarefa criado ainda.</div>';
      return;
    }

    container.innerHTML = '';
    plans.forEach(plan => {
      const planDiv = document.createElement('div');
      planDiv.className = 'card';
      planDiv.style.background = 'var(--bg-surface-alt)';
      planDiv.style.padding = '10px';
      planDiv.style.borderRadius = 'var(--radius-sm)';
      planDiv.style.border = '1px solid var(--border-light)';
      planDiv.style.display = 'flex';
      planDiv.style.flexDirection = 'column';
      planDiv.style.gap = '8px';

      // Header row
      let statusColor = 'var(--text-tertiary)';
      if (plan.status === 'running') statusColor = 'var(--color-text-warning)';
      else if (plan.status === 'completed') statusColor = 'var(--color-text-success)';
      else if (plan.status === 'failed') statusColor = 'var(--color-text-danger)';

      // Count step progress
      const completedSteps = plan.steps.filter(s => s.status === 'success').length;
      const totalSteps = plan.steps.length;

      planDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 600;">${plan.title}</span>
          <span style="font-size: 10px; font-weight: 600; color: ${statusColor}; text-transform: uppercase;">${plan.status}</span>
        </div>
        <div style="font-size: 10px; color: var(--text-tertiary);">
          Progresso: ${completedSteps}/${totalSteps} passos finalizados
        </div>
        <div class="steps-progress-dots" style="display: flex; gap: 4px; margin-top: 2px;">
          ${plan.steps.map(s => {
            let color = 'rgba(255,255,255,0.1)';
            if (s.status === 'running') color = 'var(--color-text-warning)';
            else if (s.status === 'success') color = 'var(--color-text-success)';
            else if (s.status === 'failed') color = 'var(--color-text-danger)';
            return `<div style="width: 8px; height: 8px; border-radius: 50%; background: ${color};" title="Passo ${s.id}: ${s.type} (${s.status})"></div>`;
          }).join('')}
        </div>
        <div style="display: flex; gap: 6px; margin-top: 4px; justify-content: flex-end;">
          <button class="action-btn" onclick="executePlanStep('${plan.id}')" style="height: 22px; font-size: 9px; padding: 0 8px; background: var(--accent); color: white;" ${plan.status === 'completed' || plan.status === 'failed' ? 'disabled' : ''}>
            <i class="ti ti-arrow-right"></i> Executar Passo
          </button>
          <button class="action-btn" onclick="deletePlan('${plan.id}')" style="height: 22px; font-size: 9px; padding: 0 8px; border-color: transparent; color: var(--color-text-danger);">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(planDiv);
    });

  } catch (e) {
    console.error('[Dashboard] Error fetching plans:', e.message);
  }
}

// Execute single step of a plan
window.executePlanStep = async function(planId) {
  try {
    const statusEl = document.getElementById('audit-logs-viewport');
    if (statusEl) {
      statusEl.innerHTML += `<div>[PLANNER] Executando próximo passo do plano ${planId}...</div>`;
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    const res = await fetch('/api/planner/execute-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId })
    });
    if (!res.ok) throw new Error('Step execution failed');
    const data = await res.json();

    if (statusEl) {
      if (data.step) {
        statusEl.innerHTML += `<div>[PLANNER] Passo ${data.step.id} (${data.step.type}) status: ${data.step.status}</div>`;
        if (data.step.error) {
          statusEl.innerHTML += `<div style="color: var(--color-text-danger)">[PLANNER ERROR] ${data.step.error}</div>`;
        }
      } else {
        statusEl.innerHTML += `<div>[PLANNER] Plano finalizado: ${data.info}</div>`;
      }
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    await loadPlannerPlans();
  } catch (e) {
    console.error('[Dashboard] Error executing planner step:', e.message);
  }
};

// Delete plan
window.deletePlan = async function(planId) {
  try {
    const res = await fetch('/api/planner/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId })
    });
    if (!res.ok) throw new Error('Delete plan failed');
    await loadPlannerPlans();
  } catch (e) {
    console.error('[Dashboard] Error deleting plan:', e.message);
  }
};

// 7. Load Cognitive System Insights
async function loadSystemInsights() {
  try {
    const res = await fetch('/api/insights');
    if (!res.ok) throw new Error('Insights failed');
    const insights = await res.json();

    const container = document.getElementById('insights-list-container');
    if (!container) return;

    container.innerHTML = '';
    insights.forEach(insight => {
      const insightDiv = document.createElement('div');
      insightDiv.style.background = 'var(--bg-surface-alt)';
      insightDiv.style.padding = '8px 10px';
      insightDiv.style.borderRadius = 'var(--radius-sm)';
      insightDiv.style.borderLeft = `3px solid ${
        insight.severity === 'high' ? 'var(--color-text-danger)' : 
        (insight.severity === 'medium' ? 'var(--color-text-warning)' : 'var(--color-text-success)')
      }`;
      insightDiv.style.fontSize = '11px';

      insightDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <strong style="color: var(--text-primary);">${insight.title}</strong>
          <span style="font-size: 8px; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,0.06);">${insight.category}</span>
        </div>
        <div style="color: var(--text-secondary); line-height: 1.4; margin-bottom: 4px;">
          ${insight.description}
        </div>
        ${insight.actionable ? `
          <button class="action-btn" onclick="executeInsightAction('${insight.fixCommand}')" style="height: 20px; font-size: 9px; padding: 0 6px; background: var(--color-text-success); color: white; border-color: transparent;">
            <i class="ti ti-tools"></i> Corrigir com "${insight.fixCommand}"
          </button>
        ` : ''}
      `;
      container.appendChild(insightDiv);
    });

    // Also update RAG index status block
    const statusRes = await fetch('/api/rag/status');
    if (statusRes.ok) {
      const stats = await statusRes.json();
      const statusText = document.getElementById('rag-status-value');
      if (statusText) {
        statusText.textContent = stats.indexed ? `${stats.chunkCount} chunks (${stats.docCount} docs)` : 'Não indexado';
      }
    }

  } catch (e) {
    console.error('[Dashboard] Error fetching insights:', e.message);
  }
}

window.executeInsightAction = async function(command) {
  try {
    const statusEl = document.getElementById('audit-logs-viewport');
    if (statusEl) {
      statusEl.innerHTML += `<div>[INSIGHT FIX] Executando comando de correção: ${command}...</div>`;
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    const res = await fetch('/api/terminal/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    if (!res.ok) throw new Error('Fix command execution failed');
    const data = await res.json();

    if (statusEl) {
      if (data.error) {
        statusEl.innerHTML += `<div style="color: var(--color-text-danger)">[INSIGHT FIX ERROR] ${data.error}</div>`;
      } else {
        statusEl.innerHTML += `<div style="color: var(--color-text-success)">[INSIGHT FIX SUCCESS] Correção concluída!</div>`;
      }
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    await refreshDashboard();
  } catch (e) {
    console.error('[Dashboard] Error running insight action:', e.message);
  }
};

// 8. Load Auditoria Global Logs
async function loadAuditLogs() {
  try {
    const res = await fetch('/api/audit/logs');
    if (!res.ok) throw new Error('Logs failed');
    const data = await res.json();

    const viewport = document.getElementById('audit-logs-viewport');
    if (!viewport) return;

    if (data.logs.length === 0) {
      viewport.innerHTML = '<div>[SYSTEM] Auditoria global operacional. Aguardando eventos...</div>';
      return;
    }

    viewport.innerHTML = data.logs.map(l => {
      // Escape HTML
      const esc = l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let colorStyle = '';
      if (esc.includes('[ERROR]')) colorStyle = 'color: var(--color-text-danger);';
      else if (esc.includes('[COMMAND]')) colorStyle = 'color: #38bdf8;';
      else if (esc.includes('[FILE]') || esc.includes('[WRITE]')) colorStyle = 'color: #34d399;';
      return `<div style="${colorStyle}">${esc}</div>`;
    }).join('');

  } catch (e) {
    console.error('[Dashboard] Error reading audit logs:', e.message);
  }
}

window.clearAuditLogsMock = function() {
  const viewport = document.getElementById('audit-logs-viewport');
  if (viewport) {
    viewport.innerHTML = '<div>[SYSTEM] Console limpo pelo usuário.</div>';
  }
};

// 9. Command Palette / Raycast Launcher logic
window.openCommandPalette = function() {
  const modal = document.getElementById('command-palette-modal');
  const input = document.getElementById('command-palette-input');
  if (modal && input) {
    modal.style.display = 'flex';
    input.value = '';
    filterCommandPalette();
    input.focus();
  }
};

window.closeCommandPalette = function() {
  const modal = document.getElementById('command-palette-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.filterCommandPalette = function() {
  const input = document.getElementById('command-palette-input');
  const resultsContainer = document.getElementById('command-palette-results');
  if (!input || !resultsContainer) return;

  const query = input.value.toLowerCase().trim();
  resultsContainer.innerHTML = '';

  const filtered = commandsList.filter(cmd => cmd.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    resultsContainer.innerHTML = '<div style="font-size: 11px; text-align: center; color: var(--text-tertiary); padding: 12px;">Nenhum comando encontrado.</div>';
    return;
  }

  filtered.forEach(cmd => {
    const item = document.createElement('div');
    item.style.padding = '8px 14px';
    item.style.fontSize = '12px';
    item.style.cursor = 'pointer';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.transition = 'background 0.2s';
    
    // Add hover behavior
    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255,255,255,0.04)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });

    item.innerHTML = `
      <i class="ti ${cmd.icon}" style="color: var(--accent); font-size: 14px;"></i>
      <span>${cmd.name}</span>
    `;

    item.onclick = () => {
      cmd.action();
      closeCommandPalette();
    };

    resultsContainer.appendChild(item);
  });
};

// Setup Escape key for command palette
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCommandPalette();
    closeNewPlanModal();
  }
  // Ctrl + P keybind
  if (e.ctrlKey && e.key === 'p') {
    e.preventDefault();
    openCommandPalette();
  }
});

// Close when clicking outside palette card
const modalPalette = document.getElementById('command-palette-modal');
if (modalPalette) {
  modalPalette.onclick = (e) => {
    if (e.target === modalPalette) closeCommandPalette();
  };
}

// 10. Planner Creation Modal
window.openNewPlanModal = function() {
  const modal = document.getElementById('new-plan-modal');
  const title = document.getElementById('plan-title-input');
  if (modal && title) {
    modal.style.display = 'flex';
    title.value = '';
    planCreatorSteps = [];
    renderPlanCreatorSteps();
  }
};

window.closeNewPlanModal = function() {
  const modal = document.getElementById('new-plan-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.addStepToPlanCreator = function() {
  planCreatorSteps.push({ type: 'command', payload: '', targetPath: '' });
  renderPlanCreatorSteps();
};

function renderPlanCreatorSteps() {
  const container = document.getElementById('plan-steps-creator-list');
  if (!container) return;

  container.innerHTML = '';
  planCreatorSteps.forEach((step, idx) => {
    const stepDiv = document.createElement('div');
    stepDiv.style.display = 'flex';
    stepDiv.style.flexDirection = 'column';
    stepDiv.style.gap = '4px';
    stepDiv.style.background = 'rgba(255,255,255,0.02)';
    stepDiv.style.padding = '6px';
    stepDiv.style.borderRadius = '4px';
    stepDiv.style.border = '1px solid var(--border-light)';

    stepDiv.innerHTML = `
      <div style="display: flex; gap: 6px; align-items: center; justify-content: space-between;">
        <span style="font-size: 10px; font-weight: 600; color: var(--accent);">Passo ${idx + 1}</span>
        <button class="remove-attach" onclick="removeStepFromPlanCreator(${idx})" style="font-size: 10px; background: transparent; border: none; color: var(--color-text-danger); cursor: pointer;"><i class="ti ti-x"></i></button>
      </div>
      <div style="display: flex; gap: 6px;">
        <select onchange="updatePlanCreatorStepField(${idx}, 'type', this.value)" style="height: 24px; font-size: 10px; flex: 1;">
          <option value="command" ${step.type === 'command' ? 'selected' : ''}>Rodar Comando Shell</option>
          <option value="write_file" ${step.type === 'write_file' ? 'selected' : ''}>Escrever Arquivo</option>
          <option value="read_file" ${step.type === 'read_file' ? 'selected' : ''}>Ler Arquivo</option>
          <option value="validate" ${step.type === 'validate' ? 'selected' : ''}>Validar Arquivo</option>
        </select>
        <input type="text" placeholder="Caminho do Arquivo (Opcional)" value="${step.targetPath}" oninput="updatePlanCreatorStepField(${idx}, 'targetPath', this.value)" style="height: 24px; font-size: 10px; flex: 1.5; display: ${step.type === 'command' ? 'none' : 'block'};">
      </div>
      <input type="text" placeholder="${step.type === 'command' ? 'Comando PowerShell...' : 'Conteúdo do arquivo...'}" value="${step.payload}" oninput="updatePlanCreatorStepField(${idx}, 'payload', this.value)" style="height: 24px; font-size: 10px;">
    `;
    container.appendChild(stepDiv);
  });
}

window.updatePlanCreatorStepField = function(idx, field, value) {
  if (planCreatorSteps[idx]) {
    planCreatorSteps[idx][field] = value;
    if (field === 'type') {
      renderPlanCreatorSteps(); // redraw to show/hide path field
    }
  }
};

window.removeStepFromPlanCreator = function(idx) {
  planCreatorSteps.splice(idx, 1);
  renderPlanCreatorSteps();
};

window.submitNewPlan = async function() {
  try {
    const titleInput = document.getElementById('plan-title-input');
    if (!titleInput || !titleInput.value.trim()) {
      alert('Por favor, informe a meta ou título do plano.');
      return;
    }

    const res = await fetch('/api/planner/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titleInput.value.trim(),
        steps: planCreatorSteps
      })
    });
    if (!res.ok) throw new Error('Create plan request failed');
    
    closeNewPlanModal();
    await loadPlannerPlans();
  } catch (e) {
    console.error('[Dashboard] Error creating plan:', e.message);
  }
};
