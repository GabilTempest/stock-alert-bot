require('dotenv').config();
const { analyzeStock } = require('./src/analysis');
const { formatAlertMessage } = require('./src/formatter');
const { loadWatchlist, loadSubscribers } = require('./src/storage');

const BOT_TOKEN = process.env.BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
  const data = await response.json();
  if (!data.ok) {
    console.error(`Telegram API error for chat ${chatId}:`, data.description);
  }
  return data;
}

async function runDailyDigest() {
  console.log(`[${new Date().toISOString()}] Starting Daily Market Scan...`);

  const watchlist = loadWatchlist();
  console.log(`Watchlist tickers (${watchlist.length}): ${watchlist.join(', ')}`);

  // Target subscribers
  let recipientIds = [];
  const subs = loadSubscribers();
  if (subs && subs.length > 0) {
    recipientIds = subs.map(s => s.id);
  }
  if (DEFAULT_CHAT_ID && !recipientIds.includes(+DEFAULT_CHAT_ID) && !recipientIds.includes(`${DEFAULT_CHAT_ID}`)) {
    recipientIds.push(DEFAULT_CHAT_ID);
  }

  console.log(`Sending digest to recipients: ${recipientIds.join(', ')}`);

  const buyOpportunities = [];
  const generalMarketStatus = [];

  for (const ticker of watchlist) {
    console.log(`Analyzing ${ticker}...`);
    try {
      const res = await analyzeStock(ticker);
      if (res.success) {
        if (res.isBuyOpportunity) {
          buyOpportunities.push(res);
        }
        generalMarketStatus.push({
          ticker: res.ticker,
          price: res.currentPrice,
          currency: res.currency === 'EUR' ? '€' : '$',
          change: res.dayChangePercent
        });
      }
      // Brief pause between requests
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`Failed to analyze ${ticker}:`, err.message);
    }
  }

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  if (buyOpportunities.length > 0) {
    // 1. Send header announcement
    const headerMsg = `
📅 <b>ЩОДЕННИЙ ДАЙДЖЕСТ АКЦІЙ (${dateFormatted} | 13:00 CET)</b>
━━━━━━━━━━━━━━━━━━━━
🎯 Знайдено <b>${buyOpportunities.length} акцій</b> у вигідній зоні покупки (дип + високий апсайд за оцінками аналітиків Волл-стріт)!

Нижче наведено детальні сигнали для відкриття ордерів в <b>Interactive Brokers</b> 👇
    `.trim();

    for (const chatId of recipientIds) {
      await sendTelegramMessage(chatId, headerMsg);
    }

    // 2. Send detailed card for each stock
    for (const opp of buyOpportunities) {
      const cardMsg = formatAlertMessage(opp);
      for (const chatId of recipientIds) {
        await sendTelegramMessage(chatId, cardMsg);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  } else {
    // Тихо: не турбуємо користувача, якщо немає вигідних точок входу
    console.log('No buy opportunities found today. Silent mode: no Telegram messages sent.');
  }

  console.log(`[${new Date().toISOString()}] Daily scan finished successfully!`);
}

runDailyDigest().catch(err => {
  console.error('Fatal error in daily scanner:', err);
  process.exit(1);
});
