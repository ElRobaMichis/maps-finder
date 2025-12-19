// Chrome storage utilities for API key and preferences

const STORAGE_KEYS = {
  API_KEY: 'maps_finder_api_key',
  API_KEY_ENCRYPTED: 'maps_finder_api_key_enc',
  PREFERENCES: 'maps_finder_preferences',
  LAST_RESULTS: 'maps_finder_last_results',
  IP_LOCATION_CONSENT: 'maps_finder_ip_consent'
};

/**
 * Get encryption key derived from extension ID (provides basic obfuscation)
 * Note: This is not cryptographically secure against determined attackers with
 * local access, but prevents casual snooping and adds defense-in-depth.
 */
async function getEncryptionKey() {
  const extensionId = chrome.runtime.id;
  const encoder = new TextEncoder();
  const data = encoder.encode(extensionId + '_maps_finder_key_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string value
 */
async function encryptValue(value) {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value)
  );
  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string value
 */
async function decryptValue(encryptedBase64) {
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Get stored API key (decrypted)
 * @returns {Promise<string|null>}
 */
export async function getStoredApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.API_KEY_ENCRYPTED, STORAGE_KEYS.API_KEY], async (result) => {
      // Try encrypted key first
      if (result[STORAGE_KEYS.API_KEY_ENCRYPTED]) {
        const decrypted = await decryptValue(result[STORAGE_KEYS.API_KEY_ENCRYPTED]);
        if (decrypted) {
          resolve(decrypted);
          return;
        }
      }
      // Fallback to legacy unencrypted key (for migration)
      if (result[STORAGE_KEYS.API_KEY]) {
        // Migrate to encrypted storage
        const legacyKey = result[STORAGE_KEYS.API_KEY];
        saveApiKey(legacyKey).then(() => {
          // Remove legacy key after migration
          chrome.storage.local.remove([STORAGE_KEYS.API_KEY]);
        });
        resolve(legacyKey);
        return;
      }
      resolve(null);
    });
  });
}

/**
 * Save API key (encrypted)
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
export async function saveApiKey(apiKey) {
  const encrypted = await encryptValue(apiKey);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.API_KEY_ENCRYPTED]: encrypted }, resolve);
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
      [STORAGE_KEYS.API_KEY, STORAGE_KEYS.API_KEY_ENCRYPTED, STORAGE_KEYS.PREFERENCES, STORAGE_KEYS.LAST_RESULTS, STORAGE_KEYS.IP_LOCATION_CONSENT],
      resolve
    );
  });
}

/**
 * Get IP location consent status
 * @returns {Promise<boolean>}
 */
export async function getIPLocationConsent() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.IP_LOCATION_CONSENT], (result) => {
      resolve(result[STORAGE_KEYS.IP_LOCATION_CONSENT] === true);
    });
  });
}

/**
 * Save IP location consent
 * @param {boolean} consent
 * @returns {Promise<void>}
 */
export async function saveIPLocationConsent(consent) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.IP_LOCATION_CONSENT]: consent }, resolve);
  });
}
