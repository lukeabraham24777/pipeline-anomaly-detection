import type { NormalizedAnomaly, SimilarityBreakdown, FeatureType } from '@/types';

// Weights for similarity components
const WEIGHTS = {
  distance: 0.40,
  dimensional: 0.30,
  clock: 0.20,
  feature_type: 0.10,
};

// Distance tolerance in feet for exponential decay
const DISTANCE_TOLERANCE = 50;

/**
 * Calculate weighted multi-metric similarity score between two anomalies.
 */
export function calculateSimilarity(
  a1: NormalizedAnomaly,
  a2: NormalizedAnomaly
): SimilarityBreakdown {
  const distSim = distanceSimilarity(a1.corrected_distance, a2.corrected_distance);
  const dimSim = dimensionalSimilarity(a1, a2);
  const clockSim = clockSimilarity(a1.clock_degrees, a2.clock_degrees);
  const typeSim = featureTypeSimilarity(a1.canonical_type, a2.canonical_type);

  const total =
    WEIGHTS.distance * distSim +
    WEIGHTS.dimensional * dimSim +
    WEIGHTS.clock * clockSim +
    WEIGHTS.feature_type * typeSim;

  return {
    distance: distSim,
    dimensional: dimSim,
    clock: clockSim,
    feature_type: typeSim,
    total,
  };
}

/**
 * Distance similarity using exponential decay.
 * Score of 1.0 when distances are identical, decays based on tolerance.
 */
function distanceSimilarity(d1: number, d2: number): number {
  const diff = Math.abs(d1 - d2);
  return Math.exp(-diff / DISTANCE_TOLERANCE);
}

/**
 * Dimensional similarity using cosine similarity of [depth%, length, width].
 */
function dimensionalSimilarity(a1: NormalizedAnomaly, a2: NormalizedAnomaly): number {
  const v1 = [a1.depth_percent, a1.length, a1.width];
  const v2 = [a2.depth_percent, a2.length, a2.width];

  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2);
  const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2);

  if (mag1 < 1e-10 || mag2 < 1e-10) return 0;

  return Math.max(0, dot / (mag1 * mag2));
}

/**
 * Clock position similarity using circular distance.
 * Handles wrap-around (e.g., 350° and 10° are close).
 */
function clockSimilarity(deg1: number, deg2: number): number {
  const diff = Math.abs(deg1 - deg2);
  const circularDiff = Math.min(diff, 360 - diff);
  return 1 - circularDiff / 180;
}

/**
 * Feature type similarity with compatibility mapping.
 */
function featureTypeSimilarity(t1: FeatureType, t2: FeatureType): number {
  if (t1 === t2) return 1.0;

  // Compatible types get partial credit
  const compatible: [FeatureType, FeatureType][] = [
    ['external_metal_loss', 'metal_loss'],
    ['internal_metal_loss', 'metal_loss'],
    ['external_metal_loss', 'internal_metal_loss'],
    ['crack', 'gouge'],
    ['girth_weld', 'seam_weld'],
  ];

  for (const [a, b] of compatible) {
    if ((t1 === a && t2 === b) || (t1 === b && t2 === a)) {
      return 0.5;
    }
  }

  return 0.0;
}
