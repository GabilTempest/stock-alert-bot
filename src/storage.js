const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist.json');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');
const ALERTS_HISTORY_FILE = path.join(DATA_DIR, 'alerts_history.json');

// Comprehensive Watchlist: Tech Giants + Foundry/AI Hardware + Cybersecurity + Fintech + European Titans/ETFs
const DEFAULT_WATCHLIST = [
  // 1. Tech & AI Mega-Caps
  'NVDA',
  'AAPL',
  'MSFT',
  'AMZN',
  'GOOGL',
  'META',
  'TSLA',
  'AMD',
  'INTC',

  // 2. Semiconductor Foundation & AI Hardware
  'TSM',   // Taiwan Semiconductor (Foundry for NVDA, AAPL, AMD)
  'AVGO',  // Broadcom (Networking & Custom AI Silicon)
  'ARM',   // Arm Holdings (Processor Architecture for Mobile & AI)
  'ASML',  // ASML (Monopoly in EUV Lithography)

  // 3. Diversification: Cybersecurity & Fintech
  'CRWD',  // CrowdStrike (Modern Cloud Security)
  'PANW',  // Palo Alto Networks (Enterprise Cyber Defense)
  'V',     // Visa (Fintech & Global Payments)
  'MA',    // Mastercard (Fintech & Global Payments)

  // 4. European Giants & S&P 500 Analogs
  'SAP',   // SAP (European Software Leader)
  'NVO',   // Novo Nordisk (Europe's Largest Pharma/Biotech Titan)
  'VGK'    // Vanguard FTSE Europe ETF (Broad European Market Index)
];

function ensureDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadWatchlist() {
  ensureDirExists();
  try {
    if (fs.existsSync(WATCHLIST_FILE)) {
      const data = fs.readFileSync(WATCHLIST_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (err) {
    console.error('Error loading watchlist:', err.message);
  }
  saveWatchlist(DEFAULT_WATCHLIST);
  return DEFAULT_WATCHLIST;
}

function saveWatchlist(list) {
  ensureDirExists();
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function addTicker(ticker) {
  const symbol = ticker.trim().toUpperCase();
  const list = loadWatchlist();
  if (!list.includes(symbol)) {
    list.push(symbol);
    saveWatchlist(list);
    return { success: true, symbol, list };
  }
  return { success: false, reason: 'Вже у списку', symbol, list };
}

function removeTicker(ticker) {
  const symbol = ticker.trim().toUpperCase();
  let list = loadWatchlist();
  if (list.includes(symbol)) {
    list = list.filter(item => item !== symbol);
    saveWatchlist(list);
    return { success: true, symbol, list };
  }
  return { success: false, reason: 'Не знайдено у списку', symbol, list };
}

function loadSubscribers() {
  ensureDirExists();
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('Error loading subscribers:', err.message);
  }
  return [];
}

function addSubscriber(chatId, userInfo = {}) {
  const subscribers = loadSubscribers();
  const exists = subscribers.find(s => s.id === chatId);
  if (!exists) {
    subscribers.push({
      id: chatId,
      username: userInfo.username || null,
      firstName: userInfo.firstName || null,
      subscribedAt: new Date().toISOString()
    });
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2), 'utf-8');
    return true;
  }
  return false;
}

function loadAlertsHistory() {
  ensureDirExists();
  try {
    if (fs.existsSync(ALERTS_HISTORY_FILE)) {
      const data = fs.readFileSync(ALERTS_HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading alerts history:', err.message);
  }
  return {};
}

function canSendAlert(symbol, cooldownHours = 12) {
  const history = loadAlertsHistory();
  const lastAlertTime = history[symbol];
  if (!lastAlertTime) return true;
  const elapsedHours = (Date.now() - new Date(lastAlertTime).getTime()) / (1000 * 60 * 60);
  return elapsedHours >= cooldownHours;
}

function recordAlertSent(symbol) {
  const history = loadAlertsHistory();
  history[symbol] = new Date().toISOString();
  fs.writeFileSync(ALERTS_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

module.exports = {
  DEFAULT_WATCHLIST,
  loadWatchlist,
  saveWatchlist,
  addTicker,
  removeTicker,
  loadSubscribers,
  addSubscriber,
  canSendAlert,
  recordAlertSent
};
