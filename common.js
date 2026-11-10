// Shared helpers for the popup, analytics, options and onboarding pages and
// the background service worker. Loaded as a classic <script> on pages and
// via `import './common.js'` in the (module) service worker; either way it
// exposes everything on globalThis.TT.
(function () {
  const pad = n => String(n).padStart(2, '0');

  // ---------- dates ----------

  // Local (not UTC) YYYY-MM-DD so days flip at local midnight.
  function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseLocalDate(key) {
    return new Date(`${key}T00:00:00`);
  }

  function addDays(key, n) {
    const d = parseLocalDate(key);
    d.setDate(d.getDate() + n);
    return localDateKey(d);
  }

  // Inclusive list of date keys from startKey to endKey.
  function dateRange(startKey, endKey) {
    const out = [];
    let cursor = startKey;
    let guard = 0;
    while (cursor <= endKey && guard++ < 800) {
      out.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  // ---------- formatting ----------

  function formatTime(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map(n => pad(n)).join(':');
  }

  // "2h 05m", "45m", "30s"
  function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${pad(m)}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }

  // e.g. "11/10/2026 (Tue)"
  function formatDateWithDay(key) {
    const d = parseLocalDate(key);
    const day = d.toLocaleDateString(undefined, { weekday: 'short' });
    return `${d.toLocaleDateString()} (${day})`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---------- classification ----------

  // A site matches a listed domain if it is that domain or a subdomain of it
  // ("youtube.com" also covers "www.youtube.com" and "m.youtube.com").
  function isListed(list, site) {
    return (list || []).some(domain => site === domain || site.endsWith('.' + domain));
  }

  // -> 'productive' | 'unproductive' | 'unclassified'
  function classify(site, cls) {
    if (isListed(cls.productive, site)) return 'productive';
    if (isListed(cls.unproductive, site)) return 'unproductive';
    return 'unclassified';
  }

  function baseDomain(hostname) {
    return String(hostname).replace(/^www\./, '');
  }

  async function getClassifications() {
    try {
      const { websiteClassifications } = await chrome.storage.sync.get('websiteClassifications');
      return {
        productive: (websiteClassifications && websiteClassifications.productive) || [],
        unproductive: (websiteClassifications && websiteClassifications.unproductive) || []
      };
    } catch {
      return { productive: [], unproductive: [] };
    }
  }

  // type: 'productive' | 'unproductive' | null (remove from both lists)
  async function setClassification(domain, type) {
    const cls = await getClassifications();
    cls.productive = cls.productive.filter(d => d !== domain);
    cls.unproductive = cls.unproductive.filter(d => d !== domain);
    if (type === 'productive' || type === 'unproductive') cls[type].push(domain);
    await chrome.storage.sync.set({ websiteClassifications: cls });
    return cls;
  }

  // ---------- goals & limits ----------

  const DEFAULT_GOALS = { dailyProductiveMinutes: 60, siteLimits: {} };

  async function getGoals() {
    try {
      const { goals } = await chrome.storage.sync.get('goals');
      return {
        dailyProductiveMinutes:
          goals && Number.isFinite(goals.dailyProductiveMinutes)
            ? goals.dailyProductiveMinutes
            : DEFAULT_GOALS.dailyProductiveMinutes,
        siteLimits: (goals && goals.siteLimits) || {}
      };
    } catch {
      return { ...DEFAULT_GOALS, siteLimits: {} };
    }
  }

  async function setGoals(goals) {
    await chrome.storage.sync.set({ goals });
  }

  // Total seconds today across every hostname matching `domain`.
  function secondsForDomain(dayData, domain) {
    let total = 0;
    for (const [site, secs] of Object.entries(dayData || {})) {
      if (site === domain || site.endsWith('.' + domain)) total += secs || 0;
    }
    return total;
  }

  function productiveSeconds(dayData, cls) {
    let total = 0;
    for (const [site, secs] of Object.entries(dayData || {})) {
      if (classify(site, cls) === 'productive') total += secs || 0;
    }
    return total;
  }

  globalThis.TT = {
    localDateKey, parseLocalDate, addDays, dateRange,
    formatTime, formatDuration, formatDateWithDay, escapeHtml,
    isListed, classify, baseDomain,
    getClassifications, setClassification,
    DEFAULT_GOALS, getGoals, setGoals,
    secondsForDomain, productiveSeconds
  };
})();
