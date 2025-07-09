document.addEventListener('DOMContentLoaded', () => {
  const dateSelect = document.getElementById('date-select');
  const productiveList = document.getElementById('productive-websites');
  const unproductiveList = document.getElementById('unproductive-websites');
  const productiveTotalEl = document.getElementById('productive-total');
  const unproductiveTotalEl = document.getElementById('unproductive-total');
  let timeChart = null;

  // Helper function to format seconds to HH:MM:SS
  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function getWebsiteClassifications() {
    const { websiteClassifications } = await chrome.storage.sync.get(['websiteClassifications']);
    return websiteClassifications || { productive: [], unproductive: [] };
  }
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  dateSelect.value = today;
  dateSelect.max = today;
  
  // Load data when date changes
  dateSelect.addEventListener('change', loadDataForDate);
  
  // Initial load
  loadDataForDate();
  
  async function loadDataForDate() {
    const selectedDate = dateSelect.value;
    const { timeData } = await chrome.storage.local.get(['timeData']);
    const dailyData = timeData?.[selectedDate] || {};
    
    // Prepare data for chart
    const websites = Object.keys(dailyData);
    const times = websites.map(website => dailyData[website]);
    
    // Update chart
    updateChart(websites, times);
    
    // Update lists and totals
    updateWebsiteLists(websites, dailyData);
  }
  
  function updateChart(websites, times) {
    const ctx = document.getElementById('time-chart').getContext('2d');
    
    // Destroy previous chart if exists
    if (timeChart) {
      timeChart.destroy();
    }
    
    timeChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: websites,
        datasets: [{
          data: times,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
            '#9966FF', '#FF9F40', '#8AC249', '#EA5F89'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                return `${context.label}: ${formatTime(value)}`;
              }
            }
          }
        }
      }
    });
  }
  
  async function updateWebsiteLists(websites, dailyData) {
    productiveList.innerHTML = '';
    unproductiveList.innerHTML = '';
    
    const { productive, unproductive } = await getWebsiteClassifications();
    let productiveTotal = 0;
    let unproductiveTotal = 0;

    // Sort websites by time spent (descending)
    const sortedWebsites = websites.sort((a, b) => dailyData[b] - dailyData[a]);
    
    sortedWebsites.forEach(website => {
      const seconds = dailyData[website];
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="website-name">${website}</span>
        <span class="website-time">${formatTime(seconds)}</span>
      `;
      
      if (productive.includes(website)) {
        productiveTotal += seconds;
        productiveList.appendChild(li);
      } else if (unproductive.includes(website)) {
        unproductiveTotal += seconds;
        unproductiveList.appendChild(li);
      } else {
        // Default to unproductive if not classified
        unproductiveTotal += seconds;
        unproductiveList.appendChild(li);
      }
    });

    // Update the totals display
    productiveTotalEl.textContent = formatTime(productiveTotal);
    unproductiveTotalEl.textContent = formatTime(unproductiveTotal);
  }
});