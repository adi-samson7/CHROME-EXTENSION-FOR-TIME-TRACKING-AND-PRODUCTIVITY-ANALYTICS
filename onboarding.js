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
  goalInput.value = Number.isFinite(goals.dailyProductiveMinutes) ? goals.dailyProductiveMinutes : 120;

  document.getElementById('finish').addEventListener('click', async () => {
    const minutes = Number(goalInput.value);
    const safeMinutes = Number.isFinite(minutes) && minutes >= 0 && minutes <= 1440 ? Math.round(minutes) : 120;

    try {
      // Apply only what the user changed on this page to the latest saved
      // lists, so sites classified elsewhere in the meantime are kept.
      const latest = await getClassifications();
      const merged = { productive: new Set(latest.productive), unproductive: new Set(latest.unproductive) };
      for (const type of ['productive', 'unproductive']) {
        const opposite = type === 'productive' ? 'unproductive' : 'productive';
        for (const domain of selected[type]) {
          if (!existing[type].includes(domain)) {   // newly chosen here
            merged[type].add(domain);
            merged[opposite].delete(domain);
          }
        }
        for (const domain of existing[type]) {
          if (!selected[type].has(domain)) merged[type].delete(domain); // deselected here
        }
      }
      await TT.saveClassifications({
        productive: [...merged.productive],
        unproductive: [...merged.unproductive]
      });
      const current = await getGoals();
      current.dailyProductiveMinutes = safeMinutes;
      await setGoals(current);
    } catch (err) {
      alert(err.message);
      return;
    }
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
