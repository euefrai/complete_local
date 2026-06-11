// Quick Actions — Pílulas contextuais de ação rápida
// Renderiza pílulas dinâmicas conforme o tipo de contexto detectado

const QUICK_ACTIONS = {
  // DMs do Instagram ou WhatsApp
  chat: [
    {
      label: "Contornar Objeção",
      icon: "ti-shield-check",
      tone: "closing",
      prompt: "O contato levantou uma objeção ou hesitação. Formule uma resposta persuasiva que contorne a objeção de forma empática e inteligente, reconduzindo para o fechamento."
    },
    {
      label: "Pedir Contato",
      icon: "ti-address-book",
      tone: "friendly",
      prompt: "Peça o e-mail ou número de telefone do contato de forma educada e natural, justificando que é para enviar mais informações ou agendar algo."
    },
    {
      label: "Agendar Reunião",
      icon: "ti-calendar-event",
      tone: "professional",
      prompt: "Proponha ao contato agendar uma reunião rápida (call de 15 min) para discutir a proposta. Ofereça 2-3 opções de horários esta semana. Seja objetivo e profissional."
    },
    {
      label: "Enviar Proposta",
      icon: "ti-file-invoice",
      tone: "closing",
      prompt: "Formule uma mensagem de transição para enviar o link de pagamento ou proposta comercial. Resuma brevemente os benefícios e crie urgência com sutileza."
    },
    {
      label: "Follow-up",
      icon: "ti-bell-ringing",
      tone: "friendly",
      prompt: "O contato não respondeu há algum tempo. Formule um follow-up gentil, leve e não-invasivo para retomar a conversa, adicionando um gancho de valor ou novidade."
    },
    {
      label: "Agradecer & Fechar",
      icon: "ti-heart-handshake",
      tone: "friendly",
      prompt: "Agradeça ao contato pela conversa produtiva. Encerre de forma profissional e acolhedora, deixando a porta aberta para futuros contatos. Mencione algo específico da conversa."
    }
  ],

  // Perfil de alguém no Instagram
  profile: [
    {
      label: "Script DM Fria",
      icon: "ti-send",
      tone: "professional",
      prompt: "Gere 2 scripts de DM fria para abordar este perfil de forma natural e profissional, visando agendar um papo rápido comercial sobre os serviços VEXX."
    },
    {
      label: "Analisar Nicho",
      icon: "ti-target-arrow",
      tone: "professional",
      prompt: "Analise o nicho e potencial dor deste perfil com base na bio. Identifique oportunidades de abordagem e como o VEXX pode ajudar."
    }
  ],

  // Criação de Story/Reel
  creation: [
    {
      label: "Roteiro de Reel",
      icon: "ti-movie",
      tone: "custom",
      prompt: "Gere 2 roteiros curtos para Reels com ganchos poderosos no início (3 primeiros segundos). Foco em captar atenção no nicho de tecnologia e IA."
    },
    {
      label: "Prompt de Imagem",
      icon: "ti-photo-ai",
      tone: "custom",
      prompt: "Gere 1 prompt detalhado de imagem (em inglês) para IA generativa. O tema deve ser tecnologia premium, dark mode, futurista. Formate como: [PROMPT] \"...\""
    },
    {
      label: "Sugestão de Áudio",
      icon: "ti-music",
      tone: "custom",
      prompt: "Sugira 3 músicas/áudios em alta no Instagram que combinem com estética de tecnologia, design e inovação. Indique o nome da música e o artista."
    },
    {
      label: "Legenda Viral",
      icon: "ti-writing",
      tone: "custom",
      prompt: "Escreva 2 opções de legenda para um post/reel de tecnologia. Use ganchos de curiosidade, micro-storytelling e CTA estratégico. Max 2200 caracteres cada."
    }
  ],

  // Feed Principal
  feed: [
    {
      label: "Ideia de Conteúdo",
      icon: "ti-bulb",
      tone: "custom",
      prompt: "Gere 3 ideias de conteúdo rápido (Reels de texto com imagem de fundo) com alto potencial de viralização no nicho de tecnologia, IA e startups."
    },
    {
      label: "Tática de Engajamento",
      icon: "ti-chart-arrows-vertical",
      tone: "custom",
      prompt: "Forneça 3 táticas rápidas de engajamento diário no Instagram: quais stories postar, que tipo de posts comentar para ganhar autoridade, e qual CTA usar."
    }
  ],

  // Aba Explorar
  explore: [
    {
      label: "Ideia de Conteúdo",
      icon: "ti-bulb",
      tone: "custom",
      prompt: "Com base nas tendências atuais do Explorar, sugira 3 ideias de conteúdo original que se diferenciem do mainstream mas aproveitem o algoritmo."
    },
    {
      label: "Análise de Tendência",
      icon: "ti-trending-up",
      tone: "custom",
      prompt: "Analise as tendências atuais de conteúdo no Instagram e sugira como adaptar para o nicho de tecnologia e IA. Foque em formatos que estão performando bem."
    }
  ],

  // Post individual
  post: [
    {
      label: "Comentário Estratégico",
      icon: "ti-message-dots",
      tone: "professional",
      prompt: "Gere um comentário estratégico e marcante para este post que atraia atenção para o perfil do usuário. Deve soar natural, não promocional."
    },
    {
      label: "Análise de Audiência",
      icon: "ti-users-group",
      tone: "custom",
      prompt: "Analise o tom predominante dos comentários deste post e sugira como o usuário pode se posicionar para capturar essa audiência."
    }
  ]
};

