let currentTab = {
  id: null,
  url: null,
  hostname: null
};

let trackingInterval = null;
let lastUpdateTimestamp = null;
let currentDay = null;
let dayCheckInterval = null;
const MIDNIGHT_ALARM_NAME = 'midnightTransition';

const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) console.log('[TimeTracker]', ...args);
}

function getHostname(url) {
  if (!url) return null;

  const invalidPatterns = [
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^about:/i,
    /^file:\/\//i,
    /^edge:\/\//i,
    /chrome\.google\.com\/webstore/i
  ];

  if (invalidPatterns.some(p => p.test(url))) return null;

  try {
    const { hostname } = new URL(url);
    return hostname.includes('.') ? hostname : null;
  } catch {
    return null;
  }
}

let syncQueue = {};
let syncTimeout = null;

function queueMongoSync(date, hostname, seconds) {
  const key = `${date}|${hostname}`;
  syncQueue[key] = (syncQueue[key] || 0) + seconds;

  if (!syncTimeout) {
    syncTimeout = setTimeout(() => {
      const payloads = Object.entries(syncQueue).map(([key, seconds]) => {
        const [date, site] = key.split('|');
        return { date, site, time: seconds };
      });

      debugLog('Sending to MongoDB:', payloads);
      fetch('http://localhost:4000/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloads[0]) 
      }).catch(err => {
        console.error('MongoDB sync failed:', err);
      });

      syncQueue = {};
      syncTimeout = null;
    }, 5000);
  }
}

async function updateTimeTracking() {
  if (!currentTab.hostname) return;

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (currentDay && currentDay !== today) {
    lastUpdateTimestamp = now;
    currentDay = today;
  }

  if (!lastUpdateTimestamp) {
    lastUpdateTimestamp = now;
    currentDay = today;
    return;
  }

  const elapsed = Math.floor((now - lastUpdateTimestamp) / 1000);
  if (elapsed > 0) {
    const { timeData = {} } = await chrome.storage.local.get(['timeData']);
    timeData[today] = timeData[today] || {};
    timeData[today][currentTab.hostname] =
      (timeData[today][currentTab.hostname] || 0) + elapsed;
    await chrome.storage.local.set({ timeData });

    debugLog(`Tracked ${elapsed}s on ${currentTab.hostname}`);

    queueMongoSync(today, currentTab.hostname, elapsed);

    lastUpdateTimestamp = now - ((now - lastUpdateTimestamp) % 1000);
  }
}

function setupMidnightAlarm() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 1, 0);

  chrome.alarms.create(MIDNIGHT_ALARM_NAME, {
    when: midnight.getTime(),
    periodInMinutes: 1440
  });
}

function checkDayChange() {
  const today = new Date().toISOString().split('T')[0];
  if (currentDay !== today) {
    handleDayChange(today);
  }
}

function handleDayChange(newDay) {
  currentDay = newDay;
  lastUpdateTimestamp = null;
  updateTimeTracking();
}

function startTracking() {
  stopTracking();

  if (!currentTab.hostname) return;

  debugLog('Start tracking:', currentTab.hostname);
  lastUpdateTimestamp = null;
  currentDay = new Date().toISOString().split('T')[0];

  trackingInterval = setInterval(updateTimeTracking, 1000);
  chrome.alarms.create('timeTracker', { periodInMinutes: 1 / 60 });

  if (!dayCheckInterval) {
    dayCheckInterval = setInterval(checkDayChange, 5 * 60 * 1000);
  }
}

function stopTracking() {
  clearInterval(trackingInterval);
  trackingInterval = null;
  chrome.alarms.clear('timeTracker');
}

async function handleTabUpdate(tabId, url) {
  const hostname = getHostname(url);
  if (hostname === currentTab.hostname && tabId === currentTab.id) return;

  await updateTimeTracking();
  stopTracking();

  currentTab = { id: tabId, url, hostname };

  if (hostname) startTracking();
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  handleTabUpdate(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === currentTab.id && changeInfo.url) {
    handleTabUpdate(tabId, changeInfo.url);
  }
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'timeTracker') {
    const today = new Date().toISOString().split('T')[0];
    if (currentDay !== today) handleDayChange(today);
    updateTimeTracking();
  } else if (alarm.name === MIDNIGHT_ALARM_NAME) {
    handleDayChange(new Date().toISOString().split('T')[0]);
    setupMidnightAlarm();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timeData: {} });
  currentDay = new Date().toISOString().split('T')[0];
  setupMidnightAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  currentDay = new Date().toISOString().split('T')[0];
  setupMidnightAlarm();
  dayCheckInterval = setInterval(checkDayChange, 5 * 60 * 1000);

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      handleTabUpdate(tabs[0].id, tabs[0].url);
    }
  });
});

chrome.runtime.onSuspend.addListener(() => {
  clearInterval(dayCheckInterval);
  dayCheckInterval = null;
});