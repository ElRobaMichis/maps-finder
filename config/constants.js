// Configuration constants

export const CONFIG = {
  // API Configuration
  PLACES_API_BASE: 'https://places.googleapis.com/v1',
  GEOCODING_API_BASE: 'https://maps.googleapis.com/maps/api/geocode/json',

  // Search defaults
  DEFAULT_RADIUS_KM: 5,
  MAX_RADIUS_KM: 50,
  MAX_RESULTS_FROM_API: 20,
  TOP_RESULTS_TO_SHOW: 3,

  // Bayesian scoring parameters
  BAYESIAN: {
    CONFIDENCE_THRESHOLD: 20,  // Reviews needed for 50% weight
    DEFAULT_PRIOR_MEAN: 3.7,   // Fallback if can't calculate
    MIN_REVIEWS: 1             // Minimum reviews to include
  }
};
