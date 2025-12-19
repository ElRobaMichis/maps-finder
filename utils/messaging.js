// Message passing utilities between popup and service worker

export const MessageTypes = {
  SEARCH: 'SEARCH',
  AUTOCOMPLETE: 'AUTOCOMPLETE',
  GET_LOCATION: 'GET_LOCATION'
};

/**
 * Send message to service worker
 * @param {string} type - Message type from MessageTypes
 * @param {object} payload - Data to send
 * @returns {Promise<object>} - Response from service worker
 */
export function sendMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
