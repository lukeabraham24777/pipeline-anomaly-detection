import type { NormalizedAnomaly, ReferencePoint, MatchedReference } from '@/types';

/**
 * Extract reference points (girth welds, valves) from normalized anomalies.
 */
export function extractReferencePoints(
  anomalies: NormalizedAnomaly[],
  runIndex: number
): ReferencePoint[] {
  return anomalies
    .filter((a) => a.is_reference_point)
    .map((a) => ({
      id: a.id,
      distance: a.distance,
      odometer: a.odometer,
      joint_number: a.joint_number,
      feature_type: a.canonical_type,
      run_index: runIndex,
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Match reference points between two runs using distance proximity and joint numbers.
 * Uses a greedy approach: for each ref in run1, find the closest unmatched ref in run2.
 */
export function matchReferencePoints(
  run1Refs: ReferencePoint[],
  run2Refs: ReferencePoint[],
  distanceTolerance: number = 500 // feet
): MatchedReference[] {
  const matched: MatchedReference[] = [];
  const usedRun2Indices = new Set<number>();

  for (const ref1 of run1Refs) {
    let bestIdx = -1;
    let bestScore = Infinity;

    for (let j = 0; j < run2Refs.length; j++) {
      if (usedRun2Indices.has(j)) continue;

      const ref2 = run2Refs[j];
      const distDiff = Math.abs(ref1.distance - ref2.distance);

      // Skip if too far apart
      if (distDiff > distanceTolerance) continue;

      // Scoring: distance difference + joint number penalty
      let score = distDiff;
      if (ref1.joint_number > 0 && ref2.joint_number > 0) {
        const jointDiff = Math.abs(ref1.joint_number - ref2.joint_number);
        // Matching joint numbers is a strong signal
        score = distDiff + jointDiff * 100;
      }

      if (score < bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestIdx >= 0) {
      const ref2 = run2Refs[bestIdx];
      usedRun2Indices.add(bestIdx);

      matched.push({
        run1: ref1,
        run2: ref2,
        distance_offset: ref2.distance - ref1.distance,
        odometer_drift: (ref2.distance - ref2.odometer) - (ref1.distance - ref1.odometer),
      });
    }
  }

  return matched;
}

/**
 * Detect potential pipe section replacements between runs.
 * Looks for gaps in reference point matching (consecutive unmatched refs).
 */
export function detectPipeReplacements(
  run1Refs: ReferencePoint[],
  run2Refs: ReferencePoint[],
  matched: MatchedReference[]
): { start_distance: number; end_distance: number; run: number; description: string }[] {
  const replacements: { start_distance: number; end_distance: number; run: number; description: string }[] = [];

  // Find unmatched refs in run1 (might be removed sections)
  const matchedRun1Ids = new Set(matched.map((m) => m.run1.id));
  const unmatchedRun1 = run1Refs.filter((r) => !matchedRun1Ids.has(r.id));

  // Find consecutive unmatched refs -> indicates pipe section removal
  let consecutiveStart: ReferencePoint | null = null;
  let consecutiveEnd: ReferencePoint | null = null;

  for (let i = 0; i < unmatchedRun1.length; i++) {
    if (!consecutiveStart) {
      consecutiveStart = unmatchedRun1[i];
      consecutiveEnd = unmatchedRun1[i];
    } else if (
      unmatchedRun1[i].distance - consecutiveEnd!.distance < 200 // Close together
    ) {
      consecutiveEnd = unmatchedRun1[i];
    } else {
      // Gap found - check if this is significant
      if (consecutiveStart !== consecutiveEnd) {
        replacements.push({
          start_distance: consecutiveStart.distance,
          end_distance: consecutiveEnd!.distance,
          run: 1,
          description: `Possible pipe section removed between distances ${consecutiveStart.distance.toFixed(0)}ft - ${consecutiveEnd!.distance.toFixed(0)}ft (${Math.abs(consecutiveEnd!.joint_number - consecutiveStart.joint_number)} joints)`,
        });
      }
      consecutiveStart = unmatchedRun1[i];
      consecutiveEnd = unmatchedRun1[i];
    }
  }

  // Check last group
  if (consecutiveStart && consecutiveEnd && consecutiveStart !== consecutiveEnd) {
    replacements.push({
      start_distance: consecutiveStart.distance,
      end_distance: consecutiveEnd.distance,
      run: 1,
      description: `Possible pipe section removed between distances ${consecutiveStart.distance.toFixed(0)}ft - ${consecutiveEnd.distance.toFixed(0)}ft`,
    });
  }

  // Similarly check for new refs in run2 not in run1 (added sections)
  const matchedRun2Ids = new Set(matched.map((m) => m.run2.id));
  const unmatchedRun2 = run2Refs.filter((r) => !matchedRun2Ids.has(r.id));

  let start2: ReferencePoint | null = null;
  let end2: ReferencePoint | null = null;

  for (let i = 0; i < unmatchedRun2.length; i++) {
    if (!start2) {
      start2 = unmatchedRun2[i];
      end2 = unmatchedRun2[i];
    } else if (unmatchedRun2[i].distance - end2!.distance < 200) {
      end2 = unmatchedRun2[i];
    } else {
      if (start2 !== end2) {
        replacements.push({
          start_distance: start2.distance,
          end_distance: end2!.distance,
          run: 2,
          description: `Possible new pipe section added between distances ${start2.distance.toFixed(0)}ft - ${end2!.distance.toFixed(0)}ft`,
        });
      }
      start2 = unmatchedRun2[i];
      end2 = unmatchedRun2[i];
    }
  }

  if (start2 && end2 && start2 !== end2) {
    replacements.push({
      start_distance: start2.distance,
      end_distance: end2.distance,
      run: 2,
      description: `Possible new pipe section added between distances ${start2.distance.toFixed(0)}ft - ${end2!.distance.toFixed(0)}ft`,
    });
  }

  return replacements;
}
