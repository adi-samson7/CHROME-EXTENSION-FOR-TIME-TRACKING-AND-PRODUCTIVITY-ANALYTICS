document.addEventListener('DOMContentLoaded', async () => {
  const dateSelect = document.getElementById('date-select');
  const productiveList = document.getElementById('productive-websites');
  const unproductiveList = document.getElementById('unproductive-websites');
  const productiveTotalEl = document.getElementById('productive-total');
  const unproductiveTotalEl = document.getElementById('unproductive-total');
  let timeChart = null;

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

  const today = new Date().toISOString().split('T')[0];
  dateSelect.value = today;
  dateSelect.max = today;
  dateSelect.addEventListener('change', loadDataForDate);
  
  loadDataForDate();
  
  async function loadDataForDate() {
    const selectedDate = dateSelect.value;
    try {
      const { timeData } = await chrome.storage.local.get(['timeData']);
      console.log('Loaded timeData:', timeData); 
      
      const dailyData = timeData?.[selectedDate] || {};
      console.log('Daily data for', selectedDate, ':', dailyData); 
      
      updateChart(Object.keys(dailyData), Object.values(dailyData));
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
    productiveList.innerHTML = '';
    unproductiveList.innerHTML = '';
    
    try {
      const { productive = [], unproductive = [] } = await getWebsiteClassifications();
      let productiveTotal = 0, unproductiveTotal = 0;

      websites.sort((a, b) => dailyData[b] - dailyData[a]).forEach(website => {
        const seconds = dailyData[website] || 0;
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="website-name">${website}</span>
          <span class="website-time">${formatTime(seconds)}</span>
        `;
        
        if (productive.includes(website)) {
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
    console.log('Weekly Report - timeData:', timeData);
    
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
    console.log('Productive sites:', productiveSites);

    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const report = { productive: 0, unproductive: 0, byDay: {}, topSites: [] };
    const allSites = {};

    dates.forEach(date => {
      report.byDay[date] = { productive: 0, unproductive: 0 };
      
      if (timeData[date]) {
        Object.entries(timeData[date]).forEach(([site, seconds]) => {
          if (!seconds || seconds <= 0) return;
          
          if (productiveSites.includes(site)) {
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
        category: productiveSites.includes(site) ? 'productive' : 'unproductive'
      }));

    console.log('Generated report:', report);
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
    console.log('Displaying report:', report); 
    
    try {
      weeklyProductiveEl.textContent = formatTime(report.productive);
      weeklyUnproductiveEl.textContent = formatTime(report.unproductive);
      
      const totalTime = report.productive + report.unproductive;
      const ratio = totalTime > 0 ? Math.round((report.productive / totalTime) * 100) : 0;
      productivityRatioEl.textContent = `${ratio}%`;

      topSitesList.innerHTML = report.topSites.length > 0 
        ? report.topSites.map(site => `
            <li class="${site.category}">
              <span>${site.site}</span>
              <span>${formatTime(site.time)}</span>
            </li>
          `).join('')
        : '<li>No sites visited this week</li>';

      dailyTableBody.innerHTML = Object.entries(report.byDay).map(([date, data]) => `
        <tr>
          <td>${new Date(date).toLocaleDateString()}</td>
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
    const d = new Date(date);
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
    doc.text(`Productivity Ratio: ${productivityRatioEl.textContent}`, margin, yPos);
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
      doc.text(date, margin, yPos);
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