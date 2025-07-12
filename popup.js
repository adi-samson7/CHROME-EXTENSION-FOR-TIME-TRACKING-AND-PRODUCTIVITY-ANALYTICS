document.addEventListener('DOMContentLoaded', () => {
  const timeCounter = document.getElementById('time-counter');
  const currentWebsite = document.getElementById('current-website');
  const analyticsButton = document.getElementById('view-analytics');
  
  function getHostname(url) {
    if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
      return null;
    }
    try {
      return new URL(url).hostname;
    } catch (e) {
      return null;
    }
  }

  function displayWebsiteName(url) {
  if (!url) return "No active website";
  
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname) {
      return urlObj.hostname;
    }
  } catch (e) {
    return "Invalid website";
  }
  return "Not trackable";
  }
  


  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  if (tabs[0]) {
    const hostname = getHostname(tabs[0].url);
    currentWebsite.textContent = hostname || "No trackable website";
    
    if (!hostname) {
      timeCounter.textContent = "00:00:00";
    }
  }
});
  
  setInterval(async () => {
    const { timeData } = await chrome.storage.local.get(['timeData']);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTab = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (currentTab[0]) {
      const currentUrl = new URL(currentTab[0].url).hostname;
      const secondsSpent = timeData?.[today]?.[currentUrl] || 0;
      
      const hours = Math.floor(secondsSpent / 3600);
      const minutes = Math.floor((secondsSpent % 3600) / 60);
      const seconds = secondsSpent % 60;
      
      timeCounter.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
  
  analyticsButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('analytics.html') });
  });

  document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  });


});

