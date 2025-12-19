// Popup UI logic
import { sendMessage, MessageTypes } from '../utils/messaging.js';
import { getStoredApiKey, saveApiKey, getPreferences, savePreferences, saveLastResults, getLastResults, getIPLocationConsent, saveIPLocationConsent } from '../utils/storage.js';

// DOM Elements
const $ = (id) => document.getElementById(id);

const elements = {
  apiKeySection: $('api-key-section'),
  apiKeyInput: $('api-key-input'),
  saveApiKeyBtn: $('save-api-key'),
  searchSection: $('search-section'),
  // Search mode
  searchByCategory: $('search-by-category'),
  searchByText: $('search-by-text'),
  categoryGroup: $('category-group'),
  categorySelect: $('category-select'),
  textSearchGroup: $('text-search-group'),
  businessType: $('business-type'),
  // Location
  useCurrentLocation: $('use-current-location'),
  useCustomLocation: $('use-custom-location'),
  customLocationGroup: $('custom-location-group'),
  customLocation: $('custom-location'),
  autocompleteDropdown: $('autocomplete-dropdown'),
  // Algorithm
  algoBayesian: $('algo-bayesian'),
  algoPopularity: $('algo-popularity'),
  // Other
  radiusSlider: $('radius-slider'),
  radiusValue: $('radius-value'),
  searchBtn: $('search-btn'),
  loadingSection: $('loading-section'),
  resultsSection: $('results-section'),
  resultsContainer: $('results-container'),
  newSearchBtn: $('new-search-btn'),
  errorSection: $('error-section'),
  errorMessage: $('error-message'),
  retryBtn: $('retry-btn'),
  settingsToggle: $('settings-toggle')
};

// Autocomplete state
let autocompleteTimeout = null;
let selectedAutocompleteIndex = -1;

// State
let state = {
  useCurrentLocation: true,
  searchByCategory: true,
  algorithm: 'bayesian', // 'bayesian' or 'popularity'
  hasApiKey: false
};

// Initialize popup
async function init() {
  const apiKey = await getStoredApiKey();
  state.hasApiKey = !!apiKey;

  if (!state.hasApiKey) {
    showSection('api-key');
  } else {
    await loadPreferences();

    // Check for cached results
    const lastResults = await getLastResults();
    if (lastResults && lastResults.results && lastResults.results.length > 0) {
      // Show cached results
      displayResults(lastResults.results, lastResults.searchParams);
    } else {
      showSection('search');
    }
  }

  setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
  // API Key
  elements.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  elements.apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSaveApiKey();
  });

  // Search mode toggle
  elements.searchByCategory.addEventListener('click', () => toggleSearchMode(true));
  elements.searchByText.addEventListener('click', () => toggleSearchMode(false));

  // Location toggle
  elements.useCurrentLocation.addEventListener('click', () => toggleLocation(true));
  elements.useCustomLocation.addEventListener('click', () => toggleLocation(false));

  // Algorithm toggle
  elements.algoBayesian.addEventListener('click', () => toggleAlgorithm('bayesian'));
  elements.algoPopularity.addEventListener('click', () => toggleAlgorithm('popularity'));

  // Radius slider
  elements.radiusSlider.addEventListener('input', (e) => {
    elements.radiusValue.textContent = e.target.value;
  });

  // Search
  elements.searchBtn.addEventListener('click', handleSearch);
  elements.businessType.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // New search
  elements.newSearchBtn.addEventListener('click', () => {
    showSection('search');
  });

  // Retry
  elements.retryBtn.addEventListener('click', () => {
    showSection('search');
  });

  // Settings
  elements.settingsToggle.addEventListener('click', toggleSettings);

  // Autocomplete
  elements.customLocation.addEventListener('input', handleAutocompleteInput);
  elements.customLocation.addEventListener('keydown', handleAutocompleteKeydown);
  elements.customLocation.addEventListener('blur', () => {
    // Delay hiding to allow click on dropdown
    setTimeout(() => hideAutocomplete(), 150);
  });
  elements.customLocation.addEventListener('focus', () => {
    if (elements.customLocation.value.length >= 2) {
      handleAutocompleteInput();
    }
  });
}

// Toggle search mode (Category vs Text)
function toggleSearchMode(byCategory) {
  state.searchByCategory = byCategory;

  elements.searchByCategory.classList.toggle('active', byCategory);
  elements.searchByText.classList.toggle('active', !byCategory);
  elements.categoryGroup.classList.toggle('hidden', !byCategory);
  elements.textSearchGroup.classList.toggle('hidden', byCategory);

  if (!byCategory) {
    elements.businessType.focus();
  }
}

