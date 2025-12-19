// Google Places API wrapper

import { CONFIG } from '../config/constants.js';

const { PLACES_API_BASE, GEOCODING_API_BASE, MAX_RESULTS_FROM_API } = CONFIG;

/**
 * Search by Google Place category/type using Nearby Search
 * @param {object} params
 * @param {string} params.category - Google Place type (e.g., 'barber_shop', 'restaurant')
 * @param {object} params.location - {lat, lng} coordinates
 * @param {number} params.radius - Search radius in meters
 * @param {string} params.apiKey - Google API key
 * @returns {Promise<Array>} - Array of place objects
 */
export async function searchByCategory({ category, location, radius, apiKey }) {
  const url = `${PLACES_API_BASE}/places:searchNearby`;

  const requestBody = {
    includedTypes: [category],
    maxResultCount: MAX_RESULTS_FROM_API,
    locationRestriction: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng
        },
        radius: Math.min(radius, 50000) // Max 50km
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.rating',
        'places.userRatingCount',
        'places.formattedAddress',
        'places.shortFormattedAddress',
        'places.location'
      ].join(',')
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Places API error');
  }

  const data = await response.json();
  const places = data.places || [];

  // Filter by actual distance (API circle can be approximate)
  return filterByDistance(places, location, radius);
}

/**
 * Search by text query using Text Search
 * @param {object} params
 * @param {string} params.query - Search query (e.g., 'vegan pizza', 'pet store')
 * @param {object} params.location - {lat, lng} coordinates
 * @param {number} params.radius - Search radius in meters
 * @param {string} params.apiKey - Google API key
 * @returns {Promise<Array>} - Array of place objects
 */
export async function searchByText({ query, location, radius, apiKey }) {
  const url = `${PLACES_API_BASE}/places:searchText`;

  // Text Search requires rectangle for locationRestriction, not circle
  const bounds = circleToBounds(location.lat, location.lng, radius);

  const requestBody = {
    textQuery: query,
    maxResultCount: MAX_RESULTS_FROM_API,
    locationRestriction: {
      rectangle: {
        low: {
          latitude: bounds.south,
          longitude: bounds.west
        },
        high: {
          latitude: bounds.north,
          longitude: bounds.east
        }
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.rating',
        'places.userRatingCount',
        'places.formattedAddress',
        'places.shortFormattedAddress',
        'places.location'
      ].join(',')
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Places API error');
  }

  const data = await response.json();
  const places = data.places || [];

  // Filter by actual distance (bounding box corners extend beyond radius)
  return filterByDistance(places, location, radius);
}

/**
 * Geocode a location string to coordinates
 * @param {string} query - Location string (e.g., "New York, NY")
 * @param {string} apiKey - Google API key
 * @returns {Promise<object>} - {lat, lng} coordinates
 */
export async function geocodeLocation(query, apiKey) {
  // Check if already coordinates (e.g., "40.7128,-74.0060")
  const coordMatch = query.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return {
      lat: parseFloat(coordMatch[1]),
      lng: parseFloat(coordMatch[2])
    };
  }

  const url = `${GEOCODING_API_BASE}?address=${encodeURIComponent(query)}&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error('Could not find location. Please try a different address.');
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

/**
 * Get autocomplete suggestions for a location query
 * Uses Places API (New) Autocomplete
 * @param {string} input - Partial address input
 * @param {string} apiKey - Google API key
 * @returns {Promise<Array>} - Array of suggestion objects
 */
export async function getAutocompleteSuggestions(input, apiKey) {
  if (!input || input.length < 2) return [];

  const url = `${PLACES_API_BASE}/places:autocomplete`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey
      },
      body: JSON.stringify({
        input: input
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Autocomplete API error:', response.status, errorData);
      return [];
    }

    const data = await response.json();

    if (!data.suggestions || data.suggestions.length === 0) {
      return [];
    }

    return data.suggestions
      .filter(s => s.placePrediction)
      .slice(0, 5)
      .map(s => ({
        placeId: s.placePrediction.placeId,
        mainText: s.placePrediction.structuredFormat?.mainText?.text ||
                  s.placePrediction.text?.text?.split(',')[0] || '',
        secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || '',
        fullText: s.placePrediction.text?.text || ''
      }));
  } catch (error) {
    console.error('Autocomplete error:', error);
    return [];
  }
}

/**
 * Get place details (coordinates) from place ID
 * @param {string} placeId - Google Place ID
 * @param {string} apiKey - Google API key
 * @returns {Promise<object>} - {lat, lng} coordinates
 */
export async function getPlaceDetails(placeId, apiKey) {
  const url = `${PLACES_API_BASE}/places/${placeId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'location'
    }
  });

  if (!response.ok) {
    throw new Error('Could not get place details');
  }

  const data = await response.json();

  if (!data.location) {
    throw new Error('No location data for this place');
  }

  return {
    lat: data.location.latitude,
    lng: data.location.longitude
  };
}

/**
 * Calculate haversine distance between two points in meters
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Filter places by actual distance from center point
 */
function filterByDistance(places, center, radius) {
  return places.filter(place => {
    if (!place.location) return true;

    const distance = haversineDistance(
      center.lat,
      center.lng,
      place.location.latitude,
      place.location.longitude
    );

    // Add distance to place object for reference
    place.distanceMeters = distance;

    return distance <= radius;
  });
}

/**
 * Convert a circle (center + radius) to a bounding box
 */
function circleToBounds(lat, lng, radius) {
  const earthRadius = 6371000;
  const latOffset = (radius / earthRadius) * (180 / Math.PI);
  const lngOffset = (radius / (earthRadius * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);

  return {
    north: lat + latOffset,
    south: lat - latOffset,
    east: lng + lngOffset,
    west: lng - lngOffset
  };
}
