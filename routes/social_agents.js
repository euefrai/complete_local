const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../lib/auth');
const { detectPromptInjection } = require('../lib/validators');
const memoryManager = require('../lib/memory/index');
const { asyncHandler } = require('../lib/self_healing');

const DATA_DIR = path.resolve(__dirname, '../data');
const MEMORY_FILE = path.join(DATA_DIR, 'db_social_memory.json');
const POSTS_DB = path.join(DATA_DIR, 'db_instagram_media.json');

// Helper to make local API call to chat route
async function callLocalChat(messages, model = 'gpt-4o-mini', provider = 'openai') {
  const PORT = process.env.PORT || 3000;
  const url = `http://localhost:${PORT}/api/chat`;
  
  try {
    const payload = {
      provider,
      model,
      temperature: 0.7,
      messages
    };
    
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Chat API failed: ${text}`);
    }
    
    const data = await r.json();
    return data.choices?.[0]?.message?.content || data.raw || '';
  } catch (e) {
    console.error('[Social Agents] callLocalChat error:', e.message);
    return `[Erro na IA] Não foi possível obter resposta: ${e.message}`;
  }
}

// Helpers for Memory
function loadSocialMemory() {
  if (!fs.existsSync(MEMORY_FILE)) {
    const defaultMemory = {
      niche: "Inteligência Artificial, Automação de Processos, RPA e Produtividade",
      audience: "Empreendedores de tecnologia, desenvolvedores, gestores de marketing e criadores digitais (25-45 anos)",
      writing_style: "Direto, inovador, informativo, premium, sem jargões corporativos vazios e com poucos emojis.",
      past_learnings: [
        "Carrosséis técnicos explicando arquiteturas em camadas geram 40% mais salvamentos.",
        "Reels rápidos demonstrando automações visuais em tempo real têm 3x mais alcance.",
        "Stories abrindo caixas de perguntas com tom resolutivo aumentam cliques no link da bio."
      ],
      competitors: ["@tiago.forte", "@neuroflow", "@browseruse"],
      historical_engagement_rate: 14.6
    };
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(defaultMemory, null, 2), 'utf8');
    return defaultMemory;
  }
  
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveSocialMemory(memory) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// 1. GET & POST Social Memory
router.get('/api/social/memory', verifyToken, (req, res) => {
  res.json(loadSocialMemory());
});

router.post('/api/social/memory', verifyToken, (req, res) => {
  const memory = req.body || {};
  if (saveSocialMemory(memory)) {
    res.json({ success: true, memory });
  } else {
    res.status(500).json({ error: 'Erro ao salvar a memória social.' });
  }
});

// 2. Social Media Manager Agent: Planejamento
router.post('/api/social/agent/manage', verifyToken, asyncHandler(async (req, res) => {
  const { type } = req.body || {}; // weekly or monthly
  
  const guard = detectPromptInjection(type);
  if (!guard.safe) {
    return res.status(400).json({ error: guard.reason });
  }

  const memory = loadSocialMemory();
  const semanticResults = memoryManager.searchSemantic(`Planejamento de conteúdo ${type || 'semanal'}`, 3);
  const semanticContext = semanticResults.map(r => r.text).join('\n');
  
  const systemPrompt = `Você é o Diretor de Marketing Digital, Estrategista de Conteúdo e Gestor de Redes Sociais do VEXX OS.
Seu objetivo é planejar estratégias de crescimento e calendários de publicações para o Instagram.
Considere as preferências do nicho e estilo do usuário:
- Nicho: ${memory.niche}
- Público: ${memory.audience}
- Estilo: ${memory.writing_style}
- Aprendizados anteriores: ${memory.past_learnings.join(' | ')}

Contexto Semântico de Memorias Relacionadas:
${semanticContext}`;

  const userPrompt = `Gere um planejamento de conteúdo do tipo "${type || 'semanal'}" para o Instagram.
Inclua:
1. Um calendário de postagens (indicando dia, formato - Reels/Stories/Carrossel, e tema).
2. Um tática de crescimento viral para esta semana baseada no nicho.
3. Sugestões de hashtags e CTA recomendados para as postagens.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const result = await callLocalChat(messages);
  res.json({ success: true, output: result });
}));

