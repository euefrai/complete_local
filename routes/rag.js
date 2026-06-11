const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getBrasiliaISOString } = require('../lib/timezone');

const DATA_DIR = path.resolve(__dirname, '../data');
const RAG_FILE = path.join(DATA_DIR, 'rag_index.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Tokenize text helper
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u00FF]/g, ' ') // support accents
    .split(/\s+/)
    .filter(t => t.length > 2); // filter short words
}

// Load RAG index
function loadIndex() {
  try {
    if (fs.existsSync(RAG_FILE)) {
      const data = fs.readFileSync(RAG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[RAG] Error reading index file:', e.message);
  }
  return { documents: [], chunks: [], docCount: 0 };
}

// Save RAG index
function saveIndex(index) {
  try {
    fs.writeFileSync(RAG_FILE, JSON.stringify(index, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[RAG] Error writing index file:', e.message);
    return false;
  }
}

// Chunking function
function chunkText(text, filename, relPath, chunkSize = 600, overlap = 150) {
  const chunks = [];
  let index = 0;
  let chunkCount = 0;

  while (index < text.length) {
    const end = Math.min(index + chunkSize, text.length);
    let chunkContent = text.substring(index, end);
    
    // Create chunk metadata
    chunks.push({
      id: `${relPath}_c${chunkCount}`,
      path: relPath,
      filename: filename,
      content: chunkContent,
      tokens: tokenize(chunkContent),
      startChar: index,
      endChar: end
    });

    chunkCount++;
    index += (chunkSize - overlap);
    if (index >= text.length - 50) break; // avoid tiny trailing chunks
  }
  return chunks;
}

// 1. Index workspace files
router.post('/api/rag/index', async (req, res) => {
  try {
    const projectRoot = path.resolve(__dirname, '..');
    const { dirPath, chunkSize, overlap } = req.body;
    
    const targetDir = dirPath ? (path.isAbsolute(dirPath) ? dirPath : path.resolve(projectRoot, dirPath)) : projectRoot;
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: 'Diretório não encontrado', path: targetDir });
    }

    const cSize = parseInt(chunkSize, 10) || 600;
    const oLap = parseInt(overlap, 10) || 150;

    const documents = [];
    let allChunks = [];

    // Recursive directory reader
    function scanAndIndex(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.name === 'node_modules' || file.name === '.git' || file.name === 'data' || file.name === 'logs') {
          continue;
        }

        const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

        if (file.isDirectory()) {
          scanAndIndex(fullPath);
        } else if (file.isFile()) {
          const ext = path.extname(file.name);
          const allowedExts = ['.js', '.py', '.ts', '.html', '.css', '.json', '.md', '.txt'];
          if (allowedExts.includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              if (content.trim().length === 0) continue;

              documents.push({
                path: relativePath,
                filename: file.name,
                length: content.length
              });

              const fileChunks = chunkText(content, file.name, relativePath, cSize, oLap);
              allChunks = allChunks.concat(fileChunks);
            } catch (err) {
              console.warn(`[RAG] Failed to read ${relativePath}:`, err.message);
            }
          }
        }
      }
    }

    scanAndIndex(targetDir);

    // Compute simple DF (Document Frequency) for TF-IDF calculations
    const df = {};
    allChunks.forEach(chunk => {
      const uniqueTokens = new Set(chunk.tokens);
      uniqueTokens.forEach(token => {
        df[token] = (df[token] || 0) + 1;
      });
    });

    const indexData = {
      indexedAt: getBrasiliaISOString(),
      dirPath: targetDir,
      docCount: documents.length,
      chunkCount: allChunks.length,
      documents,
      chunks: allChunks.map(c => ({
        id: c.id,
        path: c.path,
        filename: c.filename,
        content: c.content,
        tokens: c.tokens,
        startChar: c.startChar,
        endChar: c.endChar
      })),
      df
    };

    if (saveIndex(indexData)) {
      res.json({
        success: true,
        summary: {
          documents: documents.length,
          chunks: allChunks.length
        }
      });
    } else {
      res.status(500).json({ error: 'Falha ao salvar índice no disco.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar índice RAG.', details: err.message });
  }
});

// 2. Search RAG
router.post('/api/rag/search', (req, res) => {
  try {
    const { query, limit } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query parameter is required' });
    }

    const maxResults = parseInt(limit, 10) || 5;
    const index = loadIndex();

    if (index.chunks.length === 0) {
      return res.json({ results: [], info: 'Índice vazio. Execute a indexação primeiro.' });
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return res.json({ results: [] });
    }

    const N = index.chunkCount;
    const results = [];

    index.chunks.forEach(chunk => {
      let score = 0;
      const tf = {};
      
      // Calculate token frequencies in chunk
      chunk.tokens.forEach(t => {
        tf[t] = (tf[t] || 0) + 1;
      });

      queryTokens.forEach(token => {
        if (tf[token]) {
          const docFreq = index.df[token] || 1;
          const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
          const tfVal = tf[token] / chunk.tokens.length;
          
          // Basic BM25-like scoring
          score += tfVal * idf;
        }
      });

      // Bonus for exact word sequence matching or term clustering
      const lowerContent = chunk.content.toLowerCase();
      if (lowerContent.includes(query.toLowerCase())) {
        score += 1.5;
      }

      if (score > 0) {
        results.push({
          score,
          path: chunk.path,
          filename: chunk.filename,
          content: chunk.content,
          startChar: chunk.startChar,
          endChar: chunk.endChar
        });
      }
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    res.json({
      query,
      results: results.slice(0, maxResults)
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar no RAG.', details: err.message });
  }
});

// 3. Status of index
router.get('/api/rag/status', (req, res) => {
  try {
    const index = loadIndex();
    res.json({
      indexed: index.indexedAt ? true : false,
      indexedAt: index.indexedAt || null,
      dirPath: index.dirPath || null,
      docCount: index.docCount || 0,
      chunkCount: index.chunkCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter status do RAG.', details: err.message });
  }
});

module.exports = router;
