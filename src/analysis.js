const YahooFinance = require('yahoo-finance2').default;

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Curated economic moat / profile for our tracked blue-chip assets
const COMPANY_MOATS = {
  NVDA: 'Світовий лідер ШІ-прискорювачів та графічних процесорів із закритою екосистемою CUDA.',
  AAPL: 'Глобальна екосистема преміум-пристроїв та сервісів із понад 2 млрд активних девайсів.',
  MSFT: 'Лідер хмарних обчислень (Azure), корпоративного софту та головний партнер OpenAI.',
  AMZN: 'Беззаперечний лідер хмарної інфраструктури (AWS) та найбільший маркетплейс Заходу.',
  GOOGL: 'Монополіст світового пошуку (90%+ ринку), лідер відеострімінгу (YouTube) та інфраструктури ШІ.',
  META: 'Найбільша соціальна мережа світу (понад 3.2 млрд активних користувачів щодня в IG, WhatsApp, FB).',
  TSLA: 'Лідер ринку електромобілів, технологій автономного водіння (FSD) та енергетичних сховищ.',
  AMD: 'Головний конкурент Intel та Nvidia на ринку процесорів (x86) та ШІ-чипів Instinct.',
  INTC: 'Традиційний гігант ПК- та серверних процесорів, який трансформується у контрактного виробника.',
  TSM: 'Найбільший контрактний виробник чипів у світі (фізично виготовляє понад 90% передових чипів світу).',
  AVGO: 'Ключовий постачальник мережевих мікросхем та кастомних чипів для дата-центрів ШІ.',
  ARM: 'Монополіст процесорної архітектури для 99% смартфонів світу та нових енергоефективних ШІ-ноутбуків.',
  ASML: 'Абсолютний монополіст 100% ринку EUV-літографії — без їхніх машин неможливе виробництво передових чипів.',
  CRWD: 'Лідер сучасної хмарної кібербезпеки на базі штучного інтелекту (платформа Falcon).',
  PANW: 'Провідний світовий постачальник комплексних корпоративних мережевих систем кіберзахисту.',
  V: 'Найбільша платіжна система світу, що забезпечує глобальну фінансову інфраструктуру.',
  MA: 'Глобальний дуополіст безготівкових транзакцій із надвисокою маржинальністю бізнесу.',
  SAP: 'Головний IT-гігант Європи: софт для керування бізнесом, через який проходить 87% світової торгівлі.',
  NVO: 'Найдорожча компанія Європи, творець революційних препаратів Ozempic та Wegovy.',
  VGK: 'Широкий європейський індексний фонд (ETF від Vanguard), що відстежує понад 600 компаній із 17 країн Європи.'
};

/**
 * Standard Wilder's RSI (14 periods)
 */
function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(1);
}

/**
 * Fetch and analyze stock by ticker symbol
 */
