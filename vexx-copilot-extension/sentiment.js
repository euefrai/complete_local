// Vexx AI Copilot — Sentiment Analysis & Local Trending Engine

class SentimentAnalyzer {
  static get DICTIONARY() {
    return {
      positive: new Set([
        "bom", "boa", "otimo", "ótimo", "excelente", "maravilhoso", "sensacional", "incrivel", "incrível", 
        "amei", "gostei", "parabens", "parabéns", "obrigado", "obrigada", "legal", "top", "sucesso", 
        "lindo", "perfeito", "feliz", "recomendo", "show", "maravilha", "valeu", "grato", "grata", 
        "adoro", "amo", "melhor", "ganhou", "facil", "fácil", "parceria", "recomendo", "ajudou", "recomendo"
      ]),
      negative: new Set([
        "ruim", "pessimo", "péssimo", "horrivel", "horrível", "dificil", "difícil", "chato", "triste", 
        "odeio", "odiei", "problema", "erro", "falha", "quebrado", "defeito", "decepcionado", "lento", 
        "caro", "atraso", "atrasado", "mal", "pior", "complicado", "lixo", "droga", "desastre", "estragado",
        "nao funciona", "não funciona", "dúvida", "duvida", "ruim", "pessima", "péssima", "perdi", "perda"
      ])
    };
  }

  static get EMOJIS() {
    return {
      positive: new Set(["😊", "😀", "😂", "🤣", "😍", "🥰", "❤️", "👏", "🙌", "👍", "🚀", "🎉", "🔥", "🤩", "💚", "💙", "👌", "🎯"]),
      negative: new Set(["😢", "😭", "😡", "😠", "👎", "🤮", "💩", "😰", "🙄", "❌", "💔", "⚠️", "🤔"])
    };
  }

  static get STOPWORDS() {
    return new Set([
      "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "em", "no", "na", 
      "nos", "nas", "para", "com", "por", "que", "e", "u", "ou", "se", "mas", "como", "mais", "este", "esta", 
      "com", "nao", "não", "sim", "eu", "você", "voce", "ele", "ela", "nós", "eles", "elas", "me", "te", "se",
      "só", "so", "muito", "esta", "está", "tem", "ter", "foi", "ser", "seu", "sua", "seus", "suas", "meu", "minha"
    ]);
  }

  // Analyzes sentiment of a single string, returning a score from -1 to 1 and category
  static analyzeSentiment(text) {
    if (!text) return { sentiment: "neutral", score: 0, percentage: 50 };

    let score = 0;
    const cleanText = text.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ");

    const words = cleanText.split(/\s+/).filter(Boolean);
    const dict = this.DICTIONARY;

    // 1. Keyword check
    words.forEach(word => {
      if (dict.positive.has(word)) score += 1;
      if (dict.negative.has(word)) score -= 1;
    });

    // 2. Emoji check
    const emojis = this.EMOJIS;
    const textChars = Array.from(text);
    textChars.forEach(char => {
      if (emojis.positive.has(char)) score += 1.5;
      if (emojis.negative.has(char)) score -= 1.5;
    });

    // 3. Punctuation intensity (multiple exclamations increase absolute value)
    const exclamations = (text.match(/!/g) || []).length;
    if (exclamations > 1 && score !== 0) {
      score = score > 0 ? score + 0.5 : score - 0.5;
    }

    // Determine category and normalize score between -1 and 1
    const totalTokens = words.length + textChars.filter(c => emojis.positive.has(c) || emojis.negative.has(c)).length;
    let normalizedScore = totalTokens > 0 ? score / Math.max(totalTokens * 0.3, 1) : 0;
    
    // Clamp
    normalizedScore = Math.max(-1, Math.min(1, normalizedScore));

    let sentiment = "neutral";
    if (normalizedScore > 0.15) sentiment = "positive";
    else if (normalizedScore < -0.15) sentiment = "negative";

    // Convert to percentage (0% = negative, 50% = neutral, 100% = positive)
    const percentage = Math.round((normalizedScore + 1) * 50);

    return {
      sentiment: sentiment,
      score: normalizedScore,
      percentage: percentage
    };
  }

  // Identifies trending hashtags and words in an array of texts/comments
  static analyzeTrending(comments) {
    if (!comments || comments.length === 0) return { hashtags: [], keywords: [] };

    const hashtagCounts = {};
    const wordCounts = {};
    const stopwords = this.STOPWORDS;

    comments.forEach(c => {
      const text = c.text || c;
      if (typeof text !== "string") return;

      // Extract hashtags
      const hashtags = text.match(/#([a-zA-Z0-9_À-ÿ]+)/g) || [];
      hashtags.forEach(tag => {
        const cleanTag = tag.toLowerCase();
        hashtagCounts[cleanTag] = (hashtagCounts[cleanTag] || 0) + 1;
      });

      // Extract words
      const cleanText = text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?#@]/g, " ");

      const words = cleanText.split(/\s+/).filter(Boolean);
      words.forEach(word => {
        if (word.length > 2 && !stopwords.has(word) && isNaN(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    // Sort and grab top 5
    const topHashtags = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => ({ tag: entry[0], count: entry[1] }));

    const topKeywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => ({ word: entry[0], count: entry[1] }));

    return {
      hashtags: topHashtags,
      keywords: topKeywords
    };
  }

  // Aggregates sentiment metrics across multiple comments
  static summarizeAudience(comments) {
    if (!comments || comments.length === 0) {
      return { summary: "Sem dados", emoji: "😐", percentagePositive: 0, text: "Sem comentários carregados." };
    }

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    let totalScore = 0;

    comments.forEach(c => {
      const text = c.text || c;
      const result = this.analyzeSentiment(text);
      totalScore += result.score;

      if (result.sentiment === "positive") positiveCount++;
      else if (result.sentiment === "negative") negativeCount++;
      else neutralCount++;
    });

    const total = comments.length;
    const pctPositive = Math.round((positiveCount / total) * 100);
    const pctNegative = Math.round((negativeCount / total) * 100);
    const avgScore = totalScore / total;

    let summary = "Neutro";
    let emoji = "😐";
    let text = `Audiência predominantemente neutra (${pctPositive}% positivo, ${pctNegative}% negativo).`;

    if (avgScore > 0.2) {
      summary = "Muito Positivo";
      emoji = "😍";
      text = `Excelente engajamento! ${pctPositive}% de sentimentos positivos e de apoio.`;
    } else if (avgScore > 0.05) {
      summary = "Positivo";
      emoji = "😊";
      text = `Feedback amplamente receptivo com ${pctPositive}% de comentários positivos.`;
    } else if (avgScore < -0.2) {
      summary = "Negativo";
      emoji = "😡";
      text = `Alerta: Alto índice de insatisfação. ${pctNegative}% de comentários negativos.`;
    } else if (avgScore < -0.05) {
      summary = "Preocupante";
      emoji = "😟";
      text = `Sinais de descontentamento com ${pctNegative}% de comentários negativos.`;
    }

    return {
      summary: summary,
      emoji: emoji,
      percentagePositive: pctPositive,
      percentageNegative: pctNegative,
      averageScore: avgScore,
      text: text
    };
  }
}

// Attach to window
window.SentimentAnalyzer = SentimentAnalyzer;