// Toggle location mode
function toggleLocation(useCurrent) {
  state.useCurrentLocation = useCurrent;

  elements.useCurrentLocation.classList.toggle('active', useCurrent);
  elements.useCustomLocation.classList.toggle('active', !useCurrent);
  elements.customLocationGroup.classList.toggle('hidden', useCurrent);

  if (!useCurrent) {
    elements.customLocation.focus();
  }
}

// Toggle ranking algorithm
function toggleAlgorithm(algo) {
  state.algorithm = algo;

  elements.algoBayesian.classList.toggle('active', algo === 'bayesian');
  elements.algoPopularity.classList.toggle('active', algo === 'popularity');
}

// Save API Key
async function handleSaveApiKey() {
  const apiKey = elements.apiKeyInput.value.trim();

  if (!apiKey) {
    showError('Please enter an API key');
    return;
  }

  if (apiKey.length < 20) {
    showError('Invalid API key format');
    return;
  }

  await saveApiKey(apiKey);
  state.hasApiKey = true;
  elements.apiKeyInput.value = '';
  showSection('search');
}

// Handle Search
async function handleSearch() {
  let searchQuery;
  let searchMode;

  if (state.searchByCategory) {
    searchQuery = elements.categorySelect.value;
    searchMode = 'category';
  } else {
    searchQuery = elements.businessType.value.trim();
    searchMode = 'text';
    if (!searchQuery) {
      showError('Please enter what you\'re looking for');
      return;
    }
  }

  const radius = parseInt(elements.radiusSlider.value) * 1000; // km to meters

  let location;

  let locationLabel = '';

  if (state.useCurrentLocation) {
    showSection('loading');
    try {
      location = await getCurrentPosition();
      locationLabel = location.city ? `${location.city} (auto)` : 'Current Location';
    } catch (error) {
      showError('Unable to get your location. Please use a custom location.');
      return;
    }
  } else {
    const customLoc = elements.customLocation.value.trim();
    if (!customLoc) {
      showError('Please enter a location');
      return;
    }
    location = { query: customLoc };
    locationLabel = customLoc;
    showSection('loading');
  }

  try {
    const results = await sendMessage(MessageTypes.SEARCH, {
      searchQuery,
      searchMode,
      location,
      radius,
      algorithm: state.algorithm
    });

    if (results.error) {
      throw new Error(results.error);
    }

    const searchParams = {
      searchQuery,
      searchMode,
      radiusKm: elements.radiusSlider.value,
      location: locationLabel,
      algorithm: state.algorithm,
      locationSource: location.source || 'manual'
    };

    displayResults(results.data, searchParams);

    // Save results for persistence
    saveLastResults({
      results: results.data,
      searchParams
    });

    // Save preferences
    savePreferences({
      searchByCategory: state.searchByCategory,
      lastCategory: state.searchByCategory ? searchQuery : null,
      lastBusinessType: !state.searchByCategory ? searchQuery : null,
      radius: elements.radiusSlider.value,
      useCurrentLocation: state.useCurrentLocation,
      lastCustomLocation: state.useCurrentLocation ? '' : elements.customLocation.value,
      algorithm: state.algorithm
    });
  } catch (error) {
    showError(error.message || 'Search failed. Please try again.');
  }
}

// Get current position (tries browser geolocation first, then IP fallback with consent)
async function getCurrentPosition() {
  // First try browser geolocation
  try {
    const position = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      source: 'gps'
    };
  } catch (browserError) {
    console.log('Browser geolocation failed, checking IP fallback consent...');

    // Check if user has already consented to IP geolocation
    const hasConsent = await getIPLocationConsent();

    if (!hasConsent) {
      // Ask for consent before using IP geolocation
      const userConsent = await showIPConsentDialog();
      if (!userConsent) {
        throw new Error('Location access denied. Please use a custom location instead.');
      }
      // Save consent for future use
      await saveIPLocationConsent(true);
    }

    // Fallback to IP geolocation (with consent)
    try {
      const response = await sendMessage(MessageTypes.GET_LOCATION, {});

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (ipError) {
      throw new Error('Could not determine location. Please use custom location.');
    }
  }
}

