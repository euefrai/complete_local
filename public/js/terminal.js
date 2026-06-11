// Vexx AI Debate Arena — Terminal and System Action Executor
import { setInputDisabled } from './ui.js';

export function resolveAction(resultText) {
  window.collectedActionResults = window.collectedActionResults || [];
  window.collectedActionResults.push(resultText);
  
  if (window.pendingActionsCount > 0) {
    window.pendingActionsCount--;
    console.log(`[Pending Actions] Decremented count. Remaining: ${window.pendingActionsCount}`);
  }
  
  if (window.pendingActionsCount === 0) {
    const combinedResults = window.collectedActionResults.join('\n\n');
    window.collectedActionResults = [];
    window.isActionPendingApproval = false;
    console.log('[Pending Actions] All actions resolved. Resuming debate loop.');
    setTimeout(() => {
      if (typeof window.startDebate === 'function') {
        window.startDebate(combinedResults);
      } else {
        console.error('window.startDebate is not defined');
      }
    }, 1500);
  }
}

export async function executeSystemAction(actionId, type, data) {
  setInputDisabled(true);
  const resultBox = document.getElementById(`result-${actionId}`);
  const actionsBar = document.getElementById(`actions-bar-${actionId}`);
  
  if (actionsBar) {
    actionsBar.style.display = 'none';
  }
  
  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div class="dots-loader" style="margin: 5px 0;">
        <span></span><span></span><span></span>
      </div>
      <span style="font-size: 11px; color: var(--color-text-secondary);">Processando ação no PC...</span>
    `;
  }
  
  let endpoint = '';
  let body = {};
  
  if (type === 'execute') {
    endpoint = '/api/terminal/execute';
    body = { command: data.command };
  } else if (type === 'write') {
    endpoint = '/api/terminal/write-file';
    body = { filePath: data.filePath, content: data.content };
  } else if (type === 'read') {
    endpoint = '/api/terminal/read-file';
    body = { filePath: data.filePath };
  } else if (type === 'list') {
    endpoint = '/api/terminal/list-dir';
    body = { dirPath: data.dirPath };
  } else if (type === 'delete') {
    endpoint = '/api/terminal/delete';
    body = { targetPath: data.targetPath };
  } else if (type === 'move') {
    endpoint = '/api/terminal/move';
    body = { sourcePath: data.sourcePath, destPath: data.destPath };
  } else if (type === 'copy') {
    endpoint = '/api/terminal/copy';
    body = { sourcePath: data.sourcePath, destPath: data.destPath };
  } else if (type === 'find') {
    if (!data.dirPath) {
      endpoint = '/api/rag/search';
      body = { query: data.query, limit: 5 };
    } else {
      endpoint = '/api/terminal/find';
      body = { query: data.query, dirPath: data.dirPath };
    }
  } else if (type === 'schedule') {
    endpoint = '/api/scheduler/create';
    body = { time: data.time, type: data.taskType, payload: data.payload };
  } else if (type === 'notewrite') {
    endpoint = '/api/notes/write';
    body = { filename: data.filename, content: data.content, vaultPath: window.config?.obsidian_path || '' };
  } else if (type === 'noteread') {
    endpoint = '/api/notes/read';
    body = { filename: data.filename, vaultPath: window.config?.obsidian_path || '' };
  } else if (type === 'webfetch') {
    endpoint = '/api/web/fetch-page';
    body = { url: data.url };
  }
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const result = await res.json();
    
    if (!res.ok) {
      throw new Error(result.error || 'Erro na execução');
    }
    
    let formattedResult = '';
    let displayHtml = '';
    
    if (type === 'schedule') {
      formattedResult = `Tarefa agendada com sucesso! ID: ${result.task.id}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">Tarefa agendada com sucesso!</div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">Hora: <code>${result.task.time}</code></div>
      `;
      const activeTab = document.querySelector('.segment-btn.active');
      if (activeTab && activeTab.id === 'nav-brain') {
        setTimeout(() => {
          if (typeof window.loadSchedulerAndNotes === 'function') {
            window.loadSchedulerAndNotes();
          }
        }, 500);
      }
    } else if (type === 'notewrite') {
      formattedResult = `Nota "${result.filename}" salva com sucesso em: ${result.path}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">Nota salva com sucesso no Obsidian/Cérebro!</div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">Caminho: <code>${result.path}</code></div>
      `;
      const activeTab = document.querySelector('.segment-btn.active');
      if (activeTab && activeTab.id === 'nav-brain') {
        setTimeout(() => {
          if (typeof window.loadSchedulerAndNotes === 'function') {
            window.loadSchedulerAndNotes();
          }
        }, 500);
      }
    } else if (type === 'noteread') {
      formattedResult = `Nota "${result.filename}" lida com sucesso.\nConteúdo:\n${result.content}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px; margin-bottom: 4px;">Conteúdo da nota lido:</div>
        <pre><code class="markdown">${result.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      `;
    } else if (type === 'webfetch') {
      formattedResult = `Página da web lida: "${result.title}" (URL: ${result.url})\nConteúdo extraído:\n${result.content}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px; margin-bottom: 4px;">Página lida com sucesso: "${result.title}"</div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-bottom: 6px;">URL: <code style="word-break: break-all;">${result.url}</code></div>
        <pre><code class="plaintext">${result.content.slice(0, 500).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}...</code></pre>
      `;
    } else if (type === 'execute') {
      formattedResult = `Comando: ${data.command}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}\ncode: ${result.code}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px; margin-bottom: 4px;">Executado com sucesso!</div>
        ${result.stdout ? `<pre><code class="bash">${result.stdout.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>` : ''}
        ${result.stderr ? `<pre><code style="color: var(--color-text-danger);">${result.stderr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>` : ''}
      `;
    } else if (type === 'write') {
      formattedResult = `Arquivo gravado com sucesso em: ${result.path}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">Arquivo gravado com sucesso!</div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">Caminho: <code>${result.path}</code></div>
      `;
    } else if (type === 'read') {
      formattedResult = `Leitura de arquivo: ${result.path}\nConteúdo:\n${result.content}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px; margin-bottom: 4px;">Conteúdo lido com sucesso:</div>
        <pre><code>${result.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      `;
    } else if (type === 'list') {
      formattedResult = `Listagem de pasta: ${result.path}\nItens:\n` + result.items.map(item => `- [${item.isDirectory ? 'PASTA' : 'ARQUIVO'}] ${item.name}`).join('\n');
      
      let itemsHtml = '<ul style="margin: 4px 0 0 16px; padding: 0; font-size: 11px;">';
      result.items.forEach(item => {
        const icon = item.isDirectory ? '📁' : '📄';
        itemsHtml += `<li style="list-style: none; margin-bottom: 2px;">${icon} ${item.name}</li>`;
      });
      itemsHtml += '</ul>';
      
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">Itens listados (${result.items.length}):</div>
        ${itemsHtml}
      `;
    } else if (type === 'delete') {
      formattedResult = `Excluído com sucesso: ${result.path}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">Excluído com sucesso!</div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">Alvo: <code>${result.path}</code></div>
      `;
    } else if (type === 'move') {
      formattedResult = `Movido/Renomeado com sucesso: ${result.from} -> ${result.to}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">Movido com sucesso!</div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">De: <code>${result.from}</code></div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">Para: <code>${result.to}</code></div>
      `;
    } else if (type === 'copy') {
      formattedResult = `Copiado com sucesso: ${result.from} -> ${result.to}`;
      displayHtml = `
        <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">Copiado com sucesso!</div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">De: <code>${result.from}</code></div>
        <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">Para: <code>${result.to}</code></div>
      `;
    } else if (type === 'find') {
      const isRag = result.results && result.results.length > 0 && result.results[0].content !== undefined;
      
      if (isRag) {
        formattedResult = `Busca semântica no RAG por "${result.query}":\n` + 
          result.results.map(r => `[Trecho de ${r.path}]:\n${r.content}`).join('\n\n');
        
        let itemsHtml = '<div style="display: flex; flex-direction: column; gap: 8px; font-size: 11px; margin-top: 6px;">';
        result.results.forEach(r => {
          itemsHtml += `
            <div style="background: var(--bg-surface-alt); padding: 6px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
              <div style="font-weight: 600; color: var(--accent); margin-bottom: 2px;"><i class="ti ti-file"></i> ${r.filename} <span style="font-weight: normal; color: var(--text-tertiary);">(${r.path})</span></div>
              <pre style="margin: 0; padding: 4px; overflow: auto; max-height: 80px; font-size: 10px; font-family: var(--font-mono); background: #0f141c; color: #a5b4fc;"><code>${r.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
            </div>
          `;
        });
        itemsHtml += '</div>';

        displayHtml = `
          <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">RAG Busca concluída! Encontrados: ${result.results.length} trechos</div>
          ${itemsHtml}
        `;
      } else {
        formattedResult = `Busca de arquivos em: ${result.path} por "${result.query}"\nResultados (${result.results.length}):\n` + 
          result.results.map(file => `- ${file.Name} (Caminho: ${file.FullName}, Tamanho: ${file.Length} bytes)`).join('\n');
        
        let itemsHtml = '<ul style="margin: 4px 0 0 16px; padding: 0; font-size: 11px;">';
        if (result.results.length === 0) {
          itemsHtml += `<li style="list-style: none; color: var(--color-text-secondary);">Nenhum arquivo encontrado.</li>`;
        } else {
          result.results.forEach(file => {
            itemsHtml += `<li style="list-style: none; margin-bottom: 2px;">📄 <strong>${file.Name}</strong> <span style="color: var(--color-text-secondary); font-size: 10px;">(${file.FullName} - ${(file.Length / 1024).toFixed(1)} KB)</span></li>`;
          });
        }
        itemsHtml += '</ul>';
        
        displayHtml = `
          <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">Busca de arquivos concluída! Encontrados: ${result.results.length}</div>
          ${itemsHtml}
        `;
      }
    }
    
    if (resultBox) {
      resultBox.innerHTML = displayHtml;
    }
    
    const systemPromptText = `[RETORNO DO COMANDO EXECUTADO]:\n${formattedResult}`;
    resolveAction(systemPromptText);
    
  } catch (err) {
    if (resultBox) {
      resultBox.innerHTML = `
        <div style="font-weight: 600; color: var(--color-text-danger); font-size: 11px; margin-bottom: 4px;">Falha na execução:</div>
        <div style="font-size: 11px; color: var(--color-text-danger);">&nbsp;${err.message}</div>
      `;
    }
    
    resolveAction(`[FALHA NA EXECUÇÃO DO COMANDO]: ${err.message}`);
  }
}

