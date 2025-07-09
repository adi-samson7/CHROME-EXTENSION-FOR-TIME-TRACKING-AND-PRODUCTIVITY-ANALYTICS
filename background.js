// Tracked state
let currentTab = {
  id: null,
  url: null,
  hostname: null
};

// Timing control
let trackingInterval = null;
let lastUpdateTimestamp = null;

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

// Core tracking function
async function updateTimeTracking() {
  if (!currentTab.hostname) {
    debugLog('No valid hostname to track');
    return;
  }

  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  if (!lastUpdateTimestamp) {
    lastUpdateTimestamp = now;
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
    
    lastUpdateTimestamp = now - ((now - lastUpdateTimestamp) % 1000);
  }
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
  
  // Use both alarms and intervals for reliability
  trackingInterval = setInterval(updateTimeTracking, 1000);
  chrome.alarms.create('timeTracker', { periodInMinutes: 1/60 });
}

function stopTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  chrome.alarms.clear('timeTracker');
  debugLog('Tracking stopped');
}

// Tab event handlers
async function handleTabUpdate(tabId, url) {
  const hostname = getHostname(url);
  
  if (hostname === currentTab.hostname && tabId === currentTab.id) {
    debugLog('Same hostname, no change needed');
    return;
  }

  debugLog('Tab changed - previous:', currentTab.hostname, 'new:', hostname);
  
  // Finalize previous tracking
  await updateTimeTracking();
  stopTracking();

  // Update current tab
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
    updateTimeTracking();
  }
});

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timeData: {} });
  debugLog('Storage initialized');
});

chrome.runtime.onStartup.addListener(() => {
  debugLog('Extension started');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      handleTabUpdate(tabs[0].id, tabs[0].url);
    }
  });
});