// Show IP geolocation consent dialog
function showIPConsentDialog() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'consent-overlay';
    overlay.innerHTML = `
      <div class="consent-dialog">
        <h3>Location Access</h3>
        <p>Browser location is unavailable. Would you like to use approximate location based on your IP address?</p>
        <p class="consent-note">Your IP will be sent to a third-party geolocation service (ipapi.co) to determine your approximate location.</p>
        <div class="consent-buttons">
          <button class="consent-btn consent-deny">No, I'll enter location manually</button>
          <button class="consent-btn consent-allow">Yes, use approximate location</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Handle button clicks
    overlay.querySelector('.consent-allow').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });

    overlay.querySelector('.consent-deny').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
  });
}

// Display results
function displayResults(results, searchParams = null) {
  showSection('results');

  // Build search info header
  let searchInfoHtml = '';
  if (searchParams) {
    const categoryNames = {
      'barber_shop': 'Barber Shop',
      'restaurant': 'Restaurant',
      'cafe': 'Cafe',
      'bar': 'Bar',
      'gym': 'Gym',
      'atm': 'ATM',
      'bank': 'Bank',
      'pharmacy': 'Pharmacy',
      'gas_station': 'Gas Station',
      'hotel': 'Hotel',
      'motel': 'Motel',
      'grocery_store': 'Grocery Store',
      'supermarket': 'Supermarket',
      'ramen_restaurant': 'Ramen',
      'mexican_restaurant': 'Mexican Restaurant',
      'japanese_restaurant': 'Japanese Restaurant',
      'chinese_restaurant': 'Chinese Restaurant',
      'steak_house': 'Steak House',
      'hamburger_restaurant': 'Hamburger Restaurant',
      'barbecue_restaurant': 'Barbecue Restaurant',
      'breakfast_restaurant': 'Breakfast Restaurant',
      'brunch_restaurant': 'Brunch Restaurant',
      'karaoke': 'Karaoke',
      'aquarium': 'Aquarium',
      'botanical_garden': 'Botanical Garden',
      'skin_care_clinic': 'Skin Care Clinic',
      'electrician': 'Electrician',
      'florist': 'Florist',
      'hair_care': 'Hair Care',
      'locksmith': 'Locksmith',
      'plumber': 'Plumber',
      'furniture_store': 'Furniture Store'
    };
    const searchLabel = searchParams.searchMode === 'category'
      ? (categoryNames[searchParams.searchQuery] || escapeHtml(searchParams.searchQuery))
      : `"${escapeHtml(searchParams.searchQuery)}"`;

    const algoLabel = searchParams.algorithm === 'popularity' ? 'Popularity' : 'Bayesian';

    const locationSourceLabel = searchParams.locationSource === 'gps'
      ? '<span class="location-badge location-gps">GPS</span>'
      : searchParams.locationSource === 'ip'
        ? '<span class="location-badge location-ip">Approximate</span>'
        : '';

    searchInfoHtml = `
      <div class="search-info">
        <span class="search-info-label">${searchLabel}</span>
        <span class="search-info-detail">${escapeHtml(String(searchParams.radiusKm))} km from ${escapeHtml(searchParams.location)} ${locationSourceLabel} · ${algoLabel}</span>
      </div>
    `;
  }

  if (!results || results.length === 0) {
    elements.resultsContainer.innerHTML = `
      ${searchInfoHtml}
      <div class="no-results">
        <p>No businesses found in this area.</p>
        <p>Try expanding your search radius or a different location.</p>
      </div>
    `;
    return;
  }

  elements.resultsContainer.innerHTML = searchInfoHtml + results.map((result, index) => `
    <div class="result-card rank-${index + 1}">
      <div class="result-header">
        <span class="result-rank">${index + 1}</span>
        <span class="result-name">${escapeHtml(result.name)}</span>
      </div>
      <div class="result-meta">
        <span class="result-rating">&#9733; ${result.rating.toFixed(1)}</span>
        <span>${result.reviewCount.toLocaleString()} reviews</span>
        ${result.distanceKm ? `<span>${result.distanceKm} km</span>` : ''}
      </div>
      <div class="result-score">
        Bayesian Score: ${result.bayesianScore.toFixed(2)}
      </div>
      ${result.address ? `<div class="result-address">${escapeHtml(result.address)}</div>` : ''}
      <a href="https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(result.placeId)}"
         target="_blank"
         rel="noopener noreferrer"
         class="result-link">
        View on Google Maps &#8594;
      </a>
    </div>
  `).join('');
}

// Show specific section
function showSection(section) {
  elements.apiKeySection.classList.add('hidden');
  elements.searchSection.classList.add('hidden');
  elements.loadingSection.classList.add('hidden');
  elements.resultsSection.classList.add('hidden');
  elements.errorSection.classList.add('hidden');

  switch (section) {
    case 'api-key':
      elements.apiKeySection.classList.remove('hidden');
      break;
    case 'search':
      elements.searchSection.classList.remove('hidden');
      break;
    case 'loading':
      elements.loadingSection.classList.remove('hidden');
      break;
    case 'results':
      elements.resultsSection.classList.remove('hidden');
      break;
    case 'error':
      elements.errorSection.classList.remove('hidden');
      elements.searchSection.classList.remove('hidden');
      break;
  }
}

// Show error
function showError(message) {
  elements.errorMessage.textContent = message;
  showSection('error');
}

// Toggle settings
function toggleSettings() {
  if (elements.apiKeySection.classList.contains('hidden')) {
    elements.apiKeySection.classList.remove('hidden');
  } else {
    elements.apiKeySection.classList.add('hidden');
  }
}

// Load saved preferences
async function loadPreferences() {
  const prefs = await getPreferences();
  if (prefs) {
    if (prefs.searchByCategory !== undefined) {
      toggleSearchMode(prefs.searchByCategory);
    }
    if (prefs.lastCategory && prefs.searchByCategory) {
      elements.categorySelect.value = prefs.lastCategory;
    }
    if (prefs.lastBusinessType && !prefs.searchByCategory) {
      elements.businessType.value = prefs.lastBusinessType;
    }
    if (prefs.radius) {
      elements.radiusSlider.value = prefs.radius;
      elements.radiusValue.textContent = prefs.radius;
    }
    if (prefs.useCurrentLocation !== undefined) {
      toggleLocation(prefs.useCurrentLocation);
    }
    if (prefs.lastCustomLocation && !prefs.useCurrentLocation) {
      elements.customLocation.value = prefs.lastCustomLocation;
    }
    if (prefs.algorithm) {
      toggleAlgorithm(prefs.algorithm);
    }
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Autocomplete input handler (debounced)
function handleAutocompleteInput() {
  const input = elements.customLocation.value.trim();

  // Clear previous timeout
  if (autocompleteTimeout) {
    clearTimeout(autocompleteTimeout);
  }

  // Hide if input too short
  if (input.length < 2) {
    hideAutocomplete();
    return;
  }

  // Debounce API calls (300ms)
  autocompleteTimeout = setTimeout(async () => {
    try {
      const response = await sendMessage(MessageTypes.AUTOCOMPLETE, { input });

      if (response.data && response.data.length > 0) {
        showAutocompleteSuggestions(response.data);
      } else {
        hideAutocomplete();
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      hideAutocomplete();
    }
  }, 300);
}

// Show autocomplete suggestions
function showAutocompleteSuggestions(suggestions) {
  selectedAutocompleteIndex = -1;

  elements.autocompleteDropdown.innerHTML = suggestions.map((s, i) => `
    <div class="autocomplete-item" data-index="${i}" data-place-id="${s.placeId}" data-full-text="${escapeHtml(s.fullText)}">
      <div class="autocomplete-main">${escapeHtml(s.mainText)}</div>
      ${s.secondaryText ? `<div class="autocomplete-secondary">${escapeHtml(s.secondaryText)}</div>` : ''}
    </div>
  `).join('');

  // Add click handlers
  elements.autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur
      selectAutocompleteItem(item);
    });
  });

  elements.autocompleteDropdown.classList.remove('hidden');
}

// Hide autocomplete dropdown
function hideAutocomplete() {
  elements.autocompleteDropdown.classList.add('hidden');
  elements.autocompleteDropdown.innerHTML = '';
  selectedAutocompleteIndex = -1;
}

// Handle keyboard navigation in autocomplete
function handleAutocompleteKeydown(e) {
  const items = elements.autocompleteDropdown.querySelectorAll('.autocomplete-item');

  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
    updateAutocompleteSelection(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, 0);
    updateAutocompleteSelection(items);
  } else if (e.key === 'Enter' && selectedAutocompleteIndex >= 0) {
    e.preventDefault();
    selectAutocompleteItem(items[selectedAutocompleteIndex]);
  } else if (e.key === 'Escape') {
    hideAutocomplete();
  }
}

// Update visual selection in autocomplete
function updateAutocompleteSelection(items) {
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === selectedAutocompleteIndex);
  });

  // Scroll selected item into view
  if (selectedAutocompleteIndex >= 0) {
    items[selectedAutocompleteIndex].scrollIntoView({ block: 'nearest' });
  }
}

// Select an autocomplete item
function selectAutocompleteItem(item) {
  const fullText = item.dataset.fullText;
  elements.customLocation.value = fullText;
  hideAutocomplete();
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