// 3. Content Creator Agent: Criação de Post
router.post('/api/social/agent/create', verifyToken, asyncHandler(async (req, res) => {
  const { format, theme } = req.body || {};
  
  const guardFormat = detectPromptInjection(format);
  const guardTheme = detectPromptInjection(theme);
  if (!guardFormat.safe) return res.status(400).json({ error: guardFormat.reason });
  if (!guardTheme.safe) return res.status(400).json({ error: guardTheme.reason });

  const memory = loadSocialMemory();
  const semanticResults = memoryManager.searchSemantic(theme || 'Criação de post', 3);
  const semanticContext = semanticResults.map(r => r.text).join('\n');

  const systemPrompt = `Você é o Content Creator do VEXX OS, especialista em criação de Reels, Stories e Carrosséis.
Crie um conteúdo alinhado ao nicho e estilo:
- Nicho: ${memory.niche}
- Estilo: ${memory.writing_style}

Contexto Semântico de Memorias Relacionadas:
${semanticContext}`;

  const userPrompt = `Gere um roteiro completo de publicação.
Formato: ${format || 'Reels'}
Tema: ${theme || 'Como criar um agente autônomo local'}

Retorne:
1. [ROTEIRO/LEGENDA]: Um texto persuasivo estruturado com Hook forte, Desenvolvimento e CTA clara.
2. [HASHTAGS]: 5 a 10 hashtags relevantes.
3. [STORIES BRIDGE]: Sugestão de 2 Stories para engajar e direcionar o tráfego para essa postagem.
4. [PROMPT DE IMAGEM IA]: Um prompt detalhado em inglês para gerar a imagem de capa por IA (formatado como [PROMPT] "descrição...").`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const result = await callLocalChat(messages);
  res.json({ success: true, output: result });
}));

// 4. Viral Analyzer Agent: Pontuação 0-100
router.post('/api/social/viral-analyzer', verifyToken, asyncHandler(async (req, res) => {
  const { content } = req.body || {};
  if (!content) {
    return res.status(400).json({ error: 'O parâmetro content é obrigatório.' });
  }

  const guard = detectPromptInjection(content);
  if (!guard.safe) return res.status(400).json({ error: guard.reason });

  const memory = loadSocialMemory();

  const systemPrompt = `Você é o Viral Analyzer do VEXX OS.
Sua função é ler um texto ou legenda de mídias sociais e atribuir uma pontuação de 0 a 100 baseada em 5 pilares:
- Hook (Gancho inicial)
- Retenção (Fluidez e interesse)
- Curiosidade (Gatilhos de mistério/valor)
- CTA (Força da chamada de ação)
- Emoção (Conexão emocional)

Nichos e Estilo do Usuário:
- Nicho: ${memory.niche}
- Estilo de Escrita: ${memory.writing_style}

Retorne estritamente um objeto JSON estruturado contendo a pontuação de cada pilar e recomendações de melhorias.`;

  const userPrompt = `Analise a seguinte legenda/post:
"${content}"

Retorne EXATAMENTE no formato JSON:
{
  "score": 85,
  "breakdown": {
    "hook": 90,
    "retention": 80,
    "curiosity": 85,
    "cta": 75,
    "emotion": 95
  },
  "feedback": "...",
  "recommendations": ["melhorar o CTA adicionando senso de urgência", "usar ganchos mais visuais"]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${userPrompt}\nNota: Retorne apenas o JSON puro, sem marcações markdown de código \`\`\`json.` }
  ];

  let resultText = await callLocalChat(messages);
  
  // Clean markdown JSON ticks if LLM ignores instruction
  resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    const analysis = JSON.parse(resultText);
    res.json({ success: true, analysis });
  } catch (err) {
    // Return standard analysis if JSON parse failed
    res.json({
      success: true,
      analysis: {
        score: 75,
        breakdown: { hook: 75, retention: 75, curiosity: 75, cta: 70, emotion: 80 },
        feedback: "Análise processada. Detalhes:\n" + resultText,
        recommendations: ["Ajustar clareza da proposta", "Melhorar estrutura de formatação"]
      }
    });
  }
}));

