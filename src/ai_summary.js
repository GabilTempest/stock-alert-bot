const YahooFinance = require('yahoo-finance2').default;

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/**
 * Fetch latest news headlines for a ticker from Yahoo Finance
 */
async function fetchStockNews(ticker) {
  try {
    const res = await yf.search(ticker, { newsCount: 3 });
    if (res && res.news && res.news.length > 0) {
      return res.news.slice(0, 3).map(n => ({
        title: n.title,
        publisher: n.publisher,
        link: n.link
      }));
    }
  } catch (err) {
    console.warn(`Could not fetch news for ${ticker}:`, err.message);
  }
  return [];
}

/**
 * Call Google Gemini API if GEMINI_API_KEY is available
 */
async function generateGeminiSummary(ticker, name, dropPercent, newsList, apiKey) {
  const newsContext = newsList.map(n => `• "${n.title}" (${n.publisher})`).join('\n');
  const prompt = `
Ти професійний фінансовий AI-аналітик для інвестора в Interactive Brokers.
Акція світового гіганта ${name} (${ticker}) зараз просіла на ${dropPercent}%.
Ось останні новини щодо компанії:
${newsContext || 'Останніх специфічних негативних новин немає, загальний ринковий відкат або фіксація прибутку.'}

Напиши РІВНО 1-2 КОРОТКИХ речення українською мовою:
1) Ймовірна причина спаду (на фоні новин або загального сектору).
2) Короткий висновок: чи є це тимчасовою просадкою якісного бізнесу.
Пиши простою, живою мовою без води. Не використовуй англійських слів, крім тікера.
  `.trim();

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 250
        }
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    }
  } catch (e) {
    console.error('Gemini API call failed:', e.message);
  }
  return null;
}

/**
 * Smart Fallback when GEMINI_API_KEY is not set
 */
function generateSmartNewsExplanation(ticker, name, dropPercent, newsList) {
  if (newsList && newsList.length > 0) {
    const topNews = newsList[0];
    return `Корекція на тлі ринкового новинного фону: «${topNews.title}» (${topNews.publisher}). Для лідера індустрії це зазвичай відкриває вікно для вигідного підбору позиції за зниженою ціною.`;
  }
  return `Падіння відбувається в межах загальної корекції технологічного сектору або фіксації прибутку великими фондами, фундаментальні показники залишаються сильними.`;
}

/**
 * Get AI analysis sentence
 */
async function getStockAIAnalysis(ticker, name, dropPercent) {
  const newsList = await fetchStockNews(ticker);
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    const aiText = await generateGeminiSummary(ticker, name, dropPercent, newsList, geminiKey);
    if (aiText) return aiText;
  }

  return generateSmartNewsExplanation(ticker, name, dropPercent, newsList);
}

module.exports = {
  fetchStockNews,
  getStockAIAnalysis
};
