document.addEventListener('DOMContentLoaded', async () => {
  const { getClassifications, getGoals, setGoals } = TT;

  const SUGGESTIONS = {
    productive: [
      'github.com', 'stackoverflow.com', 'docs.google.com', 'notion.so',
      'linkedin.com', 'coursera.org', 'udemy.com', 'medium.com'
    ],
    unproductive: [
      'youtube.com', 'facebook.com', 'instagram.com', 'x.com',
      'twitter.com', 'reddit.com', 'netflix.com', 'tiktok.com'
    ]
  };

  const existing = await getClassifications();
  const selected = {
    productive: new Set(existing.productive),
    unproductive: new Set(existing.unproductive)
  };

  function renderChips(type) {
    const container = document.getElementById(`${type}-chips`);
    const opposite = type === 'productive' ? 'unproductive' : 'productive';
    container.innerHTML = '';

    // Suggestions plus anything the user already classified.
    const all = [...new Set([...SUGGESTIONS[type], ...selected[type]])];
    all.forEach(domain => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip ${type}`;
      chip.textContent = domain;
      chip.classList.toggle('on', selected[type].has(domain));
      chip.addEventListener('click', () => {
        if (selected[type].has(domain)) {
          selected[type].delete(domain);
        } else {
          selected[type].add(domain);
          selected[opposite].delete(domain);
        }
        renderChips('productive');
        renderChips('unproductive');
      });
      container.appendChild(chip);
    });
  }

  renderChips('productive');
  renderChips('unproductive');

  const goals = await getGoals();
  const goalInput = document.getElementById('goal-minutes');
  goalInput.value = goals.dailyProductiveMinutes || 120;

  document.getElementById('finish').addEventListener('click', async () => {
    const minutes = Number(goalInput.value);
    const safeMinutes = Number.isFinite(minutes) && minutes >= 0 && minutes <= 1440 ? Math.round(minutes) : 120;

    await chrome.storage.sync.set({
      websiteClassifications: {
        productive: [...selected.productive],
        unproductive: [...selected.unproductive]
      }
    });
    const current = await getGoals();
    current.dailyProductiveMinutes = safeMinutes;
    await setGoals(current);
    await chrome.storage.local.set({ onboardingDone: true });

    document.getElementById('setup').hidden = true;
    document.getElementById('done').hidden = false;
  });

  document.getElementById('open-analytics').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('analytics.html') });
  });
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
