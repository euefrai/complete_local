// Vexx AI Copilot — Memory System (Persistent memory store)

class MemoryStore {
  // Key names in chrome.storage.local
  static get PROFILES_KEY() { return "vexx_profiles"; }
  static get TRENDS_KEY() { return "vexx_trends"; }

  // Loads all profiles from storage
  static async _getProfiles() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        const fallback = localStorage.getItem(this.PROFILES_KEY);
        return fallback ? JSON.parse(fallback) : {};
      }
      return new Promise((resolve) => {
        chrome.storage.local.get([this.PROFILES_KEY], (res) => {
          resolve(res[this.PROFILES_KEY] || {});
        });
      });
    } catch (e) {
      console.error("[MemoryStore] Erro ao carregar perfis:", e);
      return {};
    }
  }

  // Saves all profiles to storage
  static async _saveProfiles(profiles) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        localStorage.setItem(this.PROFILES_KEY, JSON.stringify(profiles));
        return;
      }
      return new Promise((resolve) => {
        chrome.storage.local.set({ [this.PROFILES_KEY]: profiles }, () => {
          resolve();
        });
      });
    } catch (e) {
      console.error("[MemoryStore] Erro ao salvar perfis:", e);
    }
  }

  // Saves/Updates a profile visit
  static async saveProfileVisit(username, data) {
    try {
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
    } catch (e) {
      console.error("[MemoryStore] Erro ao registrar visita de perfil:", e);
    }
  }

  // Saves a generated interaction (response copy/insert) for a profile
  static async saveInteraction(username, interaction) {
    try {
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
    } catch (e) {
      console.error("[MemoryStore] Erro ao salvar interacao:", e);
    }
  }

  // Returns visit history and interactions with a specific user
  static async getProfileHistory(username) {
    try {
      if (!username) return null;
      const profiles = await this._getProfiles();
      return profiles[username] || null;
    } catch (e) {
      console.error("[MemoryStore] Erro ao buscar historico do perfil:", e);
      return null;
    }
  }

  // Lists the most recently visited profiles
  static async getRecentProfiles(limit = 10) {
    try {
      const profiles = await this._getProfiles();
      return Object.entries(profiles)
        .map(([username, info]) => ({ username, ...info }))
        .sort((a, b) => b.lastVisit - a.lastVisit)
        .slice(0, limit);
    } catch (e) {
      console.error("[MemoryStore] Erro ao buscar perfis recentes:", e);
      return [];
    }
  }

  // Helper: Increments peaks and trends
  static async _getTrends() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        const fallback = localStorage.getItem(this.TRENDS_KEY);
        return fallback ? JSON.parse(fallback) : { hashtags: {}, niches: {}, peakHours: {} };
      }
      return new Promise((resolve) => {
        chrome.storage.local.get([this.TRENDS_KEY], (res) => {
          resolve(res[this.TRENDS_KEY] || { hashtags: {}, niches: {}, peakHours: {} });
        });
      });
    } catch (e) {
      console.error("[MemoryStore] Erro ao carregar tendencias:", e);
      return { hashtags: {}, niches: {}, peakHours: {} };
    }
  }

  static async _saveTrends(trends) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        localStorage.setItem(this.TRENDS_KEY, JSON.stringify(trends));
        return;
      }
      return new Promise((resolve) => {
        chrome.storage.local.set({ [this.TRENDS_KEY]: trends }, () => {
          resolve();
        });
      });
    } catch (e) {
      console.error("[MemoryStore] Erro ao salvar tendencias:", e);
    }
  }

  // Internal: updates trends based on profile data scraped
  static async _updateTrendsFromProfile(data) {
    try {
      if (!data) return;
      const trends = await this._getTrends();

      // Niches / Category
      if (data.category) {
        const n = data.category.toLowerCase().trim();
        trends.niches[n] = (trends.niches[n] || 0) + 1;
      }

      // Hashtags
      if (data.bio && typeof window.SentimentAnalyzer !== "undefined") {
        const hashtags = window.SentimentAnalyzer.analyzeTrending([data.bio]).hashtags;
        hashtags.forEach(h => {
          trends.hashtags[h.tag] = (trends.hashtags[h.tag] || 0) + 1;
        });
      }

      await this._saveTrends(trends);
    } catch (e) {
      console.error("[MemoryStore] Erro ao processar tendencias do perfil:", e);
    }
  }

  // Internal: records interaction hour peak
  static async _recordInteractionTimeTrend() {
    try {
      const trends = await this._getTrends();
      const hour = new Date().getHours().toString();
      trends.peakHours[hour] = (trends.peakHours[hour] || 0) + 1;
      await this._saveTrends(trends);
    } catch (e) {
      console.error("[MemoryStore] Erro ao registrar pico de interacao:", e);
    }
  }

  // Analyzes patterns: top hashtags, peak hours, top niches
  static async getTrends() {
    try {
      return await this._getTrends();
    } catch (e) {
      console.error("[MemoryStore] Erro ao obter tendencias:", e);
      return { hashtags: {}, niches: {}, peakHours: {} };
    }
  }

  // Returns high level stats
  static async getStats() {
    try {
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
    } catch (e) {
      console.error("[MemoryStore] Erro ao obter estatisticas:", e);
      return { totalProfiles: 0, totalInteractions: 0, visitedMultipleTimes: 0 };
    }
  }

  // Fuzzy searches profiles or interaction text
  static async searchMemory(query) {
    try {
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
    } catch (e) {
      console.error("[MemoryStore] Erro ao pesquisar memoria:", e);
      return [];
    }
  }

  // Exports all memory as JSON
  static async exportAll() {
    try {
      const profiles = await this._getProfiles();
      const trends = await this._getTrends();
      return {
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        profiles,
        trends
      };
    } catch (e) {
      console.error("[MemoryStore] Erro ao exportar dados:", e);
      return { version: "2.0.0", profiles: {}, trends: {} };
    }
  }

  // Clear memory
  static async clearAll() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        localStorage.removeItem(this.PROFILES_KEY);
        localStorage.removeItem(this.TRENDS_KEY);
        localStorage.removeItem("vexx_workspace_project");
        localStorage.removeItem("vexx_relationships");
        return;
      }
      return new Promise((resolve) => {
        chrome.storage.local.remove([this.PROFILES_KEY, this.TRENDS_KEY, "vexx_workspace_project", "vexx_relationships"], () => {
          resolve();
        });
      });
    } catch (e) {
      console.error("[MemoryStore] Erro ao limpar memoria:", e);
    }
  }

  // Get active workspace / project context
  static async getWorkspaceProject() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        const val = localStorage.getItem("vexx_workspace_project");
        return val || "Desenvolvimento do App Fitness";
      }
      return new Promise((resolve) => {
        chrome.storage.local.get(["vexx_workspace_project"], (res) => {
          resolve(res["vexx_workspace_project"] || "Desenvolvimento do App Fitness");
        });
      });
    } catch (e) {
      return "Desenvolvimento do App Fitness";
    }
  }

  static async saveWorkspaceProject(project) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        localStorage.setItem("vexx_workspace_project", project);
        return;
      }
      return new Promise((resolve) => {
        chrome.storage.local.set({ "vexx_workspace_project": project }, () => {
          resolve();
        });
      });
    } catch (e) {}
  }

  // Site relationships graph mapping
  static async getRelationships() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        const val = localStorage.getItem("vexx_relationships");
        return val ? JSON.parse(val) : {};
      }
      return new Promise((resolve) => {
        chrome.storage.local.get(["vexx_relationships"], (res) => {
          resolve(res["vexx_relationships"] || {});
        });
      });
    } catch (e) {
      return {};
    }
  }

  static async saveRelationship(domain, project) {
    try {
      const rels = await this.getRelationships();
      rels[domain] = project;
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        localStorage.setItem("vexx_relationships", JSON.stringify(rels));
        return;
      }
      return new Promise((resolve) => {
        chrome.storage.local.set({ "vexx_relationships": rels }, () => {
          resolve();
        });
      });
    } catch (e) {}
  }

  // Site Intelligence Cache
  static async getSiteIntel(domain) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        const val = localStorage.getItem(`vexx_site_intel_${domain}`);
        return val ? JSON.parse(val) : null;
      }
      return new Promise((resolve) => {
        chrome.storage.local.get([`vexx_site_intel_${domain}`], (res) => {
          resolve(res[`vexx_site_intel_${domain}`] || null);
        });
      });
    } catch (e) {
      return null;
    }
  }

  static async saveSiteIntel(domain, data) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        localStorage.setItem(`vexx_site_intel_${domain}`, JSON.stringify(data));
        return;
      }
      return new Promise((resolve) => {
        chrome.storage.local.set({ [`vexx_site_intel_${domain}`]: data }, () => {
          resolve();
        });
      });
    } catch (e) {}
  }
}

// Attach to window
window.MemoryStore = MemoryStore;
