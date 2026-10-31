const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const {
  loadWatchlist,
  addTicker,
  removeTicker,
  addSubscriber,
  loadSubscribers
} = require('./storage');
const { analyzeStock } = require('./analysis');
const {
  formatAlertMessage,
  formatStockCheckMessage,
  formatWatchlistMessage
} = require('./formatter');

function createBot(token) {
  const bot = new Bot(token);

  // Main reply keyboard (convenient buttons at the bottom of the chat)
  const mainKeyboard = new Keyboard()
    .text('🔍 Знайти сигнали зараз').text('📋 Мій Watchlist').row()
    .text('⚡ Тест сповіщення').text('❓ Допомога')
    .resized();

  // Helper for registering subscribers
  function registerUser(ctx) {
    if (ctx.from && ctx.chat) {
      addSubscriber(ctx.chat.id, {
        username: ctx.from.username,
        firstName: ctx.from.first_name
      });
    }
  }

  // /start command
  bot.command('start', async (ctx) => {
    registerUser(ctx);

    const welcomeText = `
👋 <b>Вітаю у боті моніторингу акцій для Interactive Brokers!</b>

Я постійно відстежую ринок та світові гіганти (S&P 500, NASDAQ, європейські лідери типу ASML, SAP) і <b>надсилаю сповіщення</b>, коли надійна акція переживає суттєвий спад ціни (дип), має низький RSI та високий потенціал росту за оцінками аналітиків Волл-стріт.

Ваш ID успішно підключено до автоматичних сповіщень! 🔔

👇 <b>Швидкі дії:</b>
• Натисніть <b>«🔍 Знайти сигнали зараз»</b> для сканування ринку.
• Натисніть <b>«📋 Мій Watchlist»</b> для перегляду ваших акцій.
• Напишіть <code>/check TICKER</code> (наприклад <code>/check NVDA</code> або <code>/check INTC</code>) для аналізу будь-якої компанії.
    `.trim();

    await ctx.reply(welcomeText, {
      parse_mode: 'HTML',
      reply_markup: mainKeyboard
    });
  });

  // /help command
  bot.command('help', async (ctx) => {
    registerUser(ctx);

    const helpText = `
📖 <b>Довідка та команди бота:</b>

<b>Основні команди:</b>
• <code>/signals</code> — Просканувати ваш Watchlist прямо зараз та знайти акції для покупки на спаді.
• <code>/watchlist</code> — Переглянути список відстежуваних акцій та їхні ціни.
• <code>/add TICKER</code> — Додати акцію (наприклад: <code>/add INTC</code>, <code>/add ASML</code>, <code>/add MSFT</code>).
• <code>/del TICKER</code> — Видалити акцію зі списку.
• <code>/check TICKER</code> — Миттєвий фундаментальний та технічний аналіз будь-якої акції.
• <code>/testalert</code> — Отримати зразок сповіщення.

🧠 <b>Як бот визначає, що акцію варто купити:</b>
1. <b>Фільтр якості:</b> високий консенсус аналітиків (Buy / Strong Buy) та потенціал росту від <b>+10%</b> до цільової ціни.
2. <b>Тригер дипу:</b> просадка від 30-денного піку ≥ 7-10% АБО падіння за день ≥ 3-4% АБО індикатор <b>RSI(14) ≤ 40</b> (зона перепроданості).

🏛 <b>Interactive Brokers:</b>
Отримавши сигнал, відкрийте додаток <i>IBKR Mobile</i> або <i>Trader Workstation (TWS)</i>, введіть тікер і відкрийте ордер на покупку.
    `.trim();

    await ctx.reply(helpText, {
      parse_mode: 'HTML',
      reply_markup: mainKeyboard
    });
  });

  // /signals command & Button "🔍 Знайти сигнали зараз"
  async function handleSignals(ctx) {
    registerUser(ctx);
    const statusMsg = await ctx.reply('⏳ Сканую ринок та аналізую ваш Watchlist (це займе кілька секунд)...');

    const watchlist = loadWatchlist();
    const opportunities = [];

    for (const ticker of watchlist) {
      try {
        const result = await analyzeStock(ticker, { includeAI: true });
        if (result.success && result.isBuyOpportunity) {
          opportunities.push(result);
        }
      } catch (e) {
        console.error(`Error scanning ${ticker}:`, e.message);
      }
    }

    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (_) {}

    if (opportunities.length === 0) {
      await ctx.reply(
        'ℹ️ <b>Наразі активних сигналів на покупку немає.</b>\nВсі акції з вашого Watchlist торгуються без глибоких спадів або вже відскочили.\n\nБот автоматично повідомить вас, щойно з\'явиться вигідний дип!',
        { parse_mode: 'HTML', reply_markup: mainKeyboard }
      );
      return;
    }

    await ctx.reply(
      `🎯 <b>Знайдено ${opportunities.length} акцій у зоні вигідної покупки:</b>`,
      { parse_mode: 'HTML' }
    );

    for (const opp of opportunities) {
      const msg = formatAlertMessage(opp);
      await ctx.reply(msg, { parse_mode: 'HTML' });
    }
  }

  bot.command('signals', handleSignals);
  bot.hears('🔍 Знайти сигнали зараз', handleSignals);

  // /watchlist command & Button "📋 Мій Watchlist"
  async function handleWatchlist(ctx) {
    registerUser(ctx);
    const watchlist = loadWatchlist();

    const statusMsg = await ctx.reply('⏳ Оновлюю котирування...');

    const quotesMap = {};
    for (const ticker of watchlist) {
      try {
        const res = await analyzeStock(ticker);
        if (res.success) {
          quotesMap[ticker] = {
            currentPrice: res.currentPrice,
            dayChangePercent: res.dayChangePercent,
            currency: res.currency
          };
        }
      } catch (_) {}
    }

    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (_) {}

    const text = formatWatchlistMessage(watchlist, quotesMap);
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: mainKeyboard });
  }

  bot.command('watchlist', handleWatchlist);
  bot.hears('📋 Мій Watchlist', handleWatchlist);

  // /testalert command & Button "⚡ Тест сповіщення"
  async function handleTestAlert(ctx) {
    registerUser(ctx);
    await ctx.reply('🔔 Надсилаю тестовий сигнал...');
    const result = await analyzeStock('NVDA');
    if (result.success) {
      // Force signal display for testing
      result.signalType = result.signalType === 'NONE' ? 'DIP_BUY' : result.signalType;
      const msg = formatAlertMessage(result);
      await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: mainKeyboard });
    } else {
      await ctx.reply(`Помилка отримання даних: ${result.error}`);
    }
  }

  bot.command('testalert', handleTestAlert);
  bot.hears('⚡ Тест сповіщення', handleTestAlert);

  bot.hears('❓ Допомога', async (ctx) => {
    ctx.message.text = '/help';
    return bot.handleUpdate(ctx.update);
  });

  // /check <TICKER>
  bot.command('check', async (ctx) => {
    registerUser(ctx);
    const parts = (ctx.match || '').trim().split(/\s+/);
    const ticker = parts[0];

    if (!ticker) {
      return ctx.reply('⚠️ Вкажіть тікер для аналізу. Приклад: <code>/check INTC</code> або <code>/check NVDA</code>', {
        parse_mode: 'HTML'
      });
    }

    const waitMsg = await ctx.reply(`⏳ Завантажую аналітику для <b>${ticker.toUpperCase()}</b>...`, {
      parse_mode: 'HTML'
    });

    const result = await analyzeStock(ticker, { includeAI: true });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
    } catch (_) {}

    if (!result.success) {
      return ctx.reply(`❌ Не вдалося знайти інформацію про тікер <b>${ticker.toUpperCase()}</b>.\nПеревірте правильність написання або суфікс біржі (напр. <code>ASML</code> або <code>SAP</code>).`, {
        parse_mode: 'HTML'
      });
    }

    const text = formatStockCheckMessage(result);
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: mainKeyboard });
  });

  // /add <TICKER>
  bot.command('add', async (ctx) => {
    registerUser(ctx);
    const parts = (ctx.match || '').trim().split(/\s+/);
    const ticker = parts[0];

    if (!ticker) {
      return ctx.reply('⚠️ Вкажіть тікер компанії. Приклад: <code>/add INTC</code> або <code>/add ASML</code>', {
        parse_mode: 'HTML'
      });
    }

    const waitMsg = await ctx.reply(`⏳ Перевіряю тікер <b>${ticker.toUpperCase()}</b> на біржі...`, {
      parse_mode: 'HTML'
    });

    // Validate that stock exists
    const check = await analyzeStock(ticker);

    try {
      await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
    } catch (_) {}

    if (!check.success) {
      return ctx.reply(`❌ Тікер <b>${ticker.toUpperCase()}</b> не знайдено на ринку.\nПеревірте символ.`, {
        parse_mode: 'HTML'
      });
    }

    const res = addTicker(ticker);
    if (res.success) {
      await ctx.reply(`✅ Акцію <b>${res.symbol}</b> (${check.name}) успішно додано до вашого Watchlist!`, {
        parse_mode: 'HTML'
      });
    } else {
      await ctx.reply(`ℹ️ Тікер <b>${res.symbol}</b> вже присутній у вашому списку.`, {
        parse_mode: 'HTML'
      });
    }
  });

  // /del or /remove <TICKER>
  const handleDel = async (ctx) => {
    registerUser(ctx);
    const parts = (ctx.match || '').trim().split(/\s+/);
    const ticker = parts[0];

    if (!ticker) {
      return ctx.reply('⚠️ Вкажіть тікер для видалення. Приклад: <code>/del INTC</code>', {
        parse_mode: 'HTML'
      });
    }

    const res = removeTicker(ticker);
    if (res.success) {
      await ctx.reply(`🗑 Акцію <b>${res.symbol}</b> видалено зі списку моніторингу.`, {
        parse_mode: 'HTML'
      });
    } else {
      await ctx.reply(`ℹ️ Тікер <b>${res.symbol}</b> не знайдено у вашому списку.`, {
        parse_mode: 'HTML'
      });
    }
  };

  bot.command('del', handleDel);
  bot.command('remove', handleDel);

  // Catch-all for bare ticker names (e.g. user just types "NVDA" or "AAPL")
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next();

    // If text looks like a ticker symbol (1 to 6 uppercase letters/dots)
    if (/^[A-Za-z0-9\.\-]{1,8}$/.test(text) && !text.includes(' ')) {
      registerUser(ctx);
      const waitMsg = await ctx.reply(`⏳ Аналізую <b>${text.toUpperCase()}</b>...`, { parse_mode: 'HTML' });
      const result = await analyzeStock(text, { includeAI: true });
      try {
        await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
      } catch (_) {}

      if (result.success) {
        return ctx.reply(formatStockCheckMessage(result), { parse_mode: 'HTML', reply_markup: mainKeyboard });
      }
    }
    return next();
  });

  // Error handling
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}

module.exports = { createBot };
