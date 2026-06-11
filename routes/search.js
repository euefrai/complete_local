const express = require('express');
const router = express.Router();

const API_TIMEOUT_MS = 30000;

// Helper to strip HTML tags from strings
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

// Helper to decode DuckDuckGo redirected URLs
function decodeDdgUrl(urlStr) {
  try {
    if (urlStr.includes('uddg=')) {
      const parts = urlStr.split('?');
      if (parts.length > 1) {
        const params = new URLSearchParams(parts[1]);
        const uddg = params.get('uddg');
        if (uddg) return decodeURIComponent(uddg);
      }
    }
    if (urlStr.startsWith('//')) {
      return 'https:' + urlStr;
    }
    return urlStr;
  } catch (e) {
    return urlStr;
  }
}

// Helper to sanitize HTML to plain text
function htmlToPlainText(html) {
  if (!html) return '';
  
  // Remove scripts, styles, head, iframes, SVGs, noscript, comments
  let cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
    
  // Replace layout blocks with newlines
  cleanHtml = cleanHtml
    .replace(/<\/div>|<\/p>|<\/li>|<\/tr>|<\/h[1-6]>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
    
  // Strip tags
  let text = cleanHtml.replace(/<[^>]+>/g, ' ');
  
  // Decode standard HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Decode numeric HTML entities (decimal and hex)
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    
  // Normalize spacing
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n+/g, '\n\n');
  
  return text.trim();
}

// Helper to extract the main content container from page HTML (e.g. lyrics div, article, main)
function extractMainContent(html) {
  if (!html) return '';

  // 1. Check for Genius Lyrics containers (multiple containers exist, combine them)
  if (html.includes('data-lyrics-container')) {
    const geniusRegex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
    let matches = [];
    let match;
    geniusRegex.lastIndex = 0;
    while ((match = geniusRegex.exec(html)) !== null) {
      matches.push(match[1]);
    }
    if (matches.length > 0) {
      return matches.join('\n');
    }
  }
  
  // 2. Check for Letras.mus.br main lyrics area
  const letrasRegex = /<div[^>]*class="[^\"]*(?:cnt-letra|lyric-content)[^\"]*"[^>]*>([\s\S]*?)<\/div>/i;
  const letrasMatch = html.match(letrasRegex);
  if (letrasMatch) {
    return letrasMatch[1];
  }
  
  // 3. Check for Vagalume main lyrics area
  const vagalumeRegex = /<div[^>]*id="lyrics"[^>]*>([\s\S]*?)<\/div>/i;
  const vagalumeMatch = html.match(vagalumeRegex);
  if (vagalumeMatch) {
    return vagalumeMatch[1];
  }

  // 4. Check for generic article container
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/i;
  const articleMatch = html.match(articleRegex);
  if (articleMatch) {
    return articleMatch[1];
  }

  // 5. Check for generic main container
  const mainRegex = /<main[^>]*>([\s\S]*?)<\/main>/i;
  const mainMatch = html.match(mainRegex);
  if (mainMatch) {
    return mainMatch[1];
  }

  // Fallback to body tag
  const bodyRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
  const bodyMatch = html.match(bodyRegex);
  if (bodyMatch) {
    return bodyMatch[1];
  }

  return html;
}

// Scrape DuckDuckGo results without CORS restrictions
router.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned status ${response.status}`);
    }

    const html = await response.text();
    const results = [];
    
    // Split the HTML by results
    const resultsBlockRegex = /<div class="[^"]*results_links_deep[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    const blocks = html.match(resultsBlockRegex) || [];

    const urlTitleRegex = /<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

    for (const block of blocks) {
      const urlTitleMatch = block.match(urlTitleRegex);
      const snippetMatch = block.match(snippetRegex);

      if (urlTitleMatch) {
        let link = urlTitleMatch[1];
        let title = stripHtml(urlTitleMatch[2]);
        let snippet = snippetMatch ? stripHtml(snippetMatch[1]) : '';

        link = decodeDdgUrl(link);

        if (title && link) {
          results.push({ title, url: link, snippet });
        }
      }
      // Limit to top 5 results for concise prompt insertion
      if (results.length >= 5) break;
    }

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error.name === 'AbortError' ? 'Request timed out' : error.message);
    const statusCode = error.name === 'AbortError' ? 504 : 500;
    res.status(statusCode).json({ error: 'Failed to scrape search results', details: error.message });
  }
});

// Proxy Web Scraper (Navegador Embutido)
router.all('/api/web/fetch-page', async (req, res) => {
  const targetUrl = req.method === 'POST' ? req.body.url : req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Parâmetro url é obrigatório.' });
  }

  try {
    console.log(`[Web Scraper] Buscando URL: ${targetUrl}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Servidor retornou status ${response.status}`);
    }

    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : 'Página da Web';
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    
    // Extract only the main content (e.g. lyrics container)
    const mainHtml = extractMainContent(html);
    let plainText = htmlToPlainText(mainHtml);
    const originalLength = plainText.length;
    
    // Truncate to 10000 chars to save context tokens
    if (plainText.length > 10000) {
      plainText = plainText.slice(0, 10000) + '\n\n... [Conteúdo truncado pelo sistema para evitar estouro de tokens] ...';
    }

    res.json({
      success: true,
      title,
      url: targetUrl,
      content: plainText,
      truncated: originalLength > 10000
    });

  } catch (error) {
    console.error(`[Web Scraper] Erro ao buscar URL ${targetUrl}:`, error.message);
    res.status(500).json({
      error: 'Falha ao obter conteúdo da página',
      details: error.message
    });
  }
});

module.exports = router;
