require('dotenv').config();
const http = require('http');
const { createBot } = require('./src/bot');
const { startScannerScheduler } = require('./src/scanner');

const BOT_TOKEN = (process.env.BOT_TOKEN || '').trim();
const INTERVAL_MINUTES = parseInt(process.env.SCAN_INTERVAL_MINUTES || '30', 10);
const PORT = process.env.PORT || 8080;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://stock-alert-bot-s9vc.onrender.com';

if (!BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN is missing! Please configure it in Environment variables.');
  process.exit(1);
}

// Lightweight HTTP server for Render health checks and keep-alive
http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', uptime: Math.round(process.uptime()) }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('IBKR Stock Alert Bot is active and running 24/7 on Render');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Health check server listening on 0.0.0.0:${PORT}`);
});

// Self-ping loop to prevent Render's free tier from going to sleep (every 4 minutes)
function startKeepAlive() {
  console.log(`⏱️ Keep-Alive loop activated for ${RENDER_EXTERNAL_URL} (every 4 min)`);
  setInterval(async () => {
    try {
      const res = await fetch(RENDER_EXTERNAL_URL);
      console.log(`[Keep-Alive Ping] Status: ${res.status} (prevents Render idle spin-down)`);
    } catch (e) {
      console.warn(`[Keep-Alive Warning]: ${e.message}`);
    }
  }, 4 * 60 * 1000);
}

// Catch transient errors so the process never crashes
process.on('unhandledRejection', (reason) => {
  console.error('[Process Warning] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process Warning] Uncaught Exception:', err);
});

async function main() {
  console.log('====================================================');
  console.log('🚀 Запуск Інвестиційного Telegram-бота для IBKR...');
  console.log('====================================================');

  // Start self-pinging to stay awake 24/7
  startKeepAlive();

  const bot = createBot(BOT_TOKEN);

  // Start background scanner
  startScannerScheduler(bot, INTERVAL_MINUTES);

  // Start bot long-polling with auto-restart on network glitch
  console.log('📡 Підключення до Telegram API...');
  while (true) {
    try {
      await bot.start({
        onStart: (botInfo) => {
          console.log(`✅ Бот успішно запущений!`);
          console.log(`🤖 Ім'я бота: @${botInfo.username} (${botInfo.first_name})`);
          console.log(`🕒 Інтервал фонового сканування: кожні ${INTERVAL_MINUTES} хв`);
          console.log(`👉 Відкрийте Telegram, знайдіть @${botInfo.username} та натисніть /start`);
          console.log('====================================================');
        }
      });
    } catch (err) {
      console.error('Telegram polling error, restarting in 5 seconds...', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
