const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getBrasiliaISOString } = require('../lib/timezone');

const DATA_DIR = path.resolve(__dirname, '../data');
const GRAPH_FILE = path.join(DATA_DIR, 'knowledge_graph.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read graph
function readGraph() {
  try {
    if (fs.existsSync(GRAPH_FILE)) {
      const data = fs.readFileSync(GRAPH_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Knowledge] Error reading graph file:', e.message);
  }
  return { nodes: [], relations: [] };
}

// Helper to save graph
function saveGraph(graph) {
  try {
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Knowledge] Error writing graph file:', e.message);
    return false;
  }
}

// 1. Get graph
router.get('/api/knowledge/graph', (req, res) => {
  try {
    const graph = readGraph();
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar o grafo de conhecimento.', details: err.message });
  }
});

// 2. Add or update node
router.post('/api/knowledge/node', (req, res) => {
  try {
    const { id, label, type, properties } = req.body;
    if (!id || !label) {
      return res.status(400).json({ error: 'ID e Label do nó são obrigatórios.' });
    }

    const graph = readGraph();
    const existingIndex = graph.nodes.findIndex(n => n.id === id);

    const node = {
      id,
      label,
      type: type || 'concept',
      properties: properties || {},
      updatedAt: getBrasiliaISOString()
    };

    if (existingIndex !== -1) {
      graph.nodes[existingIndex] = { ...graph.nodes[existingIndex], ...node };
    } else {
      graph.nodes.push(node);
    }

    if (saveGraph(graph)) {
      res.json({ success: true, node });
    } else {
      res.status(500).json({ error: 'Falha ao salvar o grafo no disco.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar o nó.', details: err.message });
  }
});

// 3. Add or update relation
router.post('/api/knowledge/relation', (req, res) => {
  try {
    const { from, to, type, properties } = req.body;
    if (!from || !to || !type) {
      return res.status(400).json({ error: 'Origem (from), destino (to) e tipo de relação são obrigatórios.' });
    }

    const graph = readGraph();
    
    // Ensure nodes exist, if not, create them implicitly
    if (!graph.nodes.some(n => n.id === from)) {
      graph.nodes.push({ id: from, label: path.basename(from), type: 'file', properties: {} });
    }
    if (!graph.nodes.some(n => n.id === to)) {
      graph.nodes.push({ id: to, label: path.basename(to), type: 'file', properties: {} });
    }

    const relId = `${from}_${to}_${type}`;
    const existingIndex = graph.relations.findIndex(r => r.id === relId);

    const relation = {
      id: relId,
      from,
      to,
      type,
      properties: properties || {}
    };

    if (existingIndex !== -1) {
      graph.relations[existingIndex] = relation;
    } else {
      graph.relations.push(relation);
    }

    if (saveGraph(graph)) {
      res.json({ success: true, relation });
    } else {
      res.status(500).json({ error: 'Falha ao salvar o grafo no disco.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar a relação.', details: err.message });
  }
});

// 4. Delete node or relation
router.post('/api/knowledge/delete', (req, res) => {
  try {
    const { nodeId, relationId } = req.body;
    const graph = readGraph();
    let deleted = false;

    if (nodeId) {
      graph.nodes = graph.nodes.filter(n => n.id !== nodeId);
      graph.relations = graph.relations.filter(r => r.from !== nodeId && r.to !== nodeId);
      deleted = true;
    } else if (relationId) {
      graph.relations = graph.relations.filter(r => r.id !== relationId);
      deleted = true;
    }

    if (!deleted) {
      return res.status(400).json({ error: 'Forneça nodeId ou relationId para exclusão.' });
    }

    if (saveGraph(graph)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Falha ao salvar o grafo no disco.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover elemento do grafo.', details: err.message });
  }
});

// 5. Automatic codebase scanner for graph generation
router.post('/api/knowledge/scan', (req, res) => {
  try {
    const projectRoot = path.resolve(__dirname, '..');
    const graph = { nodes: [], relations: [] };

    // Function to scan recursively
    function scanDir(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        // Exclude node_modules, .git, and data
        if (file.name === 'node_modules' || file.name === '.git' || file.name === 'data' || file.name === 'logs') {
          continue;
        }

        const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

        if (file.isDirectory()) {
          graph.nodes.push({
            id: relativePath,
            label: file.name,
            type: 'directory',
            properties: {}
          });
          scanDir(fullPath);
        } else if (file.isFile()) {
          const ext = path.extname(file.name);
          const allowedExts = ['.js', '.py', '.ts', '.html', '.css', '.json', '.md'];
          if (allowedExts.includes(ext)) {
            graph.nodes.push({
              id: relativePath,
              label: file.name,
              type: 'file',
              properties: { ext, size: fs.statSync(fullPath).size }
            });

            // Basic dependency check (only for js and json)
            if (ext === '.js') {
              try {
                const content = fs.readFileSync(fullPath, 'utf8');
                // Regex for require(...) or import ... from '...'
                const requireRegex = /require\(['"]\.\/([^'"]+)['"]\)/g;
                const importRegex = /import\s+.*\s+from\s+['"]\.\/([^'"]+)['"]/g;

                let match;
                while ((match = requireRegex.exec(content)) !== null) {
                  let target = match[1];
                  if (!path.extname(target)) target += '.js';
                  const targetRelPath = path.join(path.dirname(relativePath), target).replace(/\\/g, '/');
                  graph.relations.push({
                    id: `${relativePath}_${targetRelPath}_USES`,
                    from: relativePath,
                    to: targetRelPath,
                    type: 'USES',
                    properties: { parsed: 'require' }
                  });
                }

                while ((match = importRegex.exec(content)) !== null) {
                  let target = match[1];
                  if (!path.extname(target)) target += '.js';
                  const targetRelPath = path.join(path.dirname(relativePath), target).replace(/\\/g, '/');
                  graph.relations.push({
                    id: `${relativePath}_${targetRelPath}_USES`,
                    from: relativePath,
                    to: targetRelPath,
                    type: 'USES',
                    properties: { parsed: 'import' }
                  });
                }
              } catch (e) {
                // Ignore parser issues for individual files
              }
            }
          }
        }
      }
    }

    // Always add core node
    graph.nodes.push({ id: '.', label: 'wifa jl (Root)', type: 'directory', properties: {} });
    scanDir(projectRoot);

    // Filter relations where target node doesn't exist
    const nodeIds = new Set(graph.nodes.map(n => n.id));
    graph.relations = graph.relations.filter(r => nodeIds.has(r.from) && nodeIds.has(r.to));

    if (saveGraph(graph)) {
      res.json({ success: true, summary: { nodes: graph.nodes.length, relations: graph.relations.length }, graph });
    } else {
      res.status(500).json({ error: 'Falha ao salvar grafo escaneado.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao escanear o projeto.', details: err.message });
  }
});

module.exports = router;
