// Productivity Tracker - background service worker (MV3).
//
// Design: a Manifest V3 service worker can be suspended at any time, so no
// timers or in-memory state are relied upon. All state lives in
// chrome.storage (session for the "current tracking context", local for
// data). Every event / alarm calls sync(), which:
//   1. credits the time elapsed since the last sync to the previously
//      tracked site (split at local midnight),
//   2. re-evaluates what is being tracked now (active tab, focus, idle, pause).

import './common.js';
const TT = globalThis.TT;

const TICK_ALARM = 'tick';
const MIDNIGHT_ALARM = 'midnight';
const IDLE_SECONDS = 60;
// If more time than this passed since the last sync we assume the computer
// slept / the browser was suspended, and do not credit the gap.
const MAX_GAP_MS = 90 * 1000;

const DEBUG = false;
function debugLog(...args) {
  if (DEBUG) console.log('[TimeTracker]', ...args);
}

// ---------- helpers ----------

// Local (not UTC) YYYY-MM-DD, so the "day" flips at local midnight.
function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextLocalMidnight(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
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
    if (!hostname.includes('.')) return null;
    // "www.youtube.com" and "youtube.com" are tracked as one site.
    const base = TT.baseDomain(hostname);
    return base.includes('.') ? base : hostname;
  } catch {
    return null;
  }
}

// Serialise all storage read-modify-write cycles.
let lock = Promise.resolve();
function withLock(fn) {
  const run = lock.then(fn);
  lock = run.catch(() => {});
  return run;
}

// One-time cleanup: older versions stored "www.x.com" separately from "x.com".
// Merges those rows (time is added together, tracking state is kept).
async function mergeWwwHosts() {
  const { timeData = {}, siteStates = {} } =
    await chrome.storage.local.get(['timeData', 'siteStates']);
  let changed = false;

  for (const day of Object.values(timeData)) {
    for (const host of Object.keys(day)) {
      const base = TT.baseDomain(host);
      if (base === host || !base.includes('.')) continue;
      day[base] = (day[base] || 0) + day[host];
      delete day[host];
      changed = true;
    }
  }

  for (const host of Object.keys(siteStates)) {
    const base = TT.baseDomain(host);
    if (base === host || !base.includes('.')) continue;
    if (siteStates[base] !== 'tracking') siteStates[base] = siteStates[host];
    delete siteStates[host];
    changed = true;
  }

  if (changed) await chrome.storage.local.set({ timeData, siteStates });
}

// ---------- crediting time ----------

// Adds the time between state.lastTs and `now` to state.hostname, split at
// local midnight. Returns the new "cursor" (so sub-second remainders are kept).
async function creditElapsed(state, now) {
  if (!state || !state.active || !state.hostname || !state.lastTs) return now;
  if (now - state.lastTs > MAX_GAP_MS || now < state.lastTs) return now;

  let cursor = state.lastTs;
  const additions = {}; // date -> seconds

  while (cursor < now) {
    const midnight = nextLocalMidnight(cursor);
    const segEnd = Math.min(now, midnight);
    const secs = Math.floor((segEnd - cursor) / 1000);
    if (secs > 0) {
      const date = localDateKey(new Date(cursor));
      additions[date] = (additions[date] || 0) + secs;
    }
    if (segEnd === midnight) {
      cursor = midnight; // drop the <1s remainder at a day boundary
    } else if (secs > 0) {
      cursor += secs * 1000;
    } else {
      break;
    }
  }

  const dates = Object.keys(additions);
  if (dates.length === 0) return cursor;

  const { timeData = {} } = await chrome.storage.local.get('timeData');

  for (const date of dates) {
    const secs = additions[date];
    timeData[date] = timeData[date] || {};
    timeData[date][state.hostname] = (timeData[date][state.hostname] || 0) + secs;
    debugLog(`Tracked ${secs}s on ${state.hostname} (${date})`);
  }

  await chrome.storage.local.set({ timeData });
  try {
    await checkAlerts(timeData);
  } catch (err) {
    console.warn('Alert check failed:', err);
  }
  return cursor;
}

// ---------- goal & limit notifications ----------

function notify(id, title, message) {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message
  });
}

// Fires each notification at most once per day.
async function checkAlerts(timeData) {
  const today = localDateKey();
  const day = timeData[today];
  if (!day) return;

  const [goals, cls, { notified }] = await Promise.all([
    TT.getGoals(),
    TT.getClassifications(),
    chrome.storage.local.get('notified')
  ]);
  const state = notified && notified.date === today ? notified : { date: today, keys: [] };
  let changed = false;

  for (const [domain, minutes] of Object.entries(goals.siteLimits)) {
    const key = `limit:${domain}`;
    if (!(minutes > 0) || state.keys.includes(key)) continue;
    if (TT.secondsForDomain(day, domain) >= minutes * 60) {
      state.keys.push(key);
      changed = true;
      notify(`${key}:${today}`, 'Daily limit reached',
        `You have used your ${minutes} minute limit for ${domain} today.`);
    }
  }

  if (goals.dailyProductiveMinutes > 0 && !state.keys.includes('goal')) {
    if (TT.productiveSeconds(day, cls) >= goals.dailyProductiveMinutes * 60) {
      state.keys.push('goal');
      changed = true;
      notify(`goal:${today}`, 'Daily goal reached',
        `Nice work - you hit your ${goals.dailyProductiveMinutes} minute productive-time goal.`);
    }
  }

  if (changed || !notified || notified.date !== today) {
    await chrome.storage.local.set({ notified: state });
  }
}

