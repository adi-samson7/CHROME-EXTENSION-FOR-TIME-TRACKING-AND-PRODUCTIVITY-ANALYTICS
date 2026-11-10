document.addEventListener('DOMContentLoaded', () => {
  const { localDateKey, getClassifications, getGoals, setGoals } = TT;

  const websiteInput = document.getElementById('website-input');
  const classificationSelect = document.getElementById('classification-select');
  const addButton = document.getElementById('add-classification');
  const lists = {
    productive: document.getElementById('productive-websites-list'),
    unproductive: document.getElementById('unproductive-websites-list')
  };
  const classSearch = document.getElementById('class-search');
  const classSort = document.getElementById('class-sort');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  const goalInput = document.getElementById('goal-minutes');
  const goalStatus = document.getElementById('goal-status');
  const limitDomain = document.getElementById('limit-domain');
  const limitMinutes = document.getElementById('limit-minutes');
  const limitsList = document.getElementById('limits-list');

  const backupStatus = document.getElementById('backup-status');
  const importFile = document.getElementById('import-file');

  const DOMAIN_RE = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;

  // Inline trash icon (no external icon font needed).
  const TRASH_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';

  // Limits for imported backups, so a crafted file can't bloat storage.
  const MAX_DAYS = 3700;
  const MAX_SITES_PER_DAY = 2000;
  const MAX_HOST_LEN = 253;
  const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

  function flash(el, message, isError) {
    el.textContent = message;
    el.classList.toggle('error', !!isError);
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ''; }, 4000);
  }

  // ---------- classification tabs ----------

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`${button.dataset.tab}-list`).classList.add('active');
    });
  });

  addButton.addEventListener('click', addClassification);
  websiteInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') addClassification();
  });
  classSearch.addEventListener('input', loadClassifications);
  classSort.addEventListener('change', loadClassifications);

  async function loadClassifications() {
    const cls = await getClassifications();
    renderClassificationList(cls.productive, lists.productive, 'productive');
    renderClassificationList(cls.unproductive, lists.unproductive, 'unproductive');
  }

  function renderClassificationList(websites, listElement, type) {
    const query = classSearch.value.trim().toLowerCase();
    let items = websites.filter(w => !query || w.toLowerCase().includes(query));

    if (classSort.value === 'newest') items = items.slice().reverse();
    else {
      items = items.slice().sort((a, b) => a.localeCompare(b));
      if (classSort.value === 'name-desc') items.reverse();
    }

    listElement.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = query ? 'No matches' : 'No websites yet';
      listElement.appendChild(empty);
      return;
    }

    items.forEach(website => {
      const li = document.createElement('li');

      const name = document.createElement('span');
      name.textContent = website;

      const btn = document.createElement('button');
      btn.className = 'remove-btn';
      btn.dataset.website = website;
      btn.dataset.type = type;
      btn.title = 'Remove';
      btn.innerHTML = TRASH_SVG;
      btn.addEventListener('click', removeClassification);

      li.append(name, btn);
      listElement.appendChild(li);
    });
  }

  async function addClassification() {
    const website = websiteInput.value.trim().toLowerCase();
    if (!website) return;

    if (!DOMAIN_RE.test(website)) {
      alert('Please enter a valid domain (e.g., "youtube.com")');
      return;
    }

    const type = classificationSelect.value;
    const opposite = type === 'productive' ? 'unproductive' : 'productive';
    const cls = await getClassifications();

    cls[opposite] = cls[opposite].filter(w => w !== website);
    if (!cls[type].includes(website)) cls[type].push(website);

    try {
      await TT.saveClassifications(cls);
    } catch (err) {
      alert(err.message);
      return;
    }
    websiteInput.value = '';
    loadClassifications();
  }

  async function removeClassification(e) {
    const { website, type } = e.currentTarget.dataset;
    const cls = await getClassifications();
    cls[type] = cls[type].filter(w => w !== website);
    await TT.saveClassifications(cls);
    loadClassifications();
  }

  // ---------- goal & limits ----------

  async function loadGoals() {
    const goals = await getGoals();
    goalInput.value = goals.dailyProductiveMinutes;
    renderLimits(goals.siteLimits);
  }

  function renderLimits(limits) {
    limitsList.innerHTML = '';
    const entries = Object.entries(limits).sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'No limits set';
      limitsList.appendChild(empty);
      return;
    }
    entries.forEach(([domain, minutes]) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${domain} - ${minutes} min/day`;
      const btn = document.createElement('button');
      btn.className = 'remove-btn';
      btn.title = 'Remove limit';
      btn.innerHTML = TRASH_SVG;
      btn.addEventListener('click', async () => {
        const goals = await getGoals();
        delete goals.siteLimits[domain];
        await setGoals(goals);
        loadGoals();
      });
      li.append(label, btn);
      limitsList.appendChild(li);
    });
  }

  document.getElementById('save-goal').addEventListener('click', async () => {
    const minutes = Number(goalInput.value);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      flash(goalStatus, 'Enter a number between 0 and 1440.', true);
      return;
    }
    const goals = await getGoals();
    goals.dailyProductiveMinutes = Math.round(minutes);
    try {
      await setGoals(goals);
    } catch (err) {
      flash(goalStatus, err.message, true);
      return;
    }
    flash(goalStatus, minutes === 0 ? 'Goal turned off.' : 'Goal saved.');
  });

  document.getElementById('add-limit').addEventListener('click', async () => {
    const domain = limitDomain.value.trim().toLowerCase();
    const minutes = Number(limitMinutes.value);
    if (!DOMAIN_RE.test(domain)) {
      flash(goalStatus, 'Enter a valid domain, e.g. youtube.com.', true);
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      flash(goalStatus, 'Limit must be between 1 and 1440 minutes.', true);
      return;
    }
    const goals = await getGoals();
    goals.siteLimits[domain] = Math.round(minutes);
    try {
      await setGoals(goals);
    } catch (err) {
      flash(goalStatus, err.message, true);
      return;
    }
    limitDomain.value = '';
    limitMinutes.value = '';
    flash(goalStatus, `Limit saved for ${domain}.`);
    loadGoals();
  });

  // ---------- backup & restore ----------

  document.getElementById('export-backup').addEventListener('click', async () => {
    try {
      const [{ timeData = {}, siteStates = {} }, cls, goals] = await Promise.all([
        chrome.storage.local.get(['timeData', 'siteStates']),
        getClassifications(),
        getGoals()
      ]);
      const backup = {
        app: 'productivity-tracker',
        version: 1,
        exportedAt: new Date().toISOString(),
        timeData, siteStates, classifications: cls, goals
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productivity-tracker-backup-${localDateKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash(backupStatus, 'Backup downloaded.');
    } catch (err) {
      console.error(err);
      flash(backupStatus, 'Export failed.', true);
    }
  });

  document.getElementById('import-backup').addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async () => {
    const file = importFile.files[0];
    importFile.value = '';
    if (!file) return;

    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('File is too large.');
      const backup = JSON.parse(await file.text());
      const clean = validateBackup(backup);

      const days = Object.keys(clean.timeData).length;
      const ok = confirm(
        `Restore this backup?\n\n${days} day(s) of tracked time, ` +
        `${clean.classifications.productive.length + clean.classifications.unproductive.length} classified site(s).\n\n` +
        'This REPLACES your current data.'
      );
      if (!ok) return;

      await chrome.storage.local.set({ timeData: clean.timeData, siteStates: clean.siteStates });
      await chrome.storage.sync.set({
        websiteClassifications: clean.classifications,
        goals: clean.goals
      });
      flash(backupStatus, 'Backup restored.');
      loadClassifications();
      loadGoals();
    } catch (err) {
      console.error(err);
      flash(backupStatus, `Import failed: ${err.message}`, true);
    }
  });

  // Validates and sanitises an imported backup.
  function validateBackup(b) {
    if (!b || typeof b !== 'object' || !['productivity-tracker', 'website-time-tracker'].includes(b.app)) {
      throw new Error('This is not a Productivity Tracker backup file.');
    }
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;

    if (!isObj(b.timeData)) throw new Error('Missing time data.');
    // Hostnames are stored without "www." so www.x.com and x.com merge.
    const cleanHost = raw => {
      const h = String(raw).toLowerCase();
      if (h.length > MAX_HOST_LEN || !HOST_RE.test(h)) return null;
      return TT.baseDomain(h);
    };

    const timeData = {};
    const dayEntries = Object.entries(b.timeData);
    if (dayEntries.length > MAX_DAYS) throw new Error('Too many days in this backup.');
    for (const [date, day] of dayEntries) {
      if (!dateRe.test(date) || !isObj(day)) throw new Error(`Invalid day entry: ${date.slice(0, 20)}`);
      const siteEntries = Object.entries(day);
      if (siteEntries.length > MAX_SITES_PER_DAY) throw new Error(`Too many websites on ${date}.`);
      timeData[date] = {};
      for (const [rawSite, secs] of siteEntries) {
        const site = cleanHost(rawSite);
        if (!site) throw new Error(`Invalid website name on ${date}.`);
        if (typeof secs !== 'number' || !Number.isFinite(secs) || secs < 0 || secs > 86400) {
          throw new Error(`Invalid time for ${site} on ${date}`);
        }
        timeData[date][site] = Math.min(86400, (timeData[date][site] || 0) + Math.round(secs));
      }
    }

    const c = isObj(b.classifications) ? b.classifications : {};
    const domains = arr => [...new Set((Array.isArray(arr) ? arr : [])
      .filter(d => typeof d === 'string' && d.length <= MAX_HOST_LEN && DOMAIN_RE.test(d))
      .map(d => d.toLowerCase()))];
    const classifications = {
      productive: domains(c.productive),
      unproductive: domains(c.unproductive)
    };

    const g = isObj(b.goals) ? b.goals : {};
    const goals = {
      dailyProductiveMinutes:
        Number.isFinite(g.dailyProductiveMinutes) && g.dailyProductiveMinutes >= 0 && g.dailyProductiveMinutes <= 1440
          ? Math.round(g.dailyProductiveMinutes) : 60,
      siteLimits: {}
    };
    if (isObj(g.siteLimits)) {
      for (const [d, m] of Object.entries(g.siteLimits)) {
        if (DOMAIN_RE.test(d) && Number.isFinite(m) && m >= 1 && m <= 1440) goals.siteLimits[d.toLowerCase()] = Math.round(m);
      }
    }

    const siteStates = {};
    if (isObj(b.siteStates)) {
      for (const [rawSite, st] of Object.entries(b.siteStates).slice(0, MAX_DAYS * 2)) {
        const site = cleanHost(rawSite);
        if (!site || (st !== 'tracking' && st !== 'paused')) continue;
        if (siteStates[site] !== 'tracking') siteStates[site] = st;
      }
    }

    // chrome.storage.sync has a per-item size limit.
    if (!TT.fitsSync('websiteClassifications', classifications)) {
      throw new Error('This backup has too many classified websites for Chrome to store.');
    }
    if (!TT.fitsSync('goals', goals)) {
      throw new Error('This backup has too many site limits for Chrome to store.');
    }

    return { timeData, classifications, goals, siteStates };
  }

  document.getElementById('run-onboarding').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  });

  loadClassifications();
  loadGoals();
});