export function rejectSystemAction(actionId) {
  setInputDisabled(true);
  const actionsBar = document.getElementById(`actions-bar-${actionId}`);
  const resultBox = document.getElementById(`result-${actionId}`);
  
  if (actionsBar) {
    actionsBar.style.display = 'none';
  }
  
  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div style="font-weight: 600; color: var(--color-text-secondary); font-size: 11px;">Execução rejeitada pelo usuário.</div>
    `;
  }
  
  resolveAction(`[AÇÃO REJEITADA PELO USUÁRIO]`);
}

export function toggleVisualMapStyle(mapId) {
  const viewport = document.getElementById(`viewport-${mapId}`);
  if (viewport) {
    if (viewport.classList.contains('blueprint-grid')) {
      viewport.classList.remove('blueprint-grid');
      viewport.classList.add('clean-style');
    } else {
      viewport.classList.remove('clean-style');
      viewport.classList.add('blueprint-grid');
    }
  }
}

export function copyVisualMapAscii(mapId) {
  const codeEl = document.querySelector(`#viewport-${mapId} .ascii-content code`);
  if (codeEl) {
    navigator.clipboard.writeText(codeEl.textContent)
      .then(() => {
        alert('Copiado para a área de transferência!');
      })
      .catch(err => {
        console.error('Falha ao copiar:', err);
      });
  }
}

