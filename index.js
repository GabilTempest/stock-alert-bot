require('dotenv').config();
const http = require('http');
const { createBot } = require('./src/bot');
const { startScannerScheduler } = require('./src/scanner');

const BOT_TOKEN = (process.env.BOT_TOKEN || '').trim();
const INTERVAL_MINUTES = parseInt(process.env.SCAN_INTERVAL_MINUTES || '30', 10);
const PORT = process.env.PORT || 8080;

if (!BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN is missing! Please configure it in Environment variables.');
  process.exit(1);
}

// Lightweight HTTP server for Render/cloud deployment health checks
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('IBKR Stock Alert Bot is active and running 24/7 on Render');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Health check server listening on 0.0.0.0:${PORT}`);
});

async function main() {
  console.log('====================================================');
  console.log('🚀 Запуск Інвестиційного Telegram-бота для IBKR...');
  console.log('====================================================');

  const bot = createBot(BOT_TOKEN);

  // Start background scanner
  startScannerScheduler(bot, INTERVAL_MINUTES);

  // Start bot long-polling
  console.log('📡 Підключення до Telegram API...');
  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Бот успішно запущений!`);
      console.log(`🤖 Ім'я бота: @${botInfo.username} (${botInfo.first_name})`);
      console.log(`🕒 Інтервал фонового сканування: кожні ${INTERVAL_MINUTES} хв`);
      console.log(`👉 Відкрийте Telegram, знайдіть @${botInfo.username} та натисніть /start`);
      console.log('====================================================');
    }
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
