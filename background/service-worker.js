// Background service worker - handles API calls and scoring

import { calculateScores } from '../utils/bayesian.js';
import { searchByCategory, searchByText, geocodeLocation, getAutocompleteSuggestions } from '../utils/api.js';
import { getStoredApiKey } from '../utils/storage.js';
import { MessageTypes } from '../utils/messaging.js';
import { CONFIG } from '../config/constants.js';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === MessageTypes.SEARCH) {
    handleSearch(request.payload)
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.type === MessageTypes.AUTOCOMPLETE) {
    handleAutocomplete(request.payload)
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.type === MessageTypes.GET_LOCATION) {
    getLocationByIP()
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

/**
 * Get location using IP geolocation (fallback when browser geolocation fails)
 */
async function getLocationByIP() {
  try {
    // Try multiple IP geolocation services for reliability
    const response = await fetch('https://ipapi.co/json/');

    if (!response.ok) {
      throw new Error('IP geolocation failed');
    }

    const data = await response.json();

    if (data.latitude && data.longitude) {
      return {
        lat: data.latitude,
        lng: data.longitude,
        city: data.city,
        source: 'ip'
      };
    }

    throw new Error('No location data');
  } catch (error) {
    // Fallback to another service
    try {
      const response = await fetch('https://ip-api.com/json/');
      const data = await response.json();

      if (data.lat && data.lon) {
        return {
          lat: data.lat,
          lng: data.lon,
          city: data.city,
          source: 'ip'
        };
      }
    } catch (e) {
      console.error('All IP geolocation failed:', e);
    }

    throw new Error('Could not determine location');
  }
}

/**
 * Handle autocomplete requests
 */
async function handleAutocomplete({ input }) {
  const apiKey = await getStoredApiKey();
  if (!apiKey) return [];

  return getAutocompleteSuggestions(input, apiKey);
}

/**
 * Main search handler
 * @param {object} params
 * @param {string} params.searchQuery - Category type or text query
 * @param {string} params.searchMode - 'category' or 'text'
 * @param {object} params.location - {lat, lng} or {query: string}
 * @param {number} params.radius - Search radius in meters
 * @param {string} params.algorithm - 'bayesian' or 'popularity'
 * @returns {Promise<Array>} - Top 3 scored results
 */
async function handleSearch({ searchQuery, searchMode, location, radius, algorithm = 'bayesian' }) {
  const apiKey = await getStoredApiKey();

  if (!apiKey) {
    throw new Error('API key not configured. Please add your Google API key in settings.');
  }

  // Resolve location if it's a query string
  let coordinates;
  if (location.query) {
    coordinates = await geocodeLocation(location.query, apiKey);
  } else {
    coordinates = location;
  }

  // Search for places based on mode
  let places;
  if (searchMode === 'category') {
    places = await searchByCategory({
      category: searchQuery,
      location: coordinates,
      radius,
      apiKey
    });
  } else {
    places = await searchByText({
      query: searchQuery,
      location: coordinates,
      radius,
      apiKey
    });
  }

  if (!places || places.length === 0) {
    return [];
  }

  // Calculate scores using selected algorithm
  const scoredPlaces = calculateScores(places, algorithm);

  // Return top N results
  return scoredPlaces.slice(0, CONFIG.TOP_RESULTS_TO_SHOW).map(place => ({
    placeId: place.id,
    name: place.displayName?.text || 'Unknown',
    rating: place.rating || 0,
    reviewCount: place.userRatingCount || 0,
    bayesianScore: place.bayesianScore,
    address: place.formattedAddress || place.shortFormattedAddress || '',
    distanceKm: place.distanceMeters ? (place.distanceMeters / 1000).toFixed(1) : null
  }));
}
