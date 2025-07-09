let currentTabId = null;
let currentUrl = null;
let startTime = null;
let timer = null;

// Helper function to safely extract hostname
function getHostname(url) {
  if (!url) return null;
  
  // Skip Chrome/internal pages and extension URLs
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('file://') ||
      url.startsWith('edge://') ||
      url.includes('chrome.google.com/webstore') ||
      !url.includes('.')) {
    return null;
  }
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Skip localhost, invalid domains, and IP addresses
    if (!hostname || 
        hostname === 'localhost' ||
        hostname.endsWith('.local') ||
        !hostname.includes('.') ||
        /^(\d+\.){3}\d+$/.test(hostname)) {
      return null;
    }
    
    return hostname;
  } catch (e) {
    return null;
  }
}

// Update time for the current website
async function updateTime() {
  if (!currentTabId || !currentUrl) return;

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Check if day changed
  if (startTime && startTime.toISOString().split('T')[0] !== today) {
    // Reset for new day
    startTime = now;
    return;
  }

  if (!startTime) {
    startTime = now;
    return;
  }

  const elapsedSeconds = Math.floor((now - startTime) / 1000);
  startTime = now;

  const { timeData } = await chrome.storage.local.get(['timeData']);
  
  if (!timeData[today]) {
    timeData[today] = {}; // Auto-creates new day entry
  }
  
  timeData[today][currentUrl] = (timeData[today][currentUrl] || 0) + elapsedSeconds;
  
  await chrome.storage.local.set({ timeData });
}

// Handle tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  currentTabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(currentTabId);
  const hostname = getHostname(tab.url);
  
  // Always stop tracking first when switching tabs
  if (timer) {
    clearInterval(timer);
    await updateTime();
  }
  
  // Only start tracking if valid hostname
  currentUrl = hostname;
  startTime = hostname ? new Date() : null;
  
  if (hostname) {
    timer = setInterval(updateTime, 1000);
  }
});

// Handle URL changes in the same tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.url) {
    const hostname = getHostname(changeInfo.url);
    
    // Always stop tracking first when URL changes
    if (timer) {
      clearInterval(timer);
      await updateTime();
    }
    
    // Only start tracking if valid hostname
    currentUrl = hostname;
    startTime = hostname ? new Date() : null;
    
    if (hostname) {
      timer = setInterval(updateTime, 1000);
    }
  }
});

// Initialize when extension starts
chrome.storage.local.get(['timeData'], (result) => {
  if (!result.timeData) {
    chrome.storage.local.set({ timeData: {} });
  }
});

// Add this initialization check
chrome.runtime.onStartup.addListener(() => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  chrome.storage.local.get(['timeData'], (result) => {
    if (!result.timeData || !result.timeData[today]) {
      chrome.storage.local.set({ timeData: { [today]: {} } });
    }
  });
});