export function approveSuggestion(actionId, data) {
  setInputDisabled(true);
  const actionsBar = document.getElementById(`actions-bar-${actionId}`);
  const resultBox = document.getElementById(`result-${actionId}`);
  
  if (actionsBar) {
    actionsBar.style.display = 'none';
  }
  
  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div style="font-weight: 600; color: var(--color-text-success); font-size: 11px;">
        <i class="ti ti-check" style="margin-right: 4px;"></i>Sugestão aprovada! A IA irá executar a melhoria.
      </div>
    `;
  }
  
  const approvalText = `[SUGESTÃO APROVADA PELO USUÁRIO]: O usuário aprovou a sugestão "${data.title}". Descrição da sugestão: ${data.description}. Por favor, execute as ações necessárias para implementar esta melhoria usando os blocos XML apropriados (<terminal_execute>, <file_write>, <file_read>, <dir_list>, <file_move>, <file_copy>, <file_delete>).`;
  resolveAction(approvalText);
}

// Expose functions globally for inline HTML event handlers
window.executeSystemAction = executeSystemAction;
window.rejectSystemAction = rejectSystemAction;
window.resolveAction = resolveAction;
window.toggleVisualMapStyle = toggleVisualMapStyle;
window.copyVisualMapAscii = copyVisualMapAscii;
window.approveSuggestion = approveSuggestion;
