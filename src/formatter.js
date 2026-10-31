/**
 * Formats stock analysis into Telegram-friendly text (HTML)
 */

function formatRecommendation(rec) {
  switch ((rec || '').toLowerCase()) {
    case 'strong_buy':
      return '🟢 Сильна покупка (Strong Buy)';
    case 'buy':
      return '🟢 Покупка (Buy)';
    case 'hold':
      return '🟡 Утримувати (Hold)';
    case 'underperform':
      return '🟠 Гірше ринку (Underperform)';
    case 'sell':
      return '🔴 Продаж (Sell)';
    default:
      return rec || 'Немає даних';
  }
}

function formatRSI(rsi) {
  if (rsi === null || rsi === undefined) return 'Н/Д';
  if (rsi <= 30) return `${rsi} 🔥 (Глибока перепроданість — зона сильного відскоку)`;
  if (rsi <= 40) return `${rsi} ⚡ (Зона перепроданості — підвищений шанс розвороту)`;
  if (rsi >= 70) return `${rsi} ⚠️ (Перекупленість — ціна на піку)`;
  return `${rsi} (Нейтральна зона)`;
}

function formatPE(pe) {
  if (!pe || pe <= 0) return null;
  let status = '';
  if (pe < 15) {
    status = '🟢 Дуже дешево (окупність до 15 років, глибока знижка)';
  } else if (pe <= 25) {
    status = '🟢 Комфортна ціна (адекватна оцінка для стійкого гіганта)';
  } else if (pe <= 35) {
    status = '🟡 Помірна оцінка (стандарт для зростаючого Tech-бізнесу)';
  } else {
    status = '🟠 Висока оцінка (ринок закладає надвисокі темпи росту прибутку)';
  }
  return `<b>${pe}</b> [${status}]`;
}

function formatAlertMessage(data) {
  const isStrong = data.signalType === 'STRONG_BUY';
  const titleEmoji = isStrong ? '🔥' : '⚡';
  const titleText = isStrong ? 'СИЛЬНИЙ СИГНАЛ НА ПОКУПКУ' : 'СИГНАЛ НА ПОКУПКУ (ДИП)';

  const currencySign = data.currency === 'EUR' ? '€' : (data.currency === 'USD' ? '$' : data.currency);
  const daySign = data.dayChangePercent >= 0 ? `+${data.dayChangePercent}%` : `${data.dayChangePercent}%`;

  const peFormatted = formatPE(data.pe);

  // Targets range from Wall Street banks
  let targetRangeText = '';
  if (data.targetPrice) {
    const opinionsText = data.numberOfAnalystOpinions ? ` (${data.numberOfAnalystOpinions} інвестбанків)` : '';
    targetRangeText = `• Середня цільова ціна: <b>${currencySign}${data.targetPrice.toFixed(2)}</b> (Очікуваний ріст: <b>+${data.upsidePercent}%</b> 🚀)${opinionsText}`;
    if (data.targetLowPrice && data.targetHighPrice) {
      targetRangeText += `\n• Діапазон прогнозів: Мін <b>${currencySign}${data.targetLowPrice.toFixed(0)}</b> ⟷ Макс <b>${currencySign}${data.targetHighPrice.toFixed(0)}</b>`;
    }
  }

  // Economic Moat / Business Protection
  const moatSection = data.moat 
    ? `\n🛡 <b>Ринкова перевага компанії:</b>\n<i>${data.moat}</i>\n` 
    : '';

  // Profitability
  const marginText = data.profitMargin 
    ? `• Чиста рентабельність прибутку: <b>${data.profitMargin}%</b> (висока здатність генерувати чистий кеш)\n` 
    : '';

  return `
${titleEmoji} <b>${titleText}</b>: ${data.name} (<code>${data.ticker}</code>)
━━━━━━━━━━━━━━━━━━━━
📉 <b>Ціна та динаміка спаду:</b>
• Поточна ціна: <b>${currencySign}${data.currentPrice}</b> (${daySign})
• Спад від 30-денного піку: <b>-${data.drawdownFromPeak}%</b> (Пік: ${currencySign}${data.peak30d?.toFixed(2)})
• Індикатор RSI(14): <b>${formatRSI(data.rsi)}</b>

📊 <b>Оцінка аналітиків та надійність бізнесу:</b>
• Консенсус ринку: <b>${formatRecommendation(data.recommendation)}</b>
${targetRangeText}
${peFormatted ? `• Показник P/E (ціна до прибутку): ${peFormatted}\n` : ''}${marginText}${data.dividendYield ? `• Дивідендна дохідність: <b>${data.dividendYield}%</b>\n` : ''}• Діапазон 52 тижнів: ${currencySign}${data.low52} — ${currencySign}${data.high52}
${moatSection}
💡 <b>Чому це вигідно:</b>
Акція світового лідера торгується зі значним дисконтом, тоді як фінансові показники та консенсус банків залишаються позитивними.

🏛 <b>Interactive Brokers (IBKR):</b>
• Тікер для пошуку: <code>${data.ticker}</code> | Біржа: <b>${data.exchange}</b>
━━━━━━━━━━━━━━━━━━━━
<i>Ордери виставляйте вручну у вашому терміналі IBKR (TWS або IBKR Mobile).</i>
`.trim();
}

