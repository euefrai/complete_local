// Vexx AI Copilot — Memory System (Persistent memory store)

class MemoryStore {
  // Key names in chrome.storage.local
  static get PROFILES_KEY() { return "vexx_profiles"; }
  static get TRENDS_KEY() { return "vexx_trends"; }

  // Loads all profiles from storage
  static async _getProfiles() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      const fallback = localStorage.getItem(this.PROFILES_KEY);
      return fallback ? JSON.parse(fallback) : {};
    }
    return new Promise((resolve) => {
      chrome.storage.local.get([this.PROFILES_KEY], (res) => {
        resolve(res[this.PROFILES_KEY] || {});
      });
    });
  }

  // Saves all profiles to storage
  static async _saveProfiles(profiles) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      localStorage.setItem(this.PROFILES_KEY, JSON.stringify(profiles));
      return;
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.PROFILES_KEY]: profiles }, () => {
        resolve();
      });
    });
  }

  // Saves/Updates a profile visit
  static async saveProfileVisit(username, data) {
    if (!username) return;
    const profiles = await this._getProfiles();
    const now = Date.now();

    if (!profiles[username]) {
      profiles[username] = {
        lastVisit: now,
        visits: 0,
        data: {},
        interactions: []
      };
    }

    profiles[username].lastVisit = now;
    profiles[username].visits += 1;
    
    // Merge only defined and non-empty data fields
    if (data) {
      profiles[username].data = {
        ...profiles[username].data,
        ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== null && v !== ""))
      };
    }

    await this._saveProfiles(profiles);
    await this._updateTrendsFromProfile(data);
    console.log(`[MemoryStore] Visita salva para o perfil @${username}. Visitas: ${profiles[username].visits}`);
  }

  // Saves a generated interaction (response copy/insert) for a profile
  static async saveInteraction(username, interaction) {
    if (!username) return;
    const profiles = await this._getProfiles();

    if (!profiles[username]) {
      profiles[username] = {
        lastVisit: Date.now(),
        visits: 1,
        data: { username },
        interactions: []
      };
    }

    const newInteraction = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      date: new Date().toISOString(),
      tone: interaction.tone || "unknown",
      prompt: interaction.prompt || "",
      aiResponse: interaction.aiResponse || "",
      summary: interaction.summary || interaction.aiResponse?.substring(0, 100) + "..."
    };

    profiles[username].interactions.push(newInteraction);
    // Limit to last 50 interactions per profile to keep storage clean
    if (profiles[username].interactions.length > 50) {
      profiles[username].interactions.shift();
    }

    await this._saveProfiles(profiles);
    await this._recordInteractionTimeTrend();
    console.log(`[MemoryStore] Interação registrada para @${username}`);
  }

  // Returns visit history and interactions with a specific user
  static async getProfileHistory(username) {
    if (!username) return null;
    const profiles = await this._getProfiles();
    return profiles[username] || null;
  }

  // Lists the most recently visited profiles
  static async getRecentProfiles(limit = 10) {
    const profiles = await this._getProfiles();
    return Object.entries(profiles)
      .map(([username, info]) => ({ username, ...info }))
      .sort((a, b) => b.lastVisit - a.lastVisit)
      .slice(0, limit);
  }

  // Helper: Increments peaks and trends
  static async _getTrends() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      const fallback = localStorage.getItem(this.TRENDS_KEY);
      return fallback ? JSON.parse(fallback) : { hashtags: {}, niches: {}, peakHours: {} };
    }
    return new Promise((resolve) => {
      chrome.storage.local.get([this.TRENDS_KEY], (res) => {
        resolve(res[this.TRENDS_KEY] || { hashtags: {}, niches: {}, peakHours: {} });
      });
    });
  }

  static async _saveTrends(trends) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      localStorage.setItem(this.TRENDS_KEY, JSON.stringify(trends));
      return;
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.TRENDS_KEY]: trends }, () => {
        resolve();
      });
    });
  }

  // Internal: updates trends based on profile data scraped
  static async _updateTrendsFromProfile(data) {
    if (!data) return;
    const trends = await this._getTrends();

    // Niches / Category
    if (data.category) {
      const n = data.category.toLowerCase().trim();
      trends.niches[n] = (trends.niches[n] || 0) + 1;
    }

    // Hashtags
    if (data.bio && typeof window.SentimentAnalyzer !== "undefined") {
      const hashtags = SentimentAnalyzer.analyzeTrending([data.bio]).hashtags;
      hashtags.forEach(h => {
        trends.hashtags[h.tag] = (trends.hashtags[h.tag] || 0) + 1;
      });
    }

    await this._saveTrends(trends);
  }

  // Internal: records interaction hour peak
  static async _recordInteractionTimeTrend() {
    const trends = await this._getTrends();
    const hour = new Date().getHours().toString();
    trends.peakHours[hour] = (trends.peakHours[hour] || 0) + 1;
    await this._saveTrends(trends);
  }

  // Analyzes patterns: top hashtags, peak hours, top niches
  static async getTrends() {
    return await this._getTrends();
  }

  // Returns high level stats
  static async getStats() {
    const profiles = await this._getProfiles();
    const list = Object.values(profiles);
    
    let totalInteractions = 0;
    list.forEach(p => {
      totalInteractions += p.interactions ? p.interactions.length : 0;
    });

    return {
      totalProfiles: list.length,
      totalInteractions: totalInteractions,
      visitedMultipleTimes: list.filter(p => p.visits > 1).length
    };
  }

  // Fuzzy searches profiles or interaction text
  static async searchMemory(query) {
    if (!query) return [];
    const profiles = await this._getProfiles();
    const cleanQuery = query.toLowerCase().trim();
    
    return Object.entries(profiles)
      .filter(([username, info]) => {
        const nameMatch = username.toLowerCase().includes(cleanQuery);
        const bioMatch = info.data && info.data.bio && info.data.bio.toLowerCase().includes(cleanQuery);
        const fullNameMatch = info.data && info.data.fullName && info.data.fullName.toLowerCase().includes(cleanQuery);
        
        let msgMatch = false;
        if (info.interactions) {
          msgMatch = info.interactions.some(i => i.aiResponse.toLowerCase().includes(cleanQuery));
        }

        return nameMatch || bioMatch || fullNameMatch || msgMatch;
      })
      .map(([username, info]) => ({ username, ...info }));
  }

  // Exports all memory as JSON
  static async exportAll() {
    const profiles = await this._getProfiles();
    const trends = await this._getTrends();
    return {
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      profiles,
      trends
    };
  }

  // Clear memory
  static async clearAll() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      localStorage.removeItem(this.PROFILES_KEY);
      localStorage.removeItem(this.TRENDS_KEY);
      return;
    }
    return new Promise((resolve) => {
      chrome.storage.local.remove([this.PROFILES_KEY, this.TRENDS_KEY], () => {
        resolve();
      });
    });
  }
}

// Attach to window
window.MemoryStore = MemoryStore;