async function analyzeStock(symbol) {
  const ticker = symbol.trim().toUpperCase();

  try {
    // 1. Fetch quote
    const quote = await yf.quote(ticker);
    if (!quote || quote.regularMarketPrice === undefined) {
      return { success: false, error: `Дані для ${ticker} не знайдено` };
    }

    const currentPrice = quote.regularMarketPrice;
    const currency = quote.currency || 'USD';
    const name = quote.shortName || quote.longName || ticker;
    const dayChangePercent = quote.regularMarketChangePercent !== undefined 
      ? +quote.regularMarketChangePercent.toFixed(2) 
      : 0;
    const exchange = quote.exchange || 'US';

    // 2. Fetch summary modules
    let targetPrice = null;
    let targetLowPrice = null;
    let targetHighPrice = null;
    let numberOfAnalystOpinions = null;
    let recommendation = 'Немає даних';
    let recommendationScore = null;
    let pe = null;
    let dividendYield = null;
    let profitMargin = null;
    let high52 = null;
    let low52 = null;

    try {
      const summary = await yf.quoteSummary(ticker, {
        modules: ['financialData', 'summaryDetail', 'defaultKeyStatistics']
      });

      if (summary) {
        if (summary.financialData) {
          targetPrice = summary.financialData.targetMeanPrice || null;
          targetLowPrice = summary.financialData.targetLowPrice || null;
          targetHighPrice = summary.financialData.targetHighPrice || null;
          numberOfAnalystOpinions = summary.financialData.numberOfAnalystOpinions || null;
          recommendation = summary.financialData.recommendationKey || 'N/A';
          recommendationScore = summary.financialData.recommendationMean || null;
          profitMargin = summary.financialData.profitMargins !== undefined
            ? +(summary.financialData.profitMargins * 100).toFixed(1)
            : null;
        }
        if (summary.summaryDetail) {
          pe = summary.summaryDetail.forwardPE || summary.summaryDetail.trailingPE || null;
          if (pe) pe = +pe.toFixed(1);
          dividendYield = summary.summaryDetail.dividendYield !== undefined 
            ? +(summary.summaryDetail.dividendYield * 100).toFixed(2) 
            : null;
          high52 = summary.summaryDetail.fiftyTwoWeekHigh || null;
          low52 = summary.summaryDetail.fiftyTwoWeekLow || null;
        }
      }
    } catch (e) {
      // Some OTC or ETF tickers may not have all summary modules
    }

    // 3. Fetch chart candles for RSI and peak drawdown
    let rsi = null;
    let peak30d = currentPrice;
    let drawdownFromPeak = 0;

    try {
      const chartData = await yf.chart(ticker, {
        period1: new Date(Date.now() - 60 * 24 * 3600 * 1000),
        interval: '1d'
      });

      if (chartData && chartData.quotes && chartData.quotes.length > 0) {
        const closes = chartData.quotes
          .map(q => q.close)
          .filter(val => typeof val === 'number' && !isNaN(val));

        if (closes.length >= 15) {
          rsi = calculateRSI(closes, 14);
        }

        // Peak over the last 30 closes
        const recentCloses = closes.slice(-30);
        if (recentCloses.length > 0) {
          peak30d = Math.max(...recentCloses);
          drawdownFromPeak = +(((peak30d - currentPrice) / peak30d) * 100).toFixed(2);
        }
      }
    } catch (e) {
      console.warn(`Chart fetch warning for ${ticker}:`, e.message);
    }

    // 4. Calculate Upside Potential
    let upsidePercent = null;
    if (targetPrice && currentPrice > 0) {
      upsidePercent = +(((targetPrice - currentPrice) / currentPrice) * 100).toFixed(1);
    }

    // 5. Evaluate Signal Condition
    const isDip = drawdownFromPeak >= 7 || dayChangePercent <= -3.0 || (rsi !== null && rsi <= 42);
    const hasSolidUpside = upsidePercent !== null && upsidePercent >= 10;
    const isQualityRec = !['sell', 'underperform'].includes(recommendation.toLowerCase());

    let signalType = 'NONE';
    let isBuyOpportunity = false;

    if (hasSolidUpside && isDip && isQualityRec) {
      isBuyOpportunity = true;
      if (upsidePercent >= 20 && ((rsi !== null && rsi <= 35) || drawdownFromPeak >= 15)) {
        signalType = 'STRONG_BUY';
      } else {
        signalType = 'DIP_BUY';
      }
    }

    const moat = COMPANY_MOATS[ticker] || null;

    return {
      success: true,
      ticker,
      name,
      currency,
      exchange,
      currentPrice,
      dayChangePercent,
      rsi,
      peak30d,
      drawdownFromPeak,
      targetPrice,
      targetLowPrice,
      targetHighPrice,
      numberOfAnalystOpinions,
      upsidePercent,
      recommendation,
      recommendationScore,
      pe,
      profitMargin,
      dividendYield,
      high52,
      low52,
      signalType,
      isBuyOpportunity,
      moat
    };
  } catch (err) {
    return { success: false, error: err.message, ticker };
  }
}

module.exports = {
  calculateRSI,
  analyzeStock
};