function formatStockCheckMessage(data) {
  const currencySign = data.currency === 'EUR' ? '€' : (data.currency === 'USD' ? '$' : data.currency);
  const daySign = data.dayChangePercent >= 0 ? `+${data.dayChangePercent}%` : `${data.dayChangePercent}%`;
  const peFormatted = formatPE(data.pe);

  let verdict = '';
  if (data.signalType === 'STRONG_BUY') {
    verdict = '🔥 <b>Вердикт: Відмінний момент для підбору на спаді (Strong Buy dip)!</b>';
  } else if (data.signalType === 'DIP_BUY') {
    verdict = '⚡ <b>Вердикт: Приваблива точка входу (Moderate Dip).</b>';
  } else {
    verdict = 'ℹ️ <b>Вердикт: Специфічного сигналу на купівлю наразі немає.</b> Акція торгується біля справедливих рівнів або на піку.';
  }

  const moatSection = data.moat 
    ? `\n🛡 <b>Про компанію:</b>\n<i>${data.moat}</i>\n` 
    : '';

  return `
📊 <b>АНАЛІЗ АКЦІЇ: ${data.name} (<code>${data.ticker}</code>)</b>
━━━━━━━━━━━━━━━━━━━━
💵 <b>Ціна:</b> ${currencySign}${data.currentPrice} (${daySign} за день)
📉 <b>Відкат від 30д-піку:</b> -${data.drawdownFromPeak}% (Пік: ${currencySign}${data.peak30d?.toFixed(2)})
⚡ <b>RSI(14):</b> ${formatRSI(data.rsi)}

🎯 <b>Оцінка аналітиків Волл-стріт:</b>
• Рекомендація: <b>${formatRecommendation(data.recommendation)}</b>
• Цільова ціна: <b>${currencySign}${data.targetPrice ? data.targetPrice.toFixed(2) : 'Н/Д'}</b> (Апсайд: <b>${data.upsidePercent !== null ? (data.upsidePercent >= 0 ? `+${data.upsidePercent}%` : `${data.upsidePercent}%`) : 'Н/Д'}</b>)
${peFormatted ? `• P/E (ціна/прибуток): ${peFormatted}\n` : ''}${data.profitMargin ? `• Маржа прибутку: <b>${data.profitMargin}%</b>\n` : ''}${data.dividendYield ? `• Дивіденди: <b>${data.dividendYield}%</b>\n` : ''}${moatSection}
${verdict}

🏛 <b>Interactive Brokers:</b> шукайте за символом <code>${data.ticker}</code> (${data.exchange})
`.trim();
}

function formatWatchlistMessage(watchlist, quotesMap = {}) {
  let text = `📋 <b>Ваш список спостереження (Watchlist):</b>\n\n`;

  for (const ticker of watchlist) {
    const q = quotesMap[ticker];
    if (q) {
      const sign = q.dayChangePercent >= 0 ? `+${q.dayChangePercent}%` : `${q.dayChangePercent}%`;
      const cur = q.currency === 'EUR' ? '€' : '$';
      const icon = q.dayChangePercent < -3 ? '📉' : (q.dayChangePercent > 2 ? '📈' : '🔹');
      text += `${icon} <b>${ticker}</b>: ${cur}${q.currentPrice} (<code>${sign}</code>)\n`;
    } else {
      text += `🔹 <b>${ticker}</b>\n`;
    }
  }

  text += `\n<i>Керування списком:</i>\n• Додати: <code>/add TICKER</code> (напр. <code>/add TSM</code>)\n• Видалити: <code>/del TICKER</code>\n• Детальний аналіз: <code>/check TICKER</code>`;
  return text;
}

module.exports = {
  formatAlertMessage,
  formatStockCheckMessage,
  formatWatchlistMessage
};
