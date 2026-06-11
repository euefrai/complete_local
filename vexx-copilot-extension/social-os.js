// Social OS — Controller for Instagram Agent Dashboard and Security Login

const BACKEND_URL = "http://localhost:3000";
let jwtToken = null;

async function getSavedToken() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      const data = await chrome.storage.local.get(['jwtToken']);
      return data.jwtToken || null;
    } catch (e) {
      console.warn("Error loading token from chrome storage:", e);
    }
  }
  return localStorage.getItem("vexx_jwt");
}

async function saveToken(token) {
  jwtToken = token;
  if (token) {
    localStorage.setItem("vexx_jwt", token);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ jwtToken: token });
      } catch (e) {
        console.warn("Error saving token to chrome storage:", e);
      }
    }
  } else {
    localStorage.removeItem("vexx_jwt");
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.remove(['jwtToken']);
      } catch (e) {
        console.warn("Error removing token from chrome storage:", e);
      }
    }
  }
}

// Check auth status on load
async function checkAuth() {
  const token = await getSavedToken();
  if (!token) {
    showLogin();
    return;
  }

  try {
    const r = await fetch(`${BACKEND_URL}/api/auth/verify`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (r.ok) {
      jwtToken = token;
      showDashboard();
      loadInstagramData();
    } else {
      await saveToken(null);
      showLogin();
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    // If backend is offline, show toast but don't force login if we have a token stored
    showToast("Não foi possível conectar ao servidor local para validar o token.", "warning");
    showLogin();
  }
}

function showLogin() {
  document.getElementById("social-login-container").classList.remove("hidden");
  document.getElementById("social-dashboard-container").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("social-login-container").classList.add("hidden");
  document.getElementById("social-dashboard-container").classList.remove("hidden");
}

// Handle Login submit
async function handleLogin() {
  const userEl = document.getElementById("login-username");
  const passEl = document.getElementById("login-password");
  
  const username = userEl ? userEl.value.trim() : "";
  const password = passEl ? passEl.value.trim() : "";

  if (!username || !password) {
    showToast("Por favor, preencha usuário e senha.", "warning");
    return;
  }

  const btn = document.getElementById("btn-submit-login");
  if (btn) btn.disabled = true;

  try {
    const r = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await r.json();
    if (r.ok && data.success) {
      await saveToken(data.token);
      showToast("Login realizado com sucesso!", "success");
      showDashboard();
      loadInstagramData();
    } else {
      showToast(data.error || "Erro de autenticação.", "danger");
    }
  } catch (err) {
    showToast("Erro de conexão com o servidor local.", "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Load Instagram Data
async function loadInstagramData() {
  if (!jwtToken) return;

  const headers = { "Authorization": `Bearer ${jwtToken}` };

  // 1. Load Profile
  try {
    const r = await fetch(`${BACKEND_URL}/api/instagram/profile`, { headers });
    if (r.ok) {
      const p = await r.json();
      const picEl = document.getElementById("ig-profile-pic");
      const nameEl = document.getElementById("ig-profile-name");
      const handleEl = document.getElementById("ig-profile-handle");
      const followersEl = document.getElementById("ig-followers");
      
      if (picEl && p.profile_picture_url) picEl.src = p.profile_picture_url;
      if (nameEl) nameEl.textContent = p.name || p.username;
      if (handleEl) handleEl.textContent = `@${p.username}`;
      if (followersEl) followersEl.textContent = p.followers_count.toLocaleString();
    }
  } catch (e) {
    console.error("Load profile failed:", e);
  }

  // 2. Load Insights
  try {
    const r = await fetch(`${BACKEND_URL}/api/instagram/insights`, { headers });
    if (r.ok) {
      const data = await r.json();
      const reachEl = document.getElementById("ig-reach");
      const engagementEl = document.getElementById("ig-engagement");

      if (reachEl) reachEl.textContent = data.monthlyReach.toLocaleString();
      if (engagementEl) engagementEl.textContent = `${data.engagementRate}%`;
    }
  } catch (e) {
    console.error("Load insights failed:", e);
  }

  // 3. Load Social Memory
  try {
    const r = await fetch(`${BACKEND_URL}/api/social/memory`, { headers });
    if (r.ok) {
      const m = await r.json();
      const nicheEl = document.getElementById("sm-niche");
      const audienceEl = document.getElementById("sm-audience");
      const styleEl = document.getElementById("sm-style");

      if (nicheEl) nicheEl.value = m.niche || "";
      if (audienceEl) audienceEl.value = m.audience || "";
      if (styleEl) styleEl.value = m.writing_style || "";
    }
  } catch (e) {
    console.error("Load social memory failed:", e);
  }
}

// Save Social Memory
async function saveSocialMemory() {
  if (!jwtToken) return;

  const niche = document.getElementById("sm-niche").value.trim();
  const audience = document.getElementById("sm-audience").value.trim();
  const writing_style = document.getElementById("sm-style").value.trim();

  const btn = document.getElementById("btn-save-social-memory");
  if (btn) btn.disabled = true;

  try {
    // Merge with existing list values
    const getRes = await fetch(`${BACKEND_URL}/api/social/memory`, {
      headers: { "Authorization": `Bearer ${jwtToken}` }
    });
    let current = {};
    if (getRes.ok) current = await getRes.json();

    const updated = {
      ...current,
      niche,
      audience,
      writing_style
    };

    const r = await fetch(`${BACKEND_URL}/api/social/memory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`
      },
      body: JSON.stringify(updated)
    });

    if (r.ok) {
      showToast("Memória Social atualizada com sucesso!", "success");
    } else {
      showToast("Falha ao salvar a memória.", "danger");
    }
  } catch (e) {
    showToast("Erro de conexão.", "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Generate Post Content
async function generatePostContent() {
  if (!jwtToken) return;

  const format = document.getElementById("gen-format").value;
  const theme = document.getElementById("gen-theme").value.trim();

  if (!theme) {
    showToast("Por favor, digite um tema para o conteúdo.", "warning");
    return;
  }

  const btn = document.getElementById("btn-generate-content");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ti ti-loader animate-spin" style="display:inline-block; animation: spin 1.5s linear infinite;"></i> Gerando...`;
  }

  try {
    const r = await fetch(`${BACKEND_URL}/api/social/agent/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ format, theme })
    });

    const data = await r.json();
    if (r.ok && data.success) {
      document.getElementById("gen-output-container").classList.remove("hidden");
      const outEl = document.getElementById("gen-output");
      if (outEl) outEl.textContent = data.output;
      showToast("Roteiro criativo gerado pela IA!", "success");
    } else {
      showToast("Erro na geração do conteúdo.", "danger");
    }
  } catch (e) {
    showToast("Erro de conexão com a IA local.", "danger");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ti ti-wand"></i> Gerar Post & Roteiro`;
    }
  }
}

// Publish Now
async function publishPostNow() {
  if (!jwtToken) return;
  const output = document.getElementById("gen-output").textContent;
  if (!output) return;

  // Extract caption (lines after ROTEIRO/LEGENDA)
  const caption = output.replace(/\[ROTEIRO\/LEGENDA\]/i, '').split('[HASHTAGS]')[0].trim();
  
  const btn = document.getElementById("btn-publish-now");
  if (btn) btn.disabled = true;

  try {
    const r = await fetch(`${BACKEND_URL}/api/instagram/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ caption })
    });

    const data = await r.json();
    if (r.ok && data.success) {
      showToast("Post publicado com sucesso via API oficial!", "success");
      loadInstagramData(); // reload counters
    } else {
      showToast(data.error || "Falha na publicação.", "danger");
    }
  } catch (e) {
    showToast("Erro ao conectar à API do servidor.", "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Schedule Post
async function schedulePostLater() {
  if (!jwtToken) return;
  const output = document.getElementById("gen-output").textContent;
  if (!output) return;

  const caption = output.replace(/\[ROTEIRO\/LEGENDA\]/i, '').split('[HASHTAGS]')[0].trim();
  
  // Set schedule for 2 hours from now
  const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const btn = document.getElementById("btn-schedule-post");
  if (btn) btn.disabled = true;

  try {
    const r = await fetch(`${BACKEND_URL}/api/instagram/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ caption, scheduledTime })
    });

    const data = await r.json();
    if (r.ok && data.success) {
      const friendlyDate = new Date(scheduledTime).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      showToast(`Post agendado com sucesso para hoje às ${friendlyDate}!`, "success");
    } else {
      showToast("Falha no agendamento.", "danger");
    }
  } catch (e) {
    showToast("Erro ao conectar à API de agendamento.", "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Analyze Viral Score
async function analyzeViralScore() {
  if (!jwtToken) return;

  const content = document.getElementById("viral-input-text").value.trim();
  if (!content) {
    showToast("Por favor, digite uma legenda/texto para analisar.", "warning");
    return;
  }

  const btn = document.getElementById("btn-analyze-viral");
  if (btn) btn.disabled = true;

  try {
    const r = await fetch(`${BACKEND_URL}/api/social/viral-analyzer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ content })
    });

    const data = await r.json();
    if (r.ok && data.success) {
      const container = document.getElementById("viral-result-container");
      container.classList.remove("hidden");
      
      const scoreEl = document.getElementById("viral-total-score");
      if (scoreEl) scoreEl.textContent = `${data.analysis.score}/100`;

      // Render breakdown pills
      const pillsContainer = document.getElementById("viral-pills-container");
      pillsContainer.innerHTML = "";
      
      const breakdown = data.analysis.breakdown;
      for (const pilar in breakdown) {
        const scoreVal = breakdown[pilar];
        const barColor = scoreVal >= 80 ? "rgba(34, 197, 94, 0.4)" : scoreVal >= 60 ? "rgba(234, 179, 8, 0.4)" : "rgba(239, 68, 68, 0.4)";
        pillsContainer.innerHTML += `
          <div style="margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="text-transform: capitalize;">${pilar}:</span>
              <strong>${scoreVal}%</strong>
            </div>
            <div style="height: 4px; width: 100%; background: var(--color-background-primary); border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; width: ${scoreVal}%; background: ${barColor};"></div>
            </div>
          </div>
        `;
      }

      const feedbackEl = document.getElementById("viral-feedback");
      if (feedbackEl) {
        feedbackEl.innerHTML = `<strong>Feedback:</strong> ${data.analysis.feedback}<br><br><strong>Melhorias:</strong><br>${data.analysis.recommendations.map(r => `• ${r}`).join('<br>')}`;
      }
      showToast("Análise viral concluída!", "success");
    }
  } catch (e) {
    showToast("Erro ao rodar análise viral.", "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Fetch Trends & Competitors
async function fetchTrends() {
  if (!jwtToken) return;

  const btn = document.getElementById("btn-fetch-trends");
  if (btn) btn.disabled = true;

  try {
    const r = await fetch(`${BACKEND_URL}/api/social/trends`, {
      headers: { "Authorization": `Bearer ${jwtToken}` }
    });

    const data = await r.json();
    if (r.ok && data.success) {
      const output = document.getElementById("trends-output");
      output.classList.remove("hidden");
      output.innerHTML = data.output.replace(/\n/g, "<br>");
      showToast("Tendências carregadas com sucesso!", "success");
    }
  } catch (e) {
    showToast("Erro de conexão.", "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Trigger Auto Improvement
async function triggerAutoImprovement() {
  if (!jwtToken) return;

  const btn = document.getElementById("btn-trigger-improvement");
  if (btn) btn.disabled = true;

  try {
    const r = await fetch(`${BACKEND_URL}/api/social/self-improvement`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${jwtToken}` }
    });

    const data = await r.json();
    if (r.ok && data.success) {
      const output = document.getElementById("trends-output");
      output.classList.remove("hidden");
      
      let html = `<strong>[LOG DE AUTO-MELHORIA DO VEXX OS]</strong><br><br>${data.analysis.replace(/\n/g, "<br>")}`;
      if (data.addedLearnings && data.addedLearnings.length > 0) {
        html += `<br><br><span style="color:var(--color-accent-amethyst);"><strong>Novos aprendizados injetados na memória:</strong><br>${data.addedLearnings.map(l => `• ${l}`).join('<br>')}</span>`;
      }
      output.innerHTML = html;
      
      showToast("Análise de melhoria executada com sucesso!", "success");
      loadInstagramData(); // reload memory fields
    } else {
      showToast(data.analysis || "Sem dados para melhorar ainda.", "info");
    }
  } catch (e) {
    showToast("Erro de conexão.", "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Initialize listeners
function initSocialOS() {
  // Login button
  const submitBtn = document.getElementById("btn-submit-login");
  if (submitBtn) submitBtn.addEventListener("click", handleLogin);

  // Save Memory button
  const saveMemoryBtn = document.getElementById("btn-save-social-memory");
  if (saveMemoryBtn) saveMemoryBtn.addEventListener("click", saveSocialMemory);

  // Generate content button
  const genBtn = document.getElementById("btn-generate-content");
  if (genBtn) genBtn.addEventListener("click", generatePostContent);

  // Publish button
  const pubBtn = document.getElementById("btn-publish-now");
  if (pubBtn) pubBtn.addEventListener("click", publishPostNow);

  // Schedule button
  const schedBtn = document.getElementById("btn-schedule-post");
  if (schedBtn) schedBtn.addEventListener("click", schedulePostLater);

  // Viral analyzer button
  const viralBtn = document.getElementById("btn-analyze-viral");
  if (viralBtn) viralBtn.addEventListener("click", analyzeViralScore);

  // Fetch trends button
  const trendsBtn = document.getElementById("btn-fetch-trends");
  if (trendsBtn) trendsBtn.addEventListener("click", fetchTrends);

  // Auto-Improvement button
  const improveBtn = document.getElementById("btn-trigger-improvement");
  if (improveBtn) improveBtn.addEventListener("click", triggerAutoImprovement);

  // Initial auth verification
  checkAuth();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSocialOS);
} else {
  initSocialOS();
}
