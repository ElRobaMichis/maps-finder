// Scoring algorithms for ranking places
//
// 1. Bayesian Average: Balances rating with review count
//    Formula: Score = (C × m + R × v) / (C + v)
//
// 2. Popularity Bonus: Favors places with many reviews
//    Formula: Score = rating × (1 + log10(reviews) × popularityWeight)

import { CONFIG } from '../config/constants.js';

const { CONFIDENCE_THRESHOLD, DEFAULT_PRIOR_MEAN, MIN_REVIEWS } = CONFIG.BAYESIAN;

/**
 * Calculate scores based on selected algorithm
 * @param {Array} places - Array of place objects from API
 * @param {string} algorithm - 'bayesian' or 'popularity'
 * @returns {Array} - Places sorted by score (descending)
 */
export function calculateScores(places, algorithm = 'bayesian') {
  if (algorithm === 'popularity') {
    return calculatePopularityScores(places);
  }
  return calculateBayesianScores(places);
}

/**
 * Calculate Bayesian scores for all places and return sorted
 * @param {Array} places - Array of place objects from API
 * @returns {Array} - Places sorted by Bayesian score (descending)
 */
export function calculateBayesianScores(places) {
  // Filter out places without ratings or with too few reviews
  const validPlaces = places.filter(place =>
    place.rating > 0 &&
    (place.userRatingCount || 0) >= MIN_REVIEWS
  );

  if (validPlaces.length === 0) {
    return [];
  }

  // Calculate prior mean (m) from the dataset
  const priorMean = calculatePriorMean(validPlaces);

  // Calculate Bayesian score for each place
  const scoredPlaces = validPlaces.map(place => ({
    ...place,
    bayesianScore: calculateScore(
      place.rating,
      place.userRatingCount || 0,
      priorMean,
      CONFIDENCE_THRESHOLD
    )
  }));

  // Sort by Bayesian score (highest first)
  return scoredPlaces.sort((a, b) => b.bayesianScore - a.bayesianScore);
}

/**
 * Calculate the Bayesian average score for a single business
 * @param {number} rating - Business's average rating (R)
 * @param {number} reviewCount - Number of reviews (v)
 * @param {number} priorMean - Average rating across dataset (m)
 * @param {number} confidenceThreshold - Minimum reviews for full weight (C)
 * @returns {number} - Bayesian score
 */
function calculateScore(rating, reviewCount, priorMean, confidenceThreshold) {
  const C = confidenceThreshold;
  const m = priorMean;
  const R = rating;
  const v = reviewCount;

  // Bayesian Average: (C × m + R × v) / (C + v)
  return (C * m + R * v) / (C + v);
}

/**
 * Calculate the prior mean from the dataset (weighted by review count)
 * @param {Array} places - Array of places with ratings
 * @returns {number} - Prior mean rating
 */
function calculatePriorMean(places) {
  if (places.length === 0) {
    return DEFAULT_PRIOR_MEAN;
  }

  // Weighted average by review count
  let totalWeightedRating = 0;
  let totalReviews = 0;

  places.forEach(place => {
    const reviews = place.userRatingCount || 1;
    totalWeightedRating += place.rating * reviews;
    totalReviews += reviews;
  });

  if (totalReviews === 0) {
    return DEFAULT_PRIOR_MEAN;
  }

  return totalWeightedRating / totalReviews;
}

/**
 * Calculate Popularity scores - favors places with many reviews
 * Formula: Score = rating × (1 + popularityBonus)
 * Where popularityBonus = log10(reviewCount) × weight
 *
 * This means:
 * - 10 reviews = 1.0 bonus multiplier
 * - 100 reviews = 2.0 bonus multiplier
 * - 1000 reviews = 3.0 bonus multiplier
 *
 * @param {Array} places - Array of place objects from API
 * @returns {Array} - Places sorted by popularity score (descending)
 */
function calculatePopularityScores(places) {
  // Filter out places without ratings
  const validPlaces = places.filter(place =>
    place.rating > 0 &&
    (place.userRatingCount || 0) >= MIN_REVIEWS
  );

  if (validPlaces.length === 0) {
    return [];
  }

  // Popularity weight - how much to favor review count
  const POPULARITY_WEIGHT = 0.3;

  // Calculate popularity score for each place
  const scoredPlaces = validPlaces.map(place => {
    const reviews = place.userRatingCount || 1;
    const rating = place.rating;

    // log10(reviews) gives us a nice scaling:
    // 10 reviews = 1, 100 = 2, 1000 = 3, etc.
    const reviewBonus = Math.log10(reviews + 1);

    // Score = rating × (1 + reviewBonus × weight)
    // This boosts high-review places while still considering rating
    const popularityScore = rating * (1 + reviewBonus * POPULARITY_WEIGHT);

    return {
      ...place,
      bayesianScore: popularityScore // Use same field name for consistency
    };
  });

  // Sort by popularity score (highest first)
  return scoredPlaces.sort((a, b) => b.bayesianScore - a.bayesianScore);
}
