const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

// Scrape DuckDuckGo results without CORS restrictions
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

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
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to scrape search results', details: error.message });
  }
});

// Proxy Image Generation using AI Horde
app.get('/api/generate-image', async (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) {
    return res.status(400).send('Prompt is required');
  }

  console.log(`Generating image for prompt: "${prompt}" via AI Horde...`);

  try {
    // 1. Submit request to AI Horde
    const hordeRes = await fetch('https://stablehorde.net/api/v2/generate/async', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': '0000000000', // Anonymous key
        'Client-Agent': 'vexx-arena:1.0:user'
      },
      body: JSON.stringify({
        prompt: prompt,
        params: {
          width: 512,
          height: 512,
          steps: 20,
          n: 1
        },
        models: ["Juggernaut XL", "SDXL 1.0", "stable_diffusion"],
        nsfw: true
      })
    });

    if (!hordeRes.ok) {
      const errText = await hordeRes.text();
      throw new Error(`AI Horde submit failed: ${hordeRes.status} - ${errText}`);
    }

    const hordeData = await hordeRes.json();
    const jobId = hordeData.id;
    if (!jobId) {
      throw new Error('AI Horde did not return a Job ID');
    }

    console.log(`AI Horde Job ID: ${jobId}. Polling status...`);

    // 2. Poll status (max 45 seconds)
    let done = false;
    let imgUrl = '';
    
    for (let i = 0; i < 22; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const checkRes = await fetch(`https://stablehorde.net/api/v2/generate/check/${jobId}`, {
        headers: { 'Client-Agent': 'vexx-arena:1.0:user' }
      });
      if (!checkRes.ok) continue;
      
      const checkData = await checkRes.json();
      console.log(`Polling job ${jobId} (attempt ${i + 1}): done=${checkData.done}`);
      
      if (checkData.done) {
        const statusRes = await fetch(`https://stablehorde.net/api/v2/generate/status/${jobId}`, {
          headers: { 'Client-Agent': 'vexx-arena:1.0:user' }
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.generations && statusData.generations.length > 0) {
            imgUrl = statusData.generations[0].img;
            done = true;
            break;
          }
        }
      }
    }

    if (!done || !imgUrl) {
      throw new Error('Image generation timed out or failed on AI Horde');
    }

    console.log(`Image generated successfully! URL: ${imgUrl}. Proxying buffer to client...`);

    // 3. Fetch image and send buffer back
    const imgFetch = await fetch(imgUrl);
    if (!imgFetch.ok) {
      return res.redirect(imgUrl);
    }

    res.setHeader('Content-Type', imgFetch.headers.get('Content-Type') || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    const arrayBuffer = await imgFetch.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));

  } catch (error) {
    console.error('Image generation proxy error:', error);
    res.status(500).send(`Failed to generate image: ${error.message}`);
  }
});

// Proxy Chat Request
app.post('/api/chat', async (req, res) => {
  const { provider, model, messages, temperature, max_tokens, apiKey } = req.body;

  if (!provider) {
    return res.status(400).json({ error: 'Provider is required' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  // Parse types to ensure type safety with external APIs
  const maxTokensNum = parseInt(max_tokens, 10) || 2048;
  const tempNum = temperature !== undefined ? parseFloat(temperature) : 0.7;

  try {
    let url = '';
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    switch (provider.toLowerCase()) {
      case 'gemini': {
        // Google AI Studio API format
        // Default models: gemini-1.5-flash, gemini-2.5-flash
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
        
        // Map OpenAI-style messages to Gemini format
        const contents = messages.map(msg => {
          let role = msg.role;
          if (role === 'system') {
            // Gemini expects system instructions in systemInstruction parameter, not contents
            return null;
          }
          if (role === 'assistant') role = 'model';
          
          let parts = [];
          if (typeof msg.content === 'string') {
            parts.push({ text: msg.content });
          } else if (Array.isArray(msg.content)) {
            // Handle multimodal content (text and images)
            for (const contentPart of msg.content) {
              if (contentPart.type === 'text') {
                parts.push({ text: contentPart.text });
              } else if (contentPart.type === 'image_url') {
                const imgData = contentPart.image_url.url;
                // Parse base64 data
                const match = imgData.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                  parts.push({
                    inlineData: {
                      mimeType: match[1],
                      data: match[2]
                    }
                  });
                }
              }
            }
          }

          return { role, parts };
        }).filter(Boolean);

        const systemMessage = messages.find(msg => msg.role === 'system');
        const systemInstruction = systemMessage ? {
          parts: [{ text: systemMessage.content }]
        } : undefined;

        body = {
          contents,
          systemInstruction,
          generationConfig: {
            temperature: tempNum,
            maxOutputTokens: maxTokensNum
          }
        };
        break;
      }
      case 'groq': {
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        
        body = {
          model: model || 'llama-3.3-70b-versatile',
          messages,
          temperature: tempNum,
          max_tokens: maxTokensNum
        };
        break;
      }
      case 'openai': {
        url = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;

        body = {
          model: model || 'gpt-4o-mini',
          messages,
          temperature: tempNum,
          max_tokens: maxTokensNum
        };
        break;
      }
      case 'openrouter': {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = 'http://localhost:3000';
        headers['X-Title'] = 'Vexx AI Debate Arena';

        body = {
          model: model || 'openrouter/free',
          messages,
          temperature: tempNum,
          max_tokens: maxTokensNum
        };
        break;
      }
      case 'huggingface':
      case 'huggingface2': {
        url = 'https://router.huggingface.co/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;

        body = {
          model: model || 'Qwen/Qwen2.5-72B-Instruct',
          messages,
          temperature: tempNum,
          max_tokens: maxTokensNum
        };
        break;
      }
      default:
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const responseData = await response.json();

    if (!response.ok) {
      let errMsg = responseData.error?.message || responseData.error || JSON.stringify(responseData);
      console.error(`Provider ${provider} error:`, errMsg);
      return res.status(response.status).json({
        error: `Erro no provedor ${provider}: ${errMsg}`,
        details: responseData
      });
    }

    // Standardize Output back to frontend
    // Gemini output mapping
    if (provider.toLowerCase() === 'gemini') {
      try {
        const text = responseData.candidates[0].content.parts[0].text;
        return res.json({
          choices: [
            {
              message: {
                role: 'assistant',
                content: text
              }
            }
          ]
        });
      } catch (e) {
        return res.status(502).json({
          error: 'Failed to parse Gemini response structure',
          details: responseData
        });
      }
    }

    // Groq, OpenAI, and OpenRouter output is already in OpenAI standard format
    res.json(responseData);

  } catch (error) {
    console.error('Chat proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Vexx AI Debate Arena running at http://localhost:${PORT}`);
});
