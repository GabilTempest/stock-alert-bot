const cron = require('node-cron');
const {
  loadWatchlist,
  loadSubscribers,
  canSendAlert,
  recordAlertSent
} = require('./storage');
const { analyzeStock } = require('./analysis');
const { formatAlertMessage } = require('./formatter');

/**
 * Perform one full scan cycle of the watchlist
 */
async function runScanCycle(bot) {
  console.log(`[${new Date().toISOString()}] Starting scheduled market scan...`);
  const watchlist = loadWatchlist();
  const subscribers = loadSubscribers();

  if (subscribers.length === 0) {
    console.log('No subscribers registered yet. Open the bot and press /start to receive alerts.');
    return;
  }

  for (const ticker of watchlist) {
    try {
      const res = await analyzeStock(ticker);

      if (res.success && res.isBuyOpportunity) {
        // Check cooldown (e.g. at most 1 alert every 12 hours for the same ticker)
        if (canSendAlert(ticker, 12)) {
          console.log(`[SIGNAL] Buy opportunity detected for ${ticker}! Dispatching alerts...`);
          const message = formatAlertMessage(res);

          for (const sub of subscribers) {
            try {
              await bot.api.sendMessage(sub.id, message, { parse_mode: 'HTML' });
            } catch (err) {
              console.error(`Failed to send alert to user ${sub.id}:`, err.message);
            }
          }

          recordAlertSent(ticker);
        } else {
          console.log(`[COOLDOWN] Signal for ${ticker} active, but alert was sent recently.`);
        }
      }

      // Friendly delay between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (e) {
      console.error(`Error in scanner for ${ticker}:`, e.message);
    }
  }

  console.log(`[${new Date().toISOString()}] Market scan completed.`);
}

/**
 * Start the background cron scheduler
 * Default: every 30 minutes from 08:00 to 22:00 UTC (covering European and US market hours)
 */
function startScannerScheduler(bot, intervalMinutes = 30) {
  // Run an initial scan 10 seconds after startup
  setTimeout(() => {
    runScanCycle(bot).catch(console.error);
  }, 10000);

  // Every N minutes
  const cronExpression = `*/${intervalMinutes} * * * *`;
  console.log(`Market scanner scheduled with expression: "${cronExpression}"`);

  cron.schedule(cronExpression, () => {
    runScanCycle(bot).catch(console.error);
  });
}

module.exports = {
  runScanCycle,
  startScannerScheduler
};
