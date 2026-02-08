import type { NormalizedAnomaly, MatchedReference, AlignmentZone } from '@/types';

/**
 * Create alignment zones from matched reference points.
 * Each zone spans between two consecutive matched reference pairs.
 */
export function createAlignmentZones(
  matchedRefs: MatchedReference[]
): AlignmentZone[] {
  if (matchedRefs.length < 2) return [];

  const sorted = [...matchedRefs].sort((a, b) => a.run1.distance - b.run1.distance);
  const zones: AlignmentZone[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const startRef = sorted[i];
    const endRef = sorted[i + 1];

    const run1Span = endRef.run1.distance - startRef.run1.distance;
    const run2Span = endRef.run2.distance - startRef.run2.distance;

    // Detect pipe replacement: if span ratio is very different (>20% change)
    const spanRatio = run1Span > 0 ? run2Span / run1Span : 1;
    const isPipeReplacement = Math.abs(spanRatio - 1) > 0.2;

    zones.push({
      start_ref: startRef,
      end_ref: endRef,
      correction_factor: run1Span > 0 ? run2Span / run1Span : 1,
      is_pipe_replacement: isPipeReplacement,
    });
  }

  return zones;
}

/**
 * Apply piecewise linear distance correction to anomalies.
 * Uses alignment zones to correct Run 2 distances to Run 1 reference frame.
 *
 * corrected_distance = ref1_dist + (raw_distance - ref1_raw) * (ref2_dist - ref1_dist) / (ref2_raw - ref1_raw)
 */
export function applyDistanceCorrection(
  anomalies: NormalizedAnomaly[],
  zones: AlignmentZone[],
  matchedRefs: MatchedReference[]
): NormalizedAnomaly[] {
  if (zones.length === 0 || matchedRefs.length < 2) {
    // No correction possible - return as is
    return anomalies;
  }

  const sortedRefs = [...matchedRefs].sort((a, b) => a.run2.distance - b.run2.distance);
  const firstRef = sortedRefs[0];
  const lastRef = sortedRefs[sortedRefs.length - 1];

  return anomalies.map((anomaly) => {
    const raw = anomaly.distance;

    // Find the zone this anomaly falls into
    const zone = zones.find(
      (z) =>
        raw >= z.start_ref.run2.distance &&
        raw <= z.end_ref.run2.distance
    );

    let corrected: number;

    if (zone) {
      // Piecewise linear interpolation within the zone
      const run2Start = zone.start_ref.run2.distance;
      const run2End = zone.end_ref.run2.distance;
      const run1Start = zone.start_ref.run1.distance;
      const run1End = zone.end_ref.run1.distance;

      const run2Span = run2End - run2Start;
      if (run2Span > 0) {
        const fraction = (raw - run2Start) / run2Span;
        corrected = run1Start + fraction * (run1End - run1Start);
      } else {
        corrected = run1Start;
      }
    } else if (raw < firstRef.run2.distance) {
      // Before first reference - extrapolate using first zone's correction
      const offset = firstRef.run1.distance - firstRef.run2.distance;
      corrected = raw + offset;
    } else if (raw > lastRef.run2.distance) {
      // After last reference - extrapolate using last zone's correction
      const offset = lastRef.run1.distance - lastRef.run2.distance;
      corrected = raw + offset;
    } else {
      // Shouldn't happen, but fallback
      corrected = raw;
    }

    return {
      ...anomaly,
      corrected_distance: corrected,
    };
  });
}
