// Chrome storage utilities for API key and preferences

const STORAGE_KEYS = {
  API_KEY: 'maps_finder_api_key',
  PREFERENCES: 'maps_finder_preferences',
  LAST_RESULTS: 'maps_finder_last_results'
};

/**
 * Get stored API key
 * @returns {Promise<string|null>}
 */
export async function getStoredApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.API_KEY], (result) => {
      resolve(result[STORAGE_KEYS.API_KEY] || null);
    });
  });
}

/**
 * Save API key
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
export async function saveApiKey(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: apiKey }, resolve);
  });
}

/**
 * Get user preferences
 * @returns {Promise<object|null>}
 */
export async function getPreferences() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.PREFERENCES], (result) => {
      resolve(result[STORAGE_KEYS.PREFERENCES] || null);
    });
  });
}

/**
 * Save user preferences
 * @param {object} preferences
 * @returns {Promise<void>}
 */
export async function savePreferences(preferences) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.PREFERENCES]: preferences }, resolve);
  });
}

/**
 * Save last search results
 * @param {object} data - { results, searchParams, timestamp }
 * @returns {Promise<void>}
 */
export async function saveLastResults(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.LAST_RESULTS]: {
        ...data,
        timestamp: Date.now()
      }
    }, resolve);
  });
}

/**
 * Get last search results
 * @returns {Promise<object|null>}
 */
export async function getLastResults() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.LAST_RESULTS], (result) => {
      resolve(result[STORAGE_KEYS.LAST_RESULTS] || null);
    });
  });
}

/**
 * Clear last search results
 * @returns {Promise<void>}
 */
export async function clearLastResults() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEYS.LAST_RESULTS], resolve);
  });
}

/**
 * Clear all stored data
 * @returns {Promise<void>}
 */
export async function clearAll() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      [STORAGE_KEYS.API_KEY, STORAGE_KEYS.PREFERENCES, STORAGE_KEYS.LAST_RESULTS],
      resolve
    );
  });
}
