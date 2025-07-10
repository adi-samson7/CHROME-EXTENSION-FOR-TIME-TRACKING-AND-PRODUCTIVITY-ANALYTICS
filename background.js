// Tracked state
let currentTab = {
  id: null,
  url: null,
  hostname: null
};

// Timing control
let trackingInterval = null;
let lastUpdateTimestamp = null;
let currentDay = null;
let dayCheckInterval = null;
const MIDNIGHT_ALARM_NAME = 'midnightTransition';

// Debug setup
const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) console.log('[TimeTracker]', ...args);
}

// Enhanced URL validation
function getHostname(url) {
  if (!url) {
    debugLog('No URL provided');
    return null;
  }

  const invalidPatterns = [
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^about:/i,
    /^file:\/\//i,
    /^edge:\/\//i,
    /chrome\.google\.com\/webstore/i
  ];

  if (invalidPatterns.some(pattern => pattern.test(url))) {
    debugLog('Invalid URL pattern:', url);
    return null;
  }

  try {
    const { hostname } = new URL(url);
    if (!hostname || !hostname.includes('.')) {
      debugLog('Invalid hostname:', hostname);
      return null;
    }
    return hostname;
  } catch (e) {
    debugLog('URL parse error:', e.message);
    return null;
  }
}

// Core tracking function with day-change detection
async function updateTimeTracking() {
  if (!currentTab.hostname) {
    debugLog('No valid hostname to track');
    return;
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Check for day change
  if (currentDay && currentDay !== today) {
    debugLog(`Day changed from ${currentDay} to ${today}, resetting timer`);
    lastUpdateTimestamp = now;
    currentDay = today;
  }

  if (!lastUpdateTimestamp) {
    lastUpdateTimestamp = now;
    currentDay = today;
    debugLog('Initial time tracking started for:', currentTab.hostname);
    return;
  }

  const elapsedSeconds = Math.floor((now - lastUpdateTimestamp) / 1000);
  
  if (elapsedSeconds > 0) {
    const { timeData = {} } = await chrome.storage.local.get(['timeData']);
    timeData[today] = timeData[today] || {};
    timeData[today][currentTab.hostname] = 
      (timeData[today][currentTab.hostname] || 0) + elapsedSeconds;

    await chrome.storage.local.set({ timeData });
    debugLog(`Tracked ${elapsedSeconds}s on ${currentTab.hostname}`);
    
    // Compensate for drift
    lastUpdateTimestamp = now - ((now - lastUpdateTimestamp) % 1000);
  }
}

// Configure midnight alarm
function setupMidnightAlarm() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 1, 0); // 00:00:01 next day

  chrome.alarms.create(MIDNIGHT_ALARM_NAME, {
    when: midnight.getTime(),
    periodInMinutes: 1440 // 24 hours
  });

  debugLog(`Midnight alarm set for ${midnight.toISOString()}`);
}

// Start/stop tracking
function startTracking() {
  stopTracking();
  
  if (!currentTab.hostname) {
    debugLog('Cannot start - no valid hostname');
    return;
  }

  debugLog('Starting tracking for:', currentTab.hostname);
  lastUpdateTimestamp = null;
  currentDay = new Date().toISOString().split('T')[0];
  
  trackingInterval = setInterval(updateTimeTracking, 1000);
  chrome.alarms.create('timeTracker', { periodInMinutes: 1/60 });
  
  // Start day checker if not running
  if (!dayCheckInterval) {
    dayCheckInterval = setInterval(checkDayChange, 5 * 60 * 1000); // Check every 5 minutes
  }
}

function stopTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  chrome.alarms.clear('timeTracker');
  debugLog('Tracking stopped');
}

// Day change detection
function checkDayChange() {
  const today = new Date().toISOString().split('T')[0];
  if (currentDay !== today) {
    debugLog(`Day check detected change: ${currentDay} → ${today}`);
    handleDayChange(today);
  }
}

function handleDayChange(newDay) {
  currentDay = newDay;
  lastUpdateTimestamp = null;
  
  // Force save current time before resetting
  updateTimeTracking().then(() => {
    debugLog(`Day transition to ${newDay} completed`);
  });
}

// Tab event handlers
async function handleTabUpdate(tabId, url) {
  const hostname = getHostname(url);
  
  if (hostname === currentTab.hostname && tabId === currentTab.id) {
    debugLog('Same hostname, no change needed');
    return;
  }

  debugLog('Tab changed - previous:', currentTab.hostname, 'new:', hostname);
  
  await updateTimeTracking();
  stopTracking();

  currentTab = {
    id: tabId,
    url,
    hostname
  };

  if (hostname) {
    startTracking();
  }
}

// Event listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabUpdate(activeInfo.tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === currentTab.id && changeInfo.url) {
    handleTabUpdate(tabId, changeInfo.url);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timeTracker') {
    const today = new Date().toISOString().split('T')[0];
    if (currentDay !== today) {
      debugLog('Day changed during normal tracking');
      handleDayChange(today);
    }
    updateTimeTracking();
  }
  else if (alarm.name === MIDNIGHT_ALARM_NAME) {
    const today = new Date().toISOString().split('T')[0];
    debugLog(`MIDNIGHT ALARM TRIGGERED at ${new Date().toISOString()}`);
    if (currentDay !== today) {
      handleDayChange(today);
    }
    setupMidnightAlarm(); // Reschedule for next day
  }
});

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timeData: {} });
  currentDay = new Date().toISOString().split('T')[0];
  debugLog('Storage initialized');
  setupMidnightAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  currentDay = new Date().toISOString().split('T')[0];
  debugLog('Extension started');
  
  // Start all tracking systems
  setupMidnightAlarm();
  dayCheckInterval = setInterval(checkDayChange, 5 * 60 * 1000);
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      handleTabUpdate(tabs[0].id, tabs[0].url);
    }
  });
});

chrome.runtime.onSuspend.addListener(() => {
  clearInterval(dayCheckInterval);
  dayCheckInterval = null;
});

// Add to background.js
async function generateWeeklyReport() {
  const { timeData = {}, websiteClassifications = {} } = await chrome.storage.local.get([
    'timeData',
    'websiteClassifications'
  ]);

  const report = {
    productive: 0,
    unproductive: 0,
    neutral: 0,
    byDay: {},
    topSites: []
  };

  // Get last 7 days
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  // Analyze each day
  dates.forEach(date => {
    report.byDay[date] = { productive: 0, unproductive: 0 };
    
    Object.entries(timeData[date] || {}).forEach(([site, seconds]) => {
      const category = websiteClassifications.productive?.includes(site) ? 'productive' :
                      websiteClassifications.unproductive?.includes(site) ? 'unproductive' : 'neutral';
      
      report[category] += seconds;
      report.byDay[date][category] += seconds;
    });
  });

  // Calculate top sites
  const allSites = {};
  dates.forEach(date => {
    Object.entries(timeData[date] || {}).forEach(([site, seconds]) => {
      allSites[site] = (allSites[site] || 0) + seconds;
    });
  });
  report.topSites = Object.entries(allSites)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([site, seconds]) => ({
      site,
      time: seconds,
      category: websiteClassifications.productive?.includes(site) ? 'productive' :
               websiteClassifications.unproductive?.includes(site) ? 'unproductive' : 'neutral'
    }));

  return report;
}
