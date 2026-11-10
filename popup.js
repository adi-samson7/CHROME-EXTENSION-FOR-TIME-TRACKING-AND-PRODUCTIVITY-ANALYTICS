document.addEventListener('DOMContentLoaded', () => {
  const timeCounter = document.getElementById('time-counter');
  const currentWebsite = document.getElementById('current-website');
  const statusEl = document.getElementById('tracking-status');
  const toggleButton = document.getElementById('toggle-tracking');
  const analyticsButton = document.getElementById('view-analytics');

  const statusText = document.getElementById('status-text');
  let current = { hostname: null, siteState: null };

  function formatTime(totalSeconds) {
    const s = totalSeconds || 0;
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return [hours, minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
  }

  function setButton(label, cls) {
    toggleButton.hidden = false;
    toggleButton.textContent = label;
    toggleButton.className = cls;
  }

  function render(status) {
    if (!status || status.error) {
      currentWebsite.textContent = 'Tracker unavailable';
      statusText.textContent = '';
      toggleButton.hidden = true;
      return;
    }

    current = { hostname: status.hostname, siteState: status.siteState };
    currentWebsite.textContent = status.hostname || 'No trackable website';
    timeCounter.textContent = formatTime(status.seconds);
    statusEl.className = 'tracking-status';

    if (!status.hostname) {
      toggleButton.hidden = true;
      statusText.textContent = 'This page cannot be tracked';
    } else if (status.siteState === 'new') {
      setButton('Start Tracking', 'btn-primary');
      statusText.textContent = 'Not started for this site';
    } else if (status.siteState === 'paused') {
      setButton('Resume Tracking', 'btn-primary');
      statusEl.classList.add('paused');
      statusText.textContent = 'Paused';
    } else {
      setButton('Pause Tracking', 'btn-danger');
      if (status.active) {
        statusEl.classList.add('active');
        statusText.textContent = 'Tracking';
      } else if (!status.focused) {
        statusText.textContent = 'Browser not focused';
      } else {
        statusText.textContent = 'Idle - timer stopped';
      }
    }
  }

  function send(message) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
        else resolve(response);
      });
    });
  }

  async function refresh() {
    render(await send({ type: 'getStatus' }));
  }

  toggleButton.addEventListener('click', async () => {
    if (!current.hostname) return;
    const state = current.siteState === 'tracking' ? 'paused' : 'tracking';
    toggleButton.disabled = true;
    render(await send({ type: 'setSiteState', hostname: current.hostname, state }));
    toggleButton.disabled = false;
  });

  analyticsButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('analytics.html') });
  });

  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  refresh();
  setInterval(refresh, 1000);
});
