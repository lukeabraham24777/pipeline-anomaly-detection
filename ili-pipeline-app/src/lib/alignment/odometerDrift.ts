import type { NormalizedAnomaly, ReferencePoint, OdometerDriftPoint } from '@/types';

/**
 * Calculate odometer drift at each reference point for a given run.
 * Drift = distance - odometer (how far off the odometer is from true distance).
 */
export function calculateOdometerDrift(
  referencePoints: ReferencePoint[],
  runIndex: number,
  runYear: number
): OdometerDriftPoint[] {
  return referencePoints
    .sort((a, b) => a.distance - b.distance)
    .map((ref, i) => ({
      distance: ref.distance,
      odometer: ref.odometer,
      drift: ref.distance - ref.odometer,
      reference_label: `Ref ${i + 1} (Jt ${ref.joint_number})`,
      run_index: runIndex,
      run_year: runYear,
    }));
}

/**
 * Calculate aggregate drift statistics for a run.
 */
export function getDriftStatistics(driftPoints: OdometerDriftPoint[]) {
  if (driftPoints.length === 0) {
    return {
      maxDrift: 0,
      minDrift: 0,
      avgDrift: 0,
      totalAccumulated: 0,
      driftRate: 0, // feet per 1000 feet
    };
  }

  const drifts = driftPoints.map((p) => p.drift);
  const maxDrift = Math.max(...drifts);
  const minDrift = Math.min(...drifts);
  const avgDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;

  // Total accumulated drift = difference between first and last
  const sorted = [...driftPoints].sort((a, b) => a.distance - b.distance);
  const totalAccumulated = sorted[sorted.length - 1].drift - sorted[0].drift;
  const totalDistance = sorted[sorted.length - 1].distance - sorted[0].distance;

  return {
    maxDrift,
    minDrift,
    avgDrift,
    totalAccumulated,
    driftRate: totalDistance > 0 ? (totalAccumulated / totalDistance) * 1000 : 0,
  };
}

/**
 * Calculate odometer drift from all anomalies (not just reference points).
 * Uses the full dataset to show drift distribution.
 */
export function calculateFullDrift(
  anomalies: NormalizedAnomaly[],
  runIndex: number,
  runYear: number
): OdometerDriftPoint[] {
  // Sample every Nth anomaly to keep chart manageable
  const sorted = [...anomalies].sort((a, b) => a.distance - b.distance);
  const sampleRate = Math.max(1, Math.floor(sorted.length / 200));

  return sorted
    .filter((_, i) => i % sampleRate === 0)
    .map((a) => ({
      distance: a.distance,
      odometer: a.odometer,
      drift: a.distance - a.odometer,
      reference_label: a.feature_id,
      run_index: runIndex,
      run_year: runYear,
    }));
}
