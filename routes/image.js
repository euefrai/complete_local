const express = require('express');
const router = express.Router();

// Proxy Image Generation using AI Horde
router.get('/api/generate-image', async (req, res) => {
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

module.exports = router;