// ---------- current context ----------

// Per-site tracking state, persisted in chrome.storage.local.siteStates:
//   'tracking' | 'paused'. A site with no entry is 'new' (not started yet),
//   unless it already has recorded history, which counts as 'tracking'.
async function getSiteState(hostname) {
  if (!hostname) return null;
  const { siteStates = {}, timeData = {} } =
    await chrome.storage.local.get(['siteStates', 'timeData']);
  if (siteStates[hostname]) return siteStates[hostname];
  const hasHistory = Object.values(timeData).some(day => day && day[hostname] > 0);
  return hasHistory ? 'tracking' : 'new';
}

async function evaluateContext() {
  let tab = null;
  let focused = false;
  try {
    const win = await chrome.windows.getLastFocused({ populate: true });
    focused = !!win.focused;
    tab = (win.tabs || []).find(t => t.active) || null;
  } catch {
    // no window available
  }

  let idleState = 'active';
  try {
    idleState = await chrome.idle.queryState(IDLE_SECONDS);
  } catch {
    // idle API unavailable - assume active
  }

  const hostname = tab ? getHostname(tab.url) : null;
  const siteState = await getSiteState(hostname);
  // Playing audio (e.g. watching a video) counts as activity while "idle",
  // but never while the screen is locked.
  const userPresent =
    idleState === 'active' || (idleState === 'idle' && !!tab && !!tab.audible);

  return {
    hostname,
    tabId: tab ? tab.id : null,
    siteState,
    idleState,
    focused,
    active: siteState === 'tracking' && focused && userPresent
  };
}

function sync() {
  return withLock(async () => {
    const now = Date.now();
    const { trackerState } = await chrome.storage.session.get('trackerState');

    const cursor = await creditElapsed(trackerState, now);
    const ctx = await evaluateContext();

    const continuing =
      trackerState && trackerState.active && ctx.active &&
      trackerState.hostname === ctx.hostname;

    const next = { ...ctx, lastTs: continuing ? cursor : now };
    await chrome.storage.session.set({ trackerState: next });
    return next;
  });
}

// ---------- alarms ----------

function setupAlarms() {
  // 30s is the minimum period Chrome allows for alarms.
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 });
  chrome.alarms.create(MIDNIGHT_ALARM, { when: nextLocalMidnight(Date.now()) + 1000 });
}

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === TICK_ALARM) {
    await sync();
  } else if (alarm.name === MIDNIGHT_ALARM) {
    await sync(); // splits any time across midnight into the right days
    chrome.alarms.create(MIDNIGHT_ALARM, { when: nextLocalMidnight(Date.now()) + 1000 });
  }
});

// ---------- events ----------

chrome.tabs.onActivated.addListener(() => sync());
chrome.tabs.onRemoved.addListener(() => sync());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.audible !== undefined || changeInfo.status === 'complete') {
    sync();
  }
});
chrome.windows.onFocusChanged.addListener(() => sync());

chrome.idle.setDetectionInterval(IDLE_SECONDS);
chrome.idle.onStateChanged.addListener(() => sync());

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
  const { timeData } = await chrome.storage.local.get('timeData');
  // Never wipe existing history (this also fires on extension updates).
  if (!timeData) await chrome.storage.local.set({ timeData: {} });
  // The old server-sync queue is no longer used; drop any leftover data.
  await chrome.storage.local.remove('syncQueue');
  await withLock(mergeWwwHosts);
  setupAlarms();
  sync();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarms();
  sync();
});

// Runs every time the service worker (re)starts.
setupAlarms();
sync();

// ---------- popup messaging ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg && msg.type === 'setSiteState' && msg.hostname &&
        ['tracking', 'paused'].includes(msg.state)) {
      await withLock(async () => {
        // Credit time up to now under the old state before switching.
        const { trackerState } = await chrome.storage.session.get('trackerState');
        await creditElapsed(trackerState, Date.now());
        const { siteStates = {} } = await chrome.storage.local.get('siteStates');
        siteStates[msg.hostname] = msg.state;
        await chrome.storage.local.set({ siteStates });
        // Force a fresh baseline for the new state.
        await chrome.storage.session.set({ trackerState: { ...trackerState, active: false } });
      });
    }
    if (msg && (msg.type === 'getStatus' || msg.type === 'setSiteState')) {
      const state = await sync();
      const { timeData = {} } = await chrome.storage.local.get('timeData');
      const seconds = state.hostname
        ? (timeData[localDateKey()]?.[state.hostname] || 0)
        : 0;
      sendResponse({
        hostname: state.hostname,
        siteState: state.siteState,
        active: state.active,
        idleState: state.idleState,
        focused: state.focused,
        seconds
      });
    }
  })().catch(err => sendResponse({ error: err.message }));
  return true; // async response
});