function getQuickActionsForContext(contextType) {
  if (contextType === "instagram" || contextType === "whatsapp") {
    return QUICK_ACTIONS.chat;
  }
  return QUICK_ACTIONS[contextType] || QUICK_ACTIONS.feed;
}

function renderQuickActions(contextType) {
  const tray = document.getElementById("quick-actions-tray");
  if (!tray) return;

  const actions = getQuickActionsForContext(contextType);

  if (!actions || actions.length === 0) {
    tray.innerHTML = "";
    tray.classList.add("hidden");
    return;
  }

  tray.classList.remove("hidden");
  tray.innerHTML = actions.map(action => `
    <button class="quick-pill" data-tone="${action.tone}" data-prompt="${encodeURIComponent(action.prompt)}" title="${action.prompt.substring(0, 80)}...">
      <i class="ti ${action.icon}"></i>
      <span>${action.label}</span>
    </button>
  `).join("");
}

// Event delegation para pílulas de Quick Action
function setupQuickActionsListener() {
  const tray = document.getElementById("quick-actions-tray");
  if (!tray) return;

  tray.addEventListener("click", (e) => {
    const pill = e.target.closest(".quick-pill");
    if (!pill) return;

    const tone = pill.dataset.tone;
    const prompt = decodeURIComponent(pill.dataset.prompt);

    // Configura o seletor de tom
    const toneSelect = document.getElementById("tone-select");
    if (toneSelect) {
      toneSelect.value = tone === "custom" ? "custom" : tone;
      // Dispara change para mostrar/esconder campo custom
      toneSelect.dispatchEvent(new Event("change"));
    }

    // Insere o prompt no campo custom
    const customInput = document.getElementById("custom-prompt-input");
    if (customInput) {
      customInput.value = prompt;
      if (tone !== "custom") {
        // Se o tom não é custom, ainda usamos o prompt como instrução adicional
        customInput.classList.remove("hidden");
      }
    }

    // Feedback visual na pílula
    pill.classList.add("quick-pill-active");
    setTimeout(() => pill.classList.remove("quick-pill-active"), 300);

    // Dispara a geração automaticamente
    if (typeof generateReplies === "function") {
      generateReplies();
    }
  });
}
