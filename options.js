document.addEventListener('DOMContentLoaded', () => {
  const websiteInput = document.getElementById('website-input');
  const classificationSelect = document.getElementById('classification-select');
  const addButton = document.getElementById('add-classification');
  const productiveList = document.getElementById('productive-websites-list');
  const unproductiveList = document.getElementById('unproductive-websites-list');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // Tab switching functionality
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update active tab content
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`${tabName}-list`).classList.add('active');
    });
  });

  // Load existing classifications
  loadClassifications();

  // Add new classification
  addButton.addEventListener('click', addClassification);
  websiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addClassification();
  });

  async function loadClassifications() {
    const { websiteClassifications } = await chrome.storage.sync.get(['websiteClassifications']);
    const classifications = websiteClassifications || { productive: [], unproductive: [] };
    
    renderClassificationList(classifications.productive, productiveList, 'productive');
    renderClassificationList(classifications.unproductive, unproductiveList, 'unproductive');
  }

  function renderClassificationList(websites, listElement, type) {
  listElement.innerHTML = '';
  
  websites.forEach(website => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${website}</span>
      <button class="remove-btn" data-website="${website}" data-type="${type}">
        <i class="material-icons">delete</i>
      </button>
    `;
    
    // Get the button we just created
    const btn = li.querySelector('.remove-btn');
    btn.addEventListener('click', removeClassification);
    
    listElement.appendChild(li);
  });

    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', removeClassification);
    });
  }

  async function addClassification() {
    const website = websiteInput.value.trim();
    if (!website) return;
    
    // Simple domain validation
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(website)) {
      alert('Please enter a valid domain (e.g., "youtube.com")');
      return;
    }
    
    const classification = classificationSelect.value;
    const { websiteClassifications } = await chrome.storage.sync.get(['websiteClassifications']);
    const classifications = websiteClassifications || { productive: [], unproductive: [] };
    
    // Remove from opposite classification if exists
    const oppositeType = classification === 'productive' ? 'unproductive' : 'productive';
    classifications[oppositeType] = classifications[oppositeType].filter(w => w !== website);
    
    // Add to selected classification if not already there
    if (!classifications[classification].includes(website)) {
      classifications[classification].push(website);
    }
    
    await chrome.storage.sync.set({ websiteClassifications: classifications });
    loadClassifications();
    websiteInput.value = '';
  }

  async function removeClassification(e) {
    const btn = e.currentTarget; // Changed from target to currentTarget
    const website = btn.dataset.website;
    const type = btn.dataset.type;
    
    const { websiteClassifications } = await chrome.storage.sync.get(['websiteClassifications']);
    const classifications = websiteClassifications || { productive: [], unproductive: [] };
    
    classifications[type] = classifications[type].filter(w => w !== website);
    await chrome.storage.sync.set({ websiteClassifications: classifications });
    loadClassifications();
}
});