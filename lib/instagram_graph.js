const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const PROFILE_FILE = path.join(DATA_DIR, 'db_instagram_profile.json');
const MEDIA_FILE = path.join(DATA_DIR, 'db_instagram_media.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'db_instagram_comments.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'db_instagram_messages.json');
const SCHEDULED_FILE = path.join(DATA_DIR, 'db_instagram_scheduled.json');

// Ensure database directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helpers for JSON files
function readJsonFile(filePath, defaultData = null) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
  return defaultData;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Error writing to ${filePath}:`, e.message);
    return false;
  }
}

// Bootstrap local database if it doesn't exist
function bootstrapMockDatabase() {
  if (!fs.existsSync(PROFILE_FILE)) {
    writeJsonFile(PROFILE_FILE, {
      id: "17841400000000001",
      username: "euefrai",
      name: "Efraim Felix",
      followers_count: 15300,
      follows_count: 321,
      media_count: 142,
      profile_picture_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      biography: "Building autonomous systems and AI agents. wifa jl OS architect.",
      website: "https://vexx.ai",
      category: "Criador de Conteúdo Digital",
      reach_monthly: 45200,
      engagement_rate: 14.6
    });
  }

  if (!fs.existsSync(MEDIA_FILE)) {
    writeJsonFile(MEDIA_FILE, [
      {
        id: "media_post_1",
        media_type: "CAROUSEL_ALBUM",
        media_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600",
        permalink: "https://instagram.com/p/media_post_1",
        caption: "O Futuro das IAs Autônomas e Sistemas Operacionais de Agentes. Hoje estamos lançando o VEXX OS! #ia #agentes #startup #tecnologia #programmer",
        like_count: 2530,
        comments_count: 42,
        timestamp: "2026-06-08T14:30:00Z",
        insights: { reach: 12400, impressions: 16800, engagement: 2572, saved: 412 }
      },
      {
        id: "media_post_2",
        media_type: "VIDEO",
        media_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=600",
        permalink: "https://instagram.com/p/media_post_2",
        caption: "Demonstração prática de Computer Use e RPA rodando no Instagram. O agente vê, planeja e executa! 🤯🚀 #rpa #computeruse #ai #agent #coding",
        like_count: 4120,
        comments_count: 89,
        timestamp: "2026-06-10T18:00:00Z",
        insights: { reach: 24500, impressions: 32100, engagement: 4209, saved: 980 }
      },
      {
        id: "media_post_3",
        media_type: "IMAGE",
        media_url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&q=80&w=600",
        permalink: "https://instagram.com/p/media_post_3",
        caption: "Design premium de painéis de controle de IA. Minimalismo e funcionalidade andam juntos. O que achou dessa interface? #ui #ux #design #ai #dashboard",
        like_count: 890,
        comments_count: 14,
        timestamp: "2026-06-11T10:00:00Z",
        insights: { reach: 4500, impressions: 5800, engagement: 904, saved: 110 }
      }
    ]);
  }

  if (!fs.existsSync(COMMENTS_FILE)) {
    writeJsonFile(COMMENTS_FILE, {
      "media_post_1": [
        { id: "comm_1_1", text: "Excelente post, o futuro já chegou mesmo!", username: "jfelixns", timestamp: "2026-06-08T15:00:00Z", like_count: 12 },
        { id: "comm_1_2", text: "Estou ansioso para ver isso rodando", username: "lucas_dev", timestamp: "2026-06-08T15:30:00Z", like_count: 4 },
        { id: "comm_1_3", text: "Como faço para testar esse copiloto?", username: "gaby_mkt", timestamp: "2026-06-08T16:15:00Z", like_count: 0 }
      ],
      "media_post_2": [
        { id: "comm_2_1", text: "Incrível ver Computer Use se popularizando desse jeito!", username: "agent_developer", timestamp: "2026-06-10T18:05:00Z", like_count: 24 },
        { id: "comm_2_2", text: "Isso funciona em contas comerciais grandes?", username: "brand_strategy", timestamp: "2026-06-10T18:45:00Z", like_count: 8 },
        { id: "comm_2_3", text: "Que doidera esse clique automático na tela", username: "mario_ux", timestamp: "2026-06-10T19:00:00Z", like_count: 1 }
      ],
      "media_post_3": [
        { id: "comm_3_1", text: "Combinação de roxo e preto ficou sensacional!", username: "design_master", timestamp: "2026-06-11T10:15:00Z", like_count: 5 },
        { id: "comm_3_2", text: "Interface linda, muito limpa", username: "carla_ux", timestamp: "2026-06-11T10:40:00Z", like_count: 2 }
      ]
    });
  }

  if (!fs.existsSync(MESSAGES_FILE)) {
    writeJsonFile(MESSAGES_FILE, [
      {
        id: "chat_jfelixns",
        username: "jfelixns",
        name: "João Felix",
        messages: [
          { sender: "jfelixns", text: "Opa Efraim, blz? Vi o vídeo do robô operando o Insta, muito massa!", timestamp: "2026-06-10T19:30:00Z" },
          { sender: "euefrai", text: "Fala João! Beleza? Que bom que gostou, estamos integrando com a Graph API agora.", timestamp: "2026-06-10T19:35:00Z" },
          { sender: "jfelixns", text: "Show! Tem como fazer ele responder comentários de posts específicos de forma automática?", timestamp: "2026-06-10T19:40:00Z" }
        ]
      },
      {
        id: "chat_brand_strategy",
        username: "brand_strategy",
        name: "Carol - Branding",
        messages: [
          { sender: "brand_strategy", text: "Olá! Vocês fazem integração para automação de DMs?", timestamp: "2026-06-11T09:12:00Z" },
          { sender: "euefrai", text: "Olá Carol! Sim, conseguimos integrar tanto via API oficial quanto via RPA visual.", timestamp: "2026-06-11T09:30:00Z" },
          { sender: "brand_strategy", text: "Perfeito! Gostaria de saber os valores da mensalidade.", timestamp: "2026-06-11T09:35:00Z" }
        ]
      }
    ]);
  }

  if (!fs.existsSync(SCHEDULED_FILE)) {
    writeJsonFile(SCHEDULED_FILE, []);
  }
}

// Run bootstrap
bootstrapMockDatabase();

class InstagramGraphService {
  constructor() {
    this.accessToken = process.env.META_USER_ACCESS_TOKEN || null;
    this.businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || null;
    this.graphVersion = 'v19.0';
    this.isSimulated = !(this.accessToken && this.businessAccountId);
    this.hasConnectionError = false;
    this.lastError = null;
    
    if (this.isSimulated) {
      console.log("[InstagramGraphService] Iniciado em MODO SIMULADO (JSON Database).");
    } else {
      console.log("[InstagramGraphService] Iniciado em MODO OFICIAL (Meta Graph API). ID:", this.businessAccountId);
    }
  }

  // Helper to make Graph API Requests
  async makeRequest(endpoint, options = {}) {
    if (this.isSimulated) return null;
    
    const url = `https://graph.facebook.com/${this.graphVersion}/${endpoint}`;
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${separator}access_token=${this.accessToken}`;

    try {
      const response = await fetch(finalUrl, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Meta Graph API error');
      }
      this.hasConnectionError = false;
      this.lastError = null;
      return data;
    } catch (e) {
      console.error(`[Meta Graph API Error] Endpoint: ${endpoint}`, e.message);
      this.hasConnectionError = true;
      this.lastError = e.message;
      throw e;
    }
  }

  // 1. Get Profile
  async getProfile(forceSimulated = false) {
    if (this.isSimulated || forceSimulated) {
      return readJsonFile(PROFILE_FILE);
    }

    // Fields required for professional business accounts
    const fields = 'username,name,followers_count,follows_count,media_count,profile_picture_url,biography,website';
    const data = await this.makeRequest(`${this.businessAccountId}?fields=${fields}`);
    
    // Add additional mock details for reach/engagement in live mode
    return {
      ...data,
      reach_monthly: 28400, 
      engagement_rate: 11.2
    };
  }

  // 2. Get Media list
  async getMedia(forceSimulated = false) {
    if (this.isSimulated || forceSimulated) {
      return readJsonFile(MEDIA_FILE) || [];
    }

    const fields = 'id,media_type,media_url,permalink,caption,like_count,comments_count,timestamp';
    const result = await this.makeRequest(`${this.businessAccountId}/media?fields=${fields}`);
    const mediaList = result.data || [];

    // Inject simulated reach/impressions if not available on basic node
    return mediaList.map(m => ({
      ...m,
      insights: {
        reach: Math.round(m.like_count * 4.8),
        impressions: Math.round(m.like_count * 6.5),
        engagement: Math.round(m.like_count + m.comments_count),
        saved: Math.round(m.like_count * 0.15)
      }
    }));
  }

  // 3. Get Insights
  async getInsights(forceSimulated = false) {
    const profile = await this.getProfile(forceSimulated);
    const media = await this.getMedia(forceSimulated);
    
    let totalReach = profile.reach_monthly || 0;
    let totalEngagement = 0;
    let totalLikes = 0;
    let totalComments = 0;

    media.forEach(m => {
      totalLikes += m.like_count || 0;
      totalComments += m.comments_count || 0;
      if (m.insights) {
        totalEngagement += m.insights.engagement || 0;
      }
    });

    return {
      followers: profile.followers_count,
      follows: profile.follows_count,
      mediaCount: profile.media_count,
      monthlyReach: totalReach,
      totalLikes,
      totalComments,
      totalEngagement,
      engagementRate: parseFloat(((totalEngagement / (profile.followers_count || 1)) * 100).toFixed(2))
    };
  }

  // 4. Get Comments
  async getComments(mediaId) {
    if (this.isSimulated) {
      const allComments = readJsonFile(COMMENTS_FILE) || {};
      return allComments[mediaId] || [];
    }

    const fields = 'id,text,username,timestamp,like_count';
    const result = await this.makeRequest(`${mediaId}/comments?fields=${fields}`);
    return result.data || [];
  }

  // 5. Reply to comment
  async replyComment(commentId, message) {
    if (this.isSimulated) {
      const allComments = readJsonFile(COMMENTS_FILE) || {};
      
      // Find where this comment is to log response locally
      let found = false;
      for (const mediaId in allComments) {
        const comment = allComments[mediaId].find(c => c.id === commentId);
        if (comment) {
          allComments[mediaId].push({
            id: `reply_${Date.now()}`,
            text: message,
            username: "euefrai",
            timestamp: new Date().toISOString(),
            like_count: 0,
            reply_to: commentId
          });
          found = true;
          break;
        }
      }
      
      if (found) {
        writeJsonFile(COMMENTS_FILE, allComments);
        return { success: true, id: `reply_${Date.now()}` };
      }
      throw new Error("Comentário não encontrado para responder.");
    }

    return await this.makeRequest(`${commentId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  // 6. Publish Post
  async publishPost(imageUrl, caption) {
    if (this.isSimulated) {
      const media = readJsonFile(MEDIA_FILE) || [];
      const newPost = {
        id: `media_post_${Date.now()}`,
        media_type: "IMAGE",
        media_url: imageUrl || "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=600",
        permalink: `https://instagram.com/p/media_post_${Date.now()}`,
        caption: caption,
        like_count: 0,
        comments_count: 0,
        timestamp: new Date().toISOString(),
        insights: { reach: 0, impressions: 0, engagement: 0, saved: 0 }
      };

      media.unshift(newPost);
      writeJsonFile(MEDIA_FILE, media);

      // Increment profile media count
      const profile = readJsonFile(PROFILE_FILE);
      if (profile) {
        profile.media_count += 1;
        writeJsonFile(PROFILE_FILE, profile);
      }

      return { success: true, id: newPost.id, permalink: newPost.permalink };
    }

    // Step 1: Create Container
    const container = await this.makeRequest(`${this.businessAccountId}/media`, {
      method: 'POST',
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption
      })
    });

    const creationId = container.id;

    // Step 2: Publish Container
    const publish = await this.makeRequest(`${this.businessAccountId}/media_publish`, {
      method: 'POST',
      body: JSON.stringify({
        creation_id: creationId
      })
    });

    return { success: true, id: publish.id };
  }

  // 7. Schedule Post
  async schedulePost(imageUrl, caption, scheduledTime) {
    const timeStr = new Date(scheduledTime).toISOString();
    
    if (this.isSimulated) {
      const scheduled = readJsonFile(SCHEDULED_FILE) || [];
      const newScheduled = {
        id: `sched_${Date.now()}`,
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=600",
        caption,
        scheduledTime: timeStr,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      scheduled.push(newScheduled);
      writeJsonFile(SCHEDULED_FILE, scheduled);
      return { success: true, scheduledPost: newScheduled };
    }

    // Official Graph API allows setting schedule_date parameter
    const epochSecs = Math.round(new Date(scheduledTime).getTime() / 1000);
    const container = await this.makeRequest(`${this.businessAccountId}/media`, {
      method: 'POST',
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        schedule_date: epochSecs
      })
    });

    return { success: true, containerId: container.id, scheduledTime: timeStr };
  }

  // 8. Get Messages
  async getMessages() {
    if (this.isSimulated) {
      return readJsonFile(MESSAGES_FILE) || [];
    }

    // Messenger API / Instagram DM integration
    const result = await this.makeRequest(`${this.businessAccountId}/conversations?fields=participants,messages{message,from,timestamp}`);
    const conversations = result.data || [];

    return conversations.map(c => {
      const contact = c.participants?.data?.find(p => p.id !== this.businessAccountId) || {};
      const msgList = (c.messages?.data || []).reverse().map(m => ({
        sender: m.from?.username || m.from?.name || (m.from?.id === this.businessAccountId ? 'euefrai' : 'client'),
        text: m.message,
        timestamp: m.timestamp
      }));

      return {
        id: c.id,
        username: contact.username || contact.name || 'unknown',
        name: contact.name || 'Contato',
        messages: msgList
      };
    });
  }

  // 9. Send direct message
  async sendDM(username, text) {
    if (this.isSimulated) {
      const messages = readJsonFile(MESSAGES_FILE) || [];
      const convo = messages.find(m => m.username === username);
      
      if (convo) {
        convo.messages.push({
          sender: "euefrai",
          text,
          timestamp: new Date().toISOString()
        });
        writeJsonFile(MESSAGES_FILE, messages);
        return { success: true };
      }
      
      // Create new conversation
      const newConvo = {
        id: `chat_${username}`,
        username,
        name: username,
        messages: [
          { sender: "euefrai", text, timestamp: new Date().toISOString() }
        ]
      };
      messages.push(newConvo);
      writeJsonFile(MESSAGES_FILE, messages);
      return { success: true, conversation: newConvo };
    }

    // In live Graph API, we must use the Send API with recipient IG SID
    // Normally retrieved from webhooks/conversation list
    throw new Error("Envio oficial de DM necessita do ID do participante Meta. Use o modo simulado ou configure webhooks.");
  }
}

module.exports = new InstagramGraphService();
