document.addEventListener('DOMContentLoaded', async () => {
  const dateSelect = document.getElementById('date-select');
  const productiveList = document.getElementById('productive-websites');
  const unproductiveList = document.getElementById('unproductive-websites');
  const productiveTotalEl = document.getElementById('productive-total');
  const unproductiveTotalEl = document.getElementById('unproductive-total');
  let timeChart = null;
  let lastChartKey = null;

  const viewTabs = document.querySelectorAll('.tab-button');
  const dailyView = document.getElementById('daily-view');
  const weeklyView = document.getElementById('weekly-view');
  const weeklyProductiveEl = document.getElementById('weekly-productive');
  const weeklyUnproductiveEl = document.getElementById('weekly-unproductive');
  const productivityRatioEl = document.getElementById('productivity-ratio');
  const topSitesList = document.getElementById('top-sites-list');
  const dailyTableBody = document.querySelector('#daily-table tbody');
  const exportPdfBtn = document.getElementById('export-pdf');
  let weeklyChart = null;

  // Local (not UTC) YYYY-MM-DD so days flip at local midnight.
  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseLocalDate(key) {
    return new Date(`${key}T00:00:00`);
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

  // A site matches a listed domain if it is that domain or a subdomain of it
  // (so "youtube.com" also covers "www.youtube.com" and "m.youtube.com").
  function isListed(list, site) {
    return list.some(domain => site === domain || site.endsWith('.' + domain));
  }

  function formatTime(seconds) {
    seconds = seconds || 0; 
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function getWebsiteClassifications() {
    try {
      const { websiteClassifications } = await chrome.storage.sync.get(['websiteClassifications']);
      return websiteClassifications || { productive: [], unproductive: [] };
    } catch (error) {
      console.error('Error getting classifications:', error);
      return { productive: [], unproductive: [] };
    }
  }

  viewTabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      dailyView.classList.toggle('active', tab.dataset.view === 'daily');
      weeklyView.classList.toggle('active', tab.dataset.view === 'weekly');
      
      if (tab.dataset.view === 'weekly') {
        try {
          const report = await generateWeeklyReport();
          displayWeeklyReport(report);
        } catch (error) {
          console.error('Error loading weekly report:', error);
        }
      }
    });
  });

  let today = localDateKey();
  dateSelect.value = today;
  dateSelect.max = today;
  dateSelect.addEventListener('change', loadDataForDate);
  
  loadDataForDate();

  // Keep the page in sync with the clock: roll over at midnight and refresh
  // live data for the current day.
  setInterval(() => {
    const now = localDateKey();
    if (now !== today) {
      const wasViewingToday = dateSelect.value === today;
      today = now;
      dateSelect.max = today;
      if (wasViewingToday) dateSelect.value = today;
      loadDataForDate();
    } else if (dateSelect.value === today && dailyView.classList.contains('active')) {
      loadDataForDate();
    }
  }, 30 * 1000);
  
  async function loadDataForDate() {
    const selectedDate = dateSelect.value;
    try {
      const { timeData } = await chrome.storage.local.get(['timeData']);
      const dailyData = timeData?.[selectedDate] || {};

      // Only redraw the chart when the data changed (avoids flicker on the
      // periodic refresh).
      const chartKey = selectedDate + JSON.stringify(dailyData);
      if (chartKey !== lastChartKey) {
        lastChartKey = chartKey;
        updateChart(Object.keys(dailyData), Object.values(dailyData));
      }
      updateWebsiteLists(Object.keys(dailyData), dailyData);
    } catch (error) {
      console.error('Error loading daily data:', error);
    }
  }
  
  function updateChart(labels, data) {
    const ctx = document.getElementById('time-chart').getContext('2d');
    
    if (timeChart) timeChart.destroy();
    
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
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${formatTime(ctx.raw)}`
            }
          }
        }
      }
    });
  }
  
  async function updateWebsiteLists(websites, dailyData) {
    try {
      const { productive = [] } = await getWebsiteClassifications();
      // Clear only after the await so overlapping refreshes cannot append
      // duplicate rows.
      productiveList.innerHTML = '';
      unproductiveList.innerHTML = '';
      let productiveTotal = 0, unproductiveTotal = 0;

      websites.sort((a, b) => dailyData[b] - dailyData[a]).forEach(website => {
        const seconds = dailyData[website] || 0;
        const li = document.createElement('li');
        const nameEl = document.createElement('span');
        nameEl.className = 'website-name';
        nameEl.textContent = website;
        const timeEl = document.createElement('span');
        timeEl.className = 'website-time';
        timeEl.textContent = formatTime(seconds);
        li.append(nameEl, timeEl);
        
        if (isListed(productive, website)) {
          productiveTotal += seconds;
          productiveList.appendChild(li);
        } else {
          unproductiveTotal += seconds;
          unproductiveList.appendChild(li);
        }
      });

      productiveTotalEl.textContent = formatTime(productiveTotal);
      unproductiveTotalEl.textContent = formatTime(unproductiveTotal);
    } catch (error) {
      console.error('Error updating lists:', error);
    }
  }

  async function generateWeeklyReport() {
  weeklyView.classList.add('loading');
  try {
    const { timeData } = await chrome.storage.local.get(['timeData']);
    
    if (!timeData || Object.keys(timeData).length === 0) {
      console.warn('No time tracking data found');
      return {
        productive: 0,
        unproductive: 0,
        byDay: {},
        topSites: []
      };
    }

    const { websiteClassifications = { productive: [] } } = 
      await chrome.storage.sync.get(['websiteClassifications']);
    const productiveSites = websiteClassifications.productive || [];

    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return localDateKey(d);
    });

    const report = { productive: 0, unproductive: 0, byDay: {}, topSites: [] };
    const allSites = {};

    dates.forEach(date => {
      report.byDay[date] = { productive: 0, unproductive: 0 };
      
      if (timeData[date]) {
        Object.entries(timeData[date]).forEach(([site, seconds]) => {
          if (!seconds || seconds <= 0) return;
          
          if (isListed(productiveSites, site)) {
            report.productive += seconds;
            report.byDay[date].productive += seconds;
          } else {
            report.unproductive += seconds;
            report.byDay[date].unproductive += seconds;
          }
          
          allSites[site] = (allSites[site] || 0) + seconds;
        });
      }
    });

    report.topSites = Object.entries(allSites)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([site, time]) => ({
        site,
        time,
        category: isListed(productiveSites, site) ? 'productive' : 'unproductive'
      }));

    return report;
  } catch (error) {
    console.error('Error generating report:', error);
    return {
      productive: 0,
      unproductive: 0,
      byDay: {},
      topSites: []
    };
  } finally {
    weeklyView.classList.remove('loading');
  }
}

  function displayWeeklyReport(report) {
    
    try {
      weeklyProductiveEl.textContent = formatTime(report.productive);
      weeklyUnproductiveEl.textContent = formatTime(report.unproductive);
      
      const totalTime = report.productive + report.unproductive;
      const ratio = totalTime > 0 ? Math.round((report.productive / totalTime) * 100) : 0;
      productivityRatioEl.textContent = `${ratio}%`;

      topSitesList.innerHTML = report.topSites.length > 0 
        ? report.topSites.map(site => `
            <li class="${escapeHtml(site.category)}">
              <span>${escapeHtml(site.site)}</span>
              <span>${formatTime(site.time)}</span>
            </li>
          `).join('')
        : '<li>No sites visited this week</li>';

      dailyTableBody.innerHTML = Object.entries(report.byDay).map(([date, data]) => `
        <tr>
          <td>${formatDateWithDay(date)}</td>
          <td>${formatTime(data.productive)}</td>
          <td>${formatTime(data.unproductive)}</td>
        </tr>
      `).join('') || '<tr><td colspan="3">No data available for this week</td></tr>';

      updateWeeklyChart(report);
    } catch (error) {
      console.error('Error displaying report:', error);
    }
  }

  function updateWeeklyChart(report) {
  const ctx = document.getElementById('weekly-chart').getContext('2d');
  if (weeklyChart) weeklyChart.destroy();

  const dates = Object.keys(report.byDay);
  if (dates.length === 0) {
    ctx.font = '16px Arial';
    ctx.fillText('No weekly data available', 50, 50);
    return;
  }

  const labels = dates.map(date => {
    const d = parseLocalDate(date);
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${dayName}\n${dateStr}`; 
  });

  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels, 
      datasets: [
        {
          label: 'Productive',
          data: dates.map(date => report.byDay[date].productive),
          backgroundColor: '#4CAF50'
        },
        {
          label: 'Unproductive',
          data: dates.map(date => report.byDay[date].unproductive),
          backgroundColor: '#F44336'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatTime(value)
          }
        },
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 0, 
            font: {
              size: 11 
            }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatTime(ctx.raw)}`
          }
        }
      }
    }
  });
}

 exportPdfBtn.addEventListener('click', async () => {
  exportPdfBtn.disabled = true;
  try {
    const report = await generateWeeklyReport();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 20;
    let yPos = 20;

    doc.setFontSize(18);
    doc.text('Weekly Productivity Report', 105, yPos, { align: 'center' });
    yPos += 15;
    
    doc.setFontSize(12);
    const dates = Object.keys(report.byDay);
    doc.text(`${dates[0]} to ${dates[dates.length-1]}`, 105, yPos, { align: 'center' });
    yPos += 20;

    doc.setFontSize(14);
    doc.text('Summary', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(12);
    doc.text(`Total Productive Time: ${formatTime(report.productive)}`, margin, yPos);
    yPos += 6;
    doc.text(`Total Unproductive Time: ${formatTime(report.unproductive)}`, margin, yPos);
    yPos += 6;
    doc.text(`Productivity Ratio: ${report.productive + report.unproductive > 0 ? Math.round((report.productive / (report.productive + report.unproductive)) * 100) : 0}%`, margin, yPos);
    yPos += 15;

    const chartCanvas = document.getElementById('weekly-chart');
    if (chartCanvas) {
      const chartImage = await new Promise(resolve => {
        chartCanvas.toBlob(blob => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }, 'image/png');
      });
      doc.addImage(chartImage, 'PNG', margin, yPos, 170, 80);
      yPos += 90;
    }

    doc.setFontSize(14);
    doc.text('Daily Breakdown', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(12);
    doc.text('Date', margin, yPos);
    doc.text('Productive', margin + 60, yPos);
    doc.text('Unproductive', margin + 120, yPos);
    yPos += 6;
    
    doc.setFontSize(11);
    Object.entries(report.byDay).forEach(([date, data]) => {
      doc.text(formatDateWithDay(date), margin, yPos);
      doc.text(formatTime(data.productive), margin + 60, yPos);
      doc.text(formatTime(data.unproductive), margin + 120, yPos);
      yPos += 6;
    });

    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(14);
    doc.text('Top 5 Sites', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    report.topSites.forEach((site, i) => {
      doc.text(`${i+1}. ${site.site}`, margin, yPos);
      doc.text(formatTime(site.time), margin + 120, yPos);
      yPos += 8;
    });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Generated by Time Tracker', 
             doc.internal.pageSize.width - margin,
             doc.internal.pageSize.height - 10,
             { align: 'right' });

    doc.save(`weekly-report-${dates[0]}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    alert('Failed to generate PDF. See console for details.');
  } finally {
    exportPdfBtn.disabled = false;
  }
});

  async function debugStorage() {
    try {
      const timeData = await chrome.storage.local.get(['timeData']);
      const classifications = await chrome.storage.sync.get(['websiteClassifications']);
      console.log('Current timeData:', timeData.timeData);
      console.log('Current classifications:', classifications.websiteClassifications);
      
      if (!timeData.timeData || Object.keys(timeData.timeData).length === 0) {
        console.warn('No time tracking data found in storage');
      }
    } catch (error) {
      console.error('Debug storage check failed:', error);
    }
  }
  
  debugStorage();
});