document.addEventListener('DOMContentLoaded', () => {
  const {
    localDateKey, parseLocalDate, addDays, dateRange,
    formatTime, formatDuration, formatDateWithDay, escapeHtml,
    classify, baseDomain, getClassifications, setClassification, getGoals
  } = TT;

  // ---------- elements ----------
  const viewTabs = document.querySelectorAll('.tab-button');
  const dailyView = document.getElementById('daily-view');
  const weeklyView = document.getElementById('weekly-view');

  const dateSelect = document.getElementById('date-select');
  const siteSearch = document.getElementById('site-search');
  const siteSort = document.getElementById('site-sort');
  const listEls = {
    productive: document.getElementById('productive-websites'),
    unproductive: document.getElementById('unproductive-websites'),
    unclassified: document.getElementById('unclassified-websites')
  };
  const countEls = {
    productive: document.getElementById('productive-count'),
    unproductive: document.getElementById('unproductive-count'),
    unclassified: document.getElementById('unclassified-count')
  };
  const productiveTotalEl = document.getElementById('productive-total');
  const unproductiveTotalEl = document.getElementById('unproductive-total');

  const rangePreset = document.getElementById('range-preset');
  const rangeCustom = document.getElementById('range-custom');
  const rangeStart = document.getElementById('range-start');
  const rangeEnd = document.getElementById('range-end');
  const rangeApply = document.getElementById('range-apply');
  const rangeLabel = document.getElementById('range-label');
  const weeklyProductiveEl = document.getElementById('weekly-productive');
  const weeklyUnproductiveEl = document.getElementById('weekly-unproductive');
  const weeklyUnclassifiedEl = document.getElementById('weekly-unclassified');
  const ratioEl = document.getElementById('productivity-ratio');
  const insightsEl = document.getElementById('insights');
  const promptPanel = document.getElementById('unclassified-prompt');
  const promptList = document.getElementById('unclassified-prompt-list');
  const topSitesList = document.getElementById('top-sites-list');
  const dailyTableBody = document.querySelector('#daily-table tbody');
  const exportPdfBtn = document.getElementById('export-pdf');

  let timeChart = null;
  let weeklyChart = null;
  let lastChartKey = null;
  let lastReportKey = null;
  let today = localDateKey();

  const daily = { data: {}, cls: { productive: [], unproductive: [] } };
  let range = presetRange('7');
  let currentReport = null;

  // ---------- helpers ----------

  function presetRange(preset) {
    const end = localDateKey();
    if (preset === 'month') {
      return { start: end.slice(0, 8) + '01', end };
    }
    const days = Number(preset) || 7;
    return { start: addDays(end, -(days - 1)), end };
  }

  async function loadStorage() {
    const [{ timeData = {} }, cls] = await Promise.all([
      chrome.storage.local.get('timeData'),
      getClassifications()
    ]);
    return { timeData, cls };
  }

  function sortEntries(entries, mode) {
    // entries: [[site, seconds], ...]
    const sorters = {
      'time-desc': (a, b) => b[1] - a[1],
      'time-asc': (a, b) => a[1] - b[1],
      'name-asc': (a, b) => a[0].localeCompare(b[0]),
      'name-desc': (a, b) => b[0].localeCompare(a[0])
    };
    return entries.sort(sorters[mode] || sorters['time-desc']);
  }

  // A list row for a site, optionally with "Productive / Unproductive" buttons.
  function siteRow(site, seconds, withActions) {
    const li = document.createElement('li');
    const nameEl = document.createElement('span');
    nameEl.className = 'website-name';
    nameEl.textContent = site;
    const timeEl = document.createElement('span');
    timeEl.className = 'website-time';
    timeEl.textContent = formatTime(seconds);
    li.append(nameEl, timeEl);

    if (withActions) {
      li.classList.add('has-actions');
      const actions = document.createElement('div');
      actions.className = 'classify-actions';
      for (const type of ['productive', 'unproductive']) {
        const btn = document.createElement('button');
        btn.className = `mini-btn ${type}`;
        btn.textContent = type === 'productive' ? 'Productive' : 'Unproductive';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          await setClassification(baseDomain(site), type);
          await refreshAll();
        });
        actions.appendChild(btn);
      }
      li.appendChild(actions);
    }
    return li;
  }

  // ---------- DAILY VIEW ----------

  async function loadDailyData() {
    const { timeData, cls } = await loadStorage();
    daily.data = timeData[dateSelect.value] || {};
    daily.cls = cls;

    // Only redraw the chart when the data changed (avoids flicker on refresh).
    const chartKey = dateSelect.value + JSON.stringify(daily.data);
    if (chartKey !== lastChartKey) {
      lastChartKey = chartKey;
      updateChart(Object.keys(daily.data), Object.values(daily.data));
    }
    renderDailyLists();
  }

  function updateChart(labels, data) {
    const ctx = document.getElementById('time-chart').getContext('2d');
    if (timeChart) timeChart.destroy();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (labels.length === 0) {
      ctx.font = '16px Arial';
      ctx.fillText('No data for selected date', 50, 50);
      return;
    }

    timeChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#8AC249', '#EA5F89'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: { callbacks: { label: c => `${c.label}: ${formatTime(c.raw)}` } }
        }
      }
    });
  }

  // Synchronous render from stored state, so overlapping refreshes can never
  // append duplicate rows.
  function renderDailyLists() {
    const query = siteSearch.value.trim().toLowerCase();
    const groups = { productive: [], unproductive: [], unclassified: [] };
    const totals = { productive: 0, unproductive: 0, unclassified: 0 };

    for (const [site, secs] of Object.entries(daily.data)) {
      const cat = classify(site, daily.cls);
      totals[cat] += secs || 0;
      if (!query || site.toLowerCase().includes(query)) groups[cat].push([site, secs || 0]);
    }

    for (const cat of Object.keys(groups)) {
      const list = listEls[cat];
      list.innerHTML = '';
      sortEntries(groups[cat], siteSort.value).forEach(([site, secs]) => {
        list.appendChild(siteRow(site, secs, cat === 'unclassified'));
      });
      if (groups[cat].length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = query ? 'No matches' : 'Nothing here';
        list.appendChild(empty);
      }
      countEls[cat].textContent = totals[cat] > 0 ? `- ${formatDuration(totals[cat])}` : '';
    }

    productiveTotalEl.textContent = formatTime(totals.productive);
    unproductiveTotalEl.textContent = formatTime(totals.unproductive);
  }

  // ---------- REPORT ----------

  function buildReport(timeData, cls, startKey, endKey) {
    const dates = dateRange(startKey, endKey);
    const byDay = {};
    const totals = { productive: 0, unproductive: 0, unclassified: 0 };
    const siteTotals = {};

    for (const date of dates) {
      byDay[date] = { productive: 0, unproductive: 0, unclassified: 0 };
      for (const [site, secs] of Object.entries(timeData[date] || {})) {
        if (!(secs > 0)) continue;
        const cat = classify(site, cls);
        byDay[date][cat] += secs;
        totals[cat] += secs;
        siteTotals[site] = (siteTotals[site] || 0) + secs;
      }
    }

    const total = totals.productive + totals.unproductive + totals.unclassified;
    const sites = Object.entries(siteTotals)
      .map(([site, time]) => ({ site, time, category: classify(site, cls) }))
      .sort((a, b) => b.time - a.time);

    const activeDays = dates.filter(d => {
      const v = byDay[d];
      return v.productive + v.unproductive + v.unclassified > 0;
    });

    let best = null;
    let worst = null;
    for (const d of dates) {
      if (byDay[d].productive > 0 && (!best || byDay[d].productive > byDay[best].productive)) best = d;
      if (byDay[d].unproductive > 0 && (!worst || byDay[d].unproductive > byDay[worst].unproductive)) worst = d;
    }

    return {
      startKey, endKey, dates, byDay, totals, total,
      ratio: total > 0 ? Math.round((totals.productive / total) * 100) : 0,
      topSites: sites.slice(0, 10),
      unclassifiedSites: sites.filter(s => s.category === 'unclassified'),
      activeDays: activeDays.length,
      avgPerDay: activeDays.length ? total / activeDays.length : 0,
      best, worst
    };
  }

  // Streak of consecutive days meeting the daily productive goal.
  function computeStreaks(timeData, cls, goalMinutes) {
    if (!(goalMinutes > 0)) return null;
    const goalSecs = goalMinutes * 60;
    const met = new Set();
    for (const [date, day] of Object.entries(timeData)) {
      if (TT.productiveSeconds(day, cls) >= goalSecs) met.add(date);
    }

    // Today may still be in progress: count from yesterday if not met yet.
    let cursor = met.has(today) ? today : addDays(today, -1);
    let current = 0;
    while (met.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }

    let best = 0;
    let run = 0;
    let prev = null;
    for (const d of [...met].sort()) {
      run = prev && addDays(prev, 1) === d ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    return { current, best };
  }

  function trendRow(label, cur, prev, goodWhenUp) {
    if (cur === 0 && prev === 0) {
      return `<div class="trend-row"><span>${label}</span><span class="trend flat">-</span></div>`;
    }
    if (prev === 0) {
      return `<div class="trend-row"><span>${label}</span><span class="trend ${goodWhenUp ? 'good' : 'bad'}">&#9650; new</span></div>`;
    }
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (pct === 0) {
      return `<div class="trend-row"><span>${label}</span><span class="trend flat">no change</span></div>`;
    }
    const up = pct > 0;
    const good = up === goodWhenUp;
    return `<div class="trend-row"><span>${label}</span><span class="trend ${good ? 'good' : 'bad'}">${up ? '&#9650;' : '&#9660;'} ${Math.abs(pct)}%</span></div>`;
  }

  function insightCard(title, body, sub) {
    return `<div class="insight-card"><h4>${title}</h4><div class="insight-main">${body}</div>${sub ? `<div class="insight-sub">${sub}</div>` : ''}</div>`;
  }

  function renderInsights(report, prev, streaks, goalMinutes) {
    const days = report.dates.length;
    const prevRatio = prev.total > 0 ? Math.round((prev.totals.productive / prev.total) * 100) : null;
    const ratioDelta = prevRatio === null
      ? ''
      : `<div class="trend-row"><span>Ratio</span><span class="trend ${report.ratio >= prevRatio ? 'good' : 'bad'}">${report.ratio >= prevRatio ? '&#9650;' : '&#9660;'} ${Math.abs(report.ratio - prevRatio)} pts</span></div>`;

    const cards = [];
    cards.push(insightCard(
      `Trend vs previous ${days} day${days === 1 ? '' : 's'}`,
      trendRow('Productive', report.totals.productive, prev.totals.productive, true) +
      trendRow('Unproductive', report.totals.unproductive, prev.totals.unproductive, false) +
      ratioDelta
    ));

    cards.push(insightCard(
      'Best day',
      report.best ? escapeHtml(formatDateWithDay(report.best)) : '-',
      report.best ? `${formatDuration(report.byDay[report.best].productive)} productive` : 'No productive time yet'
    ));
    cards.push(insightCard(
      'Worst day',
      report.worst ? escapeHtml(formatDateWithDay(report.worst)) : '-',
      report.worst ? `${formatDuration(report.byDay[report.worst].unproductive)} unproductive` : 'No unproductive time'
    ));
    cards.push(insightCard(
      'Daily average',
      formatDuration(report.avgPerDay),
      `across ${report.activeDays} active day${report.activeDays === 1 ? '' : 's'}`
    ));
    cards.push(insightCard('Total tracked', formatDuration(report.total), `${days} day period`));

    if (streaks) {
      cards.push(insightCard(
        'Goal streak',
        `${streaks.current} day${streaks.current === 1 ? '' : 's'}`,
        `Best: ${streaks.best} &middot; goal ${formatDuration(goalMinutes * 60)}/day`
      ));
    } else {
      cards.push(insightCard('Goal streak', '-', 'Set a daily goal in Settings'));
    }
    insightsEl.innerHTML = cards.join('');
  }

  function renderReport(report, prev, streaks, goalMinutes) {
    rangeLabel.textContent =
      `${formatDateWithDay(report.startKey)} - ${formatDateWithDay(report.endKey)}`;

    weeklyProductiveEl.textContent = formatTime(report.totals.productive);
    weeklyUnproductiveEl.textContent = formatTime(report.totals.unproductive);
    weeklyUnclassifiedEl.textContent = formatTime(report.totals.unclassified);
    ratioEl.textContent = `${report.ratio}%`;

    renderInsights(report, prev, streaks, goalMinutes);

    // Unclassified prompt
    promptList.innerHTML = '';
    promptPanel.hidden = report.unclassifiedSites.length === 0;
    report.unclassifiedSites.slice(0, 8).forEach(s => {
      promptList.appendChild(siteRow(s.site, s.time, true));
    });

    // Top sites
    topSitesList.innerHTML = report.topSites.length > 0
      ? report.topSites.map(s => `
          <li class="${s.category}">
            <span>${escapeHtml(s.site)}</span>
            <span>${formatTime(s.time)}</span>
          </li>`).join('')
      : '<li>No sites visited in this period</li>';

    // Daily breakdown (newest first is easier to scan for long ranges)
    dailyTableBody.innerHTML = report.dates.map(date => {
      const d = report.byDay[date];
      return `<tr>
        <td>${escapeHtml(formatDateWithDay(date))}</td>
        <td>${formatTime(d.productive)}</td>
        <td>${formatTime(d.unproductive)}</td>
        <td>${formatTime(d.unclassified)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="4">No data available</td></tr>';

    updateReportChart(report);
  }

  function updateReportChart(report) {
    const ctx = document.getElementById('weekly-chart').getContext('2d');
    if (weeklyChart) weeklyChart.destroy();

    const dates = report.dates;
    const short = dates.length <= 10;
    const labels = dates.map(date => {
      const d = parseLocalDate(date);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return short
        ? `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${dateStr}`
        : dateStr;
    });

    weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Productive', data: dates.map(d => report.byDay[d].productive), backgroundColor: '#4CAF50' },
          { label: 'Unproductive', data: dates.map(d => report.byDay[d].unproductive), backgroundColor: '#F44336' },
          { label: 'Unclassified', data: dates.map(d => report.byDay[d].unclassified), backgroundColor: '#B0B0B0' }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { stacked: true, beginAtZero: true, ticks: { callback: v => formatTime(v) } },
          x: { stacked: true, ticks: { autoSkip: true, maxRotation: 0, font: { size: 11 } } }
        },
        plugins: {
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatTime(c.raw)}` } }
        }
      }
    });
  }

  async function loadReport(force) {
    weeklyView.classList.add('loading');
    try {
      const [{ timeData, cls }, goals] = await Promise.all([loadStorage(), getGoals()]);
      const report = buildReport(timeData, cls, range.start, range.end);

      const days = report.dates.length;
      const prevEnd = addDays(range.start, -1);
      const prevStart = addDays(prevEnd, -(days - 1));
      const prev = buildReport(timeData, cls, prevStart, prevEnd);
      const streaks = computeStreaks(timeData, cls, goals.dailyProductiveMinutes);

      currentReport = { report, prev, streaks, goalMinutes: goals.dailyProductiveMinutes };

      const key = JSON.stringify([report.byDay, report.topSites, streaks, goals.dailyProductiveMinutes, range]);
      if (force || key !== lastReportKey) {
        lastReportKey = key;
        renderReport(report, prev, streaks, goals.dailyProductiveMinutes);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      weeklyView.classList.remove('loading');
    }
  }

  // ---------- range picker ----------

  function syncRangeInputs() {
    rangeStart.value = range.start;
    rangeEnd.value = range.end;
    rangeStart.max = today;
    rangeEnd.max = today;
  }

  rangePreset.addEventListener('change', () => {
    if (rangePreset.value === 'custom') {
      rangeCustom.hidden = false;
      syncRangeInputs();
      return;
    }
    rangeCustom.hidden = true;
    range = presetRange(rangePreset.value);
    loadReport(true);
  });

  rangeApply.addEventListener('click', () => {
    let start = rangeStart.value;
    let end = rangeEnd.value;
    if (!start || !end) {
      alert('Please choose both a start and an end date.');
      return;
    }
    if (start > end) [start, end] = [end, start];
    if (end > today) end = today;
    if (dateRange(start, end).length > 366) {
      alert('Please choose a range of 366 days or less.');
      return;
    }
    range = { start, end };
    syncRangeInputs();
    loadReport(true);
  });

  // ---------- tabs, controls ----------

  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      dailyView.classList.toggle('active', tab.dataset.view === 'daily');
      weeklyView.classList.toggle('active', tab.dataset.view === 'weekly');
      if (tab.dataset.view === 'weekly') loadReport(true);
      else loadDailyData();
    });
  });

  dateSelect.value = today;
  dateSelect.max = today;
  dateSelect.addEventListener('change', loadDailyData);
  siteSearch.addEventListener('input', renderDailyLists);
  siteSort.addEventListener('change', renderDailyLists);

  async function refreshAll() {
    lastChartKey = null;
    await loadDailyData();
    if (weeklyView.classList.contains('active')) await loadReport(true);
  }

  // Keep the page in sync with the clock: roll over at midnight and refresh
  // live data every 30 seconds.
  setInterval(() => {
    const now = localDateKey();
    if (now !== today) {
      const wasViewingToday = dateSelect.value === today;
      const wasRollingRange = range.end === today;
      today = now;
      dateSelect.max = today;
      if (wasViewingToday) dateSelect.value = today;
      if (wasRollingRange && rangePreset.value !== 'custom') range = presetRange(rangePreset.value);
      lastChartKey = null;
    }
    if (weeklyView.classList.contains('active')) loadReport(false);
    else if (dateSelect.value === today) loadDailyData();
  }, 30 * 1000);

  // ---------- PDF export ----------

  exportPdfBtn.addEventListener('click', async () => {
    exportPdfBtn.disabled = true;
    try {
      await loadReport(false);
      const { report, prev, streaks, goalMinutes } = currentReport;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const margin = 20;
      const pageBottom = 275;
      let y = 20;

      const ensureSpace = (needed) => {
        if (y + needed > pageBottom) {
          doc.addPage();
          y = 20;
        }
      };

      doc.setFontSize(18);
      doc.text('Productivity Report', 105, y, { align: 'center' });
      y += 12;
      doc.setFontSize(12);
      doc.text(`${report.startKey} to ${report.endKey}`, 105, y, { align: 'center' });
      y += 16;

      doc.setFontSize(14);
      doc.text('Summary', margin, y);
      y += 8;
      doc.setFontSize(12);
      const summary = [
        `Productive: ${formatTime(report.totals.productive)}`,
        `Unproductive: ${formatTime(report.totals.unproductive)}`,
        `Unclassified: ${formatTime(report.totals.unclassified)}`,
        `Productivity ratio: ${report.ratio}%`,
        `Daily average: ${formatDuration(report.avgPerDay)} (${report.activeDays} active days)`,
        `Best day: ${report.best ? formatDateWithDay(report.best) : '-'}`,
        `Worst day: ${report.worst ? formatDateWithDay(report.worst) : '-'}`
      ];
      if (streaks) summary.push(`Goal streak: ${streaks.current} days (best ${streaks.best}, goal ${formatDuration(goalMinutes * 60)}/day)`);
      if (prev.total > 0) {
        const pct = prev.totals.productive > 0
          ? Math.round(((report.totals.productive - prev.totals.productive) / prev.totals.productive) * 100)
          : null;
        if (pct !== null) summary.push(`Productive time vs previous period: ${pct > 0 ? '+' : ''}${pct}%`);
      }
      summary.forEach(line => {
        doc.text(line, margin, y);
        y += 6;
      });
      y += 8;

      const chartCanvas = document.getElementById('weekly-chart');
      if (chartCanvas && weeklyChart) {
        const chartImage = chartCanvas.toDataURL('image/png');
        ensureSpace(90);
        doc.addImage(chartImage, 'PNG', margin, y, 170, 80);
        y += 90;
      }

      ensureSpace(20);
      doc.setFontSize(14);
      doc.text('Daily Breakdown', margin, y);
      y += 8;
      doc.setFontSize(11);
      doc.text('Date', margin, y);
      doc.text('Productive', margin + 55, y);
      doc.text('Unproductive', margin + 95, y);
      doc.text('Unclassified', margin + 135, y);
      y += 6;
      report.dates.forEach(date => {
        ensureSpace(8);
        const d = report.byDay[date];
        doc.text(formatDateWithDay(date), margin, y);
        doc.text(formatTime(d.productive), margin + 55, y);
        doc.text(formatTime(d.unproductive), margin + 95, y);
        doc.text(formatTime(d.unclassified), margin + 135, y);
        y += 6;
      });

      y += 10;
      ensureSpace(30);
      doc.setFontSize(14);
      doc.text('Top Sites', margin, y);
      y += 9;
      doc.setFontSize(12);
      report.topSites.forEach((site, i) => {
        ensureSpace(8);
        doc.text(`${i + 1}. ${site.site} (${site.category})`, margin, y);
        doc.text(formatTime(site.time), margin + 130, y);
        y += 7;
      });

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Generated by Productivity Tracker',
        doc.internal.pageSize.width - margin,
        doc.internal.pageSize.height - 10,
        { align: 'right' });

      doc.save(`productivity-report-${report.startKey}_to_${report.endKey}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to generate PDF. See console for details.');
    } finally {
      exportPdfBtn.disabled = false;
    }
  });

  // Refresh automatically when settings/classifications change elsewhere.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      refreshAll();
    } else if (area === 'local' && changes.timeData) {
      // Cheap: the chart / report only redraw when their data changed.
      if (weeklyView.classList.contains('active')) loadReport(false);
      else loadDailyData();
    }
  });

  loadDailyData();
});