// 5. Trend Engine Agent
router.get('/api/social/trends', verifyToken, asyncHandler(async (req, res) => {
  const memory = loadSocialMemory();

  const systemPrompt = `Você é o Trend Analyzer do VEXX OS.
Identifique tendências de tópicos, áudios e hashtags em alta no momento.
Foque no nicho: ${memory.niche}.`;

  const userPrompt = `Retorne:
1. 3 Temas/Tópicos virais de tecnologia/IA que estão em alta nas últimas 24 horas.
2. 3 Sugestões de styles de áudio (tipo de música ou batida) recomendadas para posts premium de tecnologia.
3. 10 hashtags virais recomendadas para o nicho.
4. 3 ideias rápidas de posts baseados nos concorrentes: ${memory.competitors.join(', ')}.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const result = await callLocalChat(messages);
  res.json({ success: true, output: result });
}));

// 6. Post Optimizer Agent (Legenda e Horários)
router.post('/api/social/post-optimizer', verifyToken, asyncHandler(async (req, res) => {
  const { caption } = req.body || {};
  
  const guard = detectPromptInjection(caption);
  if (!guard.safe) return res.status(400).json({ error: guard.reason });

  const memory = loadSocialMemory();

  const systemPrompt = `Você é o Post Optimizer do VEXX OS.
Analise a estrutura do texto, tamanho, legibilidade, apelo do CTA e recomende os melhores horários de postagem com base nas melhores práticas do nicho:
- Nicho: ${memory.niche}
- Público: ${memory.audience}`;

  const userPrompt = `Otimize a seguinte legenda de post:
"${caption || ''}"

Retorne:
1. A versão otimizada da legenda (melhorada para legibilidade e impacto).
2. Avaliação de estrutura (tamanho ideal, espaçamento).
3. 3 Horários de pico sugeridos para postar (ex: 12h, 18h, 21h).`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const result = await callLocalChat(messages);
  res.json({ success: true, output: result });
}));

// 7. Auto Reply Agent: Comentários/DMs
router.post('/api/social/agent/reply', verifyToken, asyncHandler(async (req, res) => {
  const { type, contactUsername, text, postCaption } = req.body || {};
  
  const guardType = detectPromptInjection(type);
  const guardUser = detectPromptInjection(contactUsername);
  const guardText = detectPromptInjection(text);
  if (!guardType.safe || !guardUser.safe || !guardText.safe) {
    return res.status(400).json({ error: 'Filtro de segurança ativado contra Prompt Injection.' });
  }

  const memory = loadSocialMemory();
  const semanticResults = memoryManager.searchSemantic(text || 'Mensagem recebida', 3);
  const semanticContext = semanticResults.map(r => r.text).join('\n');

  const systemPrompt = `Você é o Auto Reply Agent do VEXX OS.
Gere uma resposta ideal, fluida e natural (em português brasileiro) para um contato.
Nicho da Conta: ${memory.niche}
Estilo de Conversação: ${memory.writing_style}

Contexto Semântico de Interações e Históricos:
${semanticContext}`;

  const userPrompt = `Tipo de entrada: ${type || 'comentário'}
Remetente: @${contactUsername || 'usuario'}
Texto recebido: "${text || ''}"
${postCaption ? `Legenda da postagem relacionada: "${postCaption}"` : ''}

Elabore uma resposta curta, inteligente e humanizada.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const result = await callLocalChat(messages);
  
  // Salva no banco de interações da memória de 3 camadas
  if (contactUsername && text && result && !result.includes('[Erro na IA]')) {
    memoryManager.recordInteraction(contactUsername, text, result);
  }

  res.json({ success: true, output: result });
}));

// 8. Self Improvement Loop
router.post('/api/social/self-improvement', verifyToken, asyncHandler(async (req, res) => {
  const memory = loadSocialMemory();
  
  // Load actual posts database to see performance
  let posts = [];
  try {
    if (fs.existsSync(POSTS_DB)) {
      posts = JSON.parse(fs.readFileSync(POSTS_DB, 'utf8'));
    }
  } catch (e) {
    posts = [];
  }

  if (posts.length === 0) {
    return res.json({
      success: true,
      analysis: "Não há postagens suficientes publicadas no banco para realizar análise de melhoria contínua.",
      learnings: []
    });
  }

  // Compile posts performance for prompt
  let performanceSummary = "DESEMPENHO DOS POSTS RECENTES:\n";
  posts.slice(0, 5).forEach((p, idx) => {
    performanceSummary += `${idx+1}. Formato: ${p.media_type}, Likes: ${p.like_count}, Comentários: ${p.comments_count}, Alcance: ${p.insights?.reach || 'N/A'}\nLegenda: "${p.caption.substring(0, 100)}..."\n\n`;
  });

  const systemPrompt = `Você é o Cientista de Dados de Mídias Sociais e Agente de Auto-Melhoria (Self Improvement) do VEXX OS.
Seu objetivo é analisar as estatísticas das publicações recentes comparando com a média histórica (${memory.historical_engagement_rate}%), identificar gargalos/erros e sugerir novos aprendizados.`;

  const userPrompt = `${performanceSummary}
Com base nas métricas acima, identifique:
1. Quais formatos/temas perfomaram melhor (curtidas/alcance).
2. Padrões de erro (ex: legendas longas de mais, CTA fraco, hashtags redundantes).
3. 2 Novos aprendizados práticos a serem incorporados na nossa memória do sistema.
Retorne de forma estruturada.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const result = await callLocalChat(messages);

  // Automatically parse and inject new learnings to social memory
  // Simple extraction: look for bullet points in LLM response
  const lines = result.split('\n');
  const extractedLearnings = [];
  lines.forEach(line => {
    if (line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim())) {
      const clean = line.replace(/^[-*\d.\s]+/, '').trim();
      if (clean.length > 20 && clean.length < 150) {
        extractedLearnings.push(clean);
      }
    }
  });

  if (extractedLearnings.length > 0) {
    // Add top 2 extracted learnings to memory
    const topLearnings = extractedLearnings.slice(0, 2);
    memory.past_learnings = [...new Set([...memory.past_learnings, ...topLearnings])].slice(-10); // keep last 10 max
    saveSocialMemory(memory);
    
    // Registra o aprendizado na memória de três camadas também!
    topLearnings.forEach(l => memoryManager.addLearning(l));
  }

  res.json({
    success: true,
    analysis: result,
    addedLearnings: extractedLearnings.slice(0, 2)
  });
}));

module.exports = router;
