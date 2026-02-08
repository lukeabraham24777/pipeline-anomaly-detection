import type { NormalizedAnomaly, AnomalyMatch, MatchStatus, SimilarityBreakdown } from '@/types';
import { calculateSimilarity } from './similarity';
import { hungarianAlgorithm, buildCostMatrix } from './hungarian';
import { calculateGrowthRates } from '@/lib/analysis/growthRate';
import { classifyPriority } from '@/lib/analysis/priority';

const DISTANCE_FILTER = 200; // feet - max distance to consider a candidate
const CONFIDENCE_HIGH = 0.7;
const CONFIDENCE_LOW = 0.4;

/**
 * Match anomalies between two consecutive runs.
 * Returns matched pairs, new anomalies, and missing anomalies.
 */
export function matchAnomalies(
  run1: NormalizedAnomaly[],
  run2: NormalizedAnomaly[]
): {
  pairs: { run1Idx: number; run2Idx: number; similarity: SimilarityBreakdown }[];
  newAnomalies: number[]; // indices in run2
  missingAnomalies: number[]; // indices in run1
} {
  // Filter to non-reference anomalies only
  const r1 = run1.filter((a) => !a.is_reference_point);
  const r2 = run2.filter((a) => !a.is_reference_point);

  // Generate candidate pairs based on distance filter
  const candidates: { row: number; col: number; score: number; breakdown: SimilarityBreakdown }[] = [];

  for (let i = 0; i < r1.length; i++) {
    for (let j = 0; j < r2.length; j++) {
      const distDiff = Math.abs(r1[i].corrected_distance - r2[j].corrected_distance);
      if (distDiff > DISTANCE_FILTER) continue;

      const sim = calculateSimilarity(r1[i], r2[j]);
      if (sim.total > 0.2) {
        candidates.push({ row: i, col: j, score: sim.total, breakdown: sim });
      }
    }
  }

  // Build cost matrix and run Hungarian algorithm
  const costMatrix = buildCostMatrix(
    candidates.map((c) => ({ row: c.row, col: c.col, score: c.score })),
    r1.length,
    r2.length
  );

  const assignment = hungarianAlgorithm(costMatrix);

  // Extract results
  const pairs: { run1Idx: number; run2Idx: number; similarity: SimilarityBreakdown }[] = [];
  const matchedR1 = new Set<number>();
  const matchedR2 = new Set<number>();

  for (let i = 0; i < assignment.length; i++) {
    const j = assignment[i];
    if (j < 0 || j >= r2.length) continue;

    // Find the similarity for this pair
    const cand = candidates.find((c) => c.row === i && c.col === j);
    if (cand && cand.score >= CONFIDENCE_LOW) {
      // Map back to original indices
      const origI = run1.indexOf(r1[i]);
      const origJ = run2.indexOf(r2[j]);

      pairs.push({
        run1Idx: origI,
        run2Idx: origJ,
        similarity: cand.breakdown,
      });
      matchedR1.add(i);
      matchedR2.add(j);
    }
  }

  // Find unmatched
  const newAnomalies: number[] = [];
  for (let j = 0; j < r2.length; j++) {
    if (!matchedR2.has(j)) {
      newAnomalies.push(run2.indexOf(r2[j]));
    }
  }

  const missingAnomalies: number[] = [];
  for (let i = 0; i < r1.length; i++) {
    if (!matchedR1.has(i)) {
      missingAnomalies.push(run1.indexOf(r1[i]));
    }
  }

  return { pairs, newAnomalies, missingAnomalies };
}

/**
 * Orchestrate matching across 3 runs and build unified match objects.
 */
export function matchAcrossRuns(
  runs: NormalizedAnomaly[][],
  years: number[]
): AnomalyMatch[] {
  const allMatches: AnomalyMatch[] = [];
  let matchId = 0;

  if (runs.length < 2) return [];

  // Match Run 1 -> Run 2
  const match12 = matchAnomalies(runs[0], runs[1]);

  // Match Run 2 -> Run 3 (if 3 runs exist)
  const match23 = runs.length >= 3 ? matchAnomalies(runs[1], runs[2]) : null;

  // Build chain: For each Run1 anomaly matched to Run2, check if Run2 is also matched to Run3
  const run2ToRun3Map = new Map<number, { run3Idx: number; sim: SimilarityBreakdown }>();
  if (match23) {
    for (const pair of match23.pairs) {
      run2ToRun3Map.set(pair.run1Idx, { run3Idx: pair.run2Idx, sim: pair.similarity });
    }
  }

  // Process matched pairs from run1-run2
  for (const pair of match12.pairs) {
    const anomalies: NormalizedAnomaly[] = [runs[0][pair.run1Idx], runs[1][pair.run2Idx]];
    const runIndices = [0, 1];

    // Check if run2 anomaly also matched to run3
    const run3Match = run2ToRun3Map.get(pair.run2Idx);
    if (run3Match && runs[2]) {
      anomalies.push(runs[2][run3Match.run3Idx]);
      runIndices.push(2);
      run2ToRun3Map.delete(pair.run2Idx); // Mark as consumed
    }

    const confidence = pair.similarity.total;
    let status: MatchStatus = 'matched';
    if (confidence < CONFIDENCE_HIGH && confidence >= CONFIDENCE_LOW) {
      status = 'uncertain';
    }

    allMatches.push(
      buildMatchObject(
        `match-${matchId++}`,
        anomalies,
        runIndices,
        confidence,
        status,
        pair.similarity,
        years
      )
    );
  }

  // Process new anomalies (in run2 not matched to run1, but maybe matched to run3)
  for (const run2Idx of match12.newAnomalies) {
    const anomalies: NormalizedAnomaly[] = [runs[1][run2Idx]];
    const runIndices = [1];

    const run3Match = run2ToRun3Map.get(run2Idx);
    if (run3Match && runs[2]) {
      anomalies.push(runs[2][run3Match.run3Idx]);
      runIndices.push(2);
      run2ToRun3Map.delete(run2Idx);
    }

    allMatches.push(
      buildMatchObject(
        `match-${matchId++}`,
        anomalies,
        runIndices,
        0,
        'new',
        { distance: 0, dimensional: 0, clock: 0, feature_type: 0, total: 0 },
        years
      )
    );
  }

  // Process missing anomalies (in run1 not matched to run2)
  for (const run1Idx of match12.missingAnomalies) {
    allMatches.push(
      buildMatchObject(
        `match-${matchId++}`,
        [runs[0][run1Idx]],
        [0],
        0,
        'missing',
        { distance: 0, dimensional: 0, clock: 0, feature_type: 0, total: 0 },
        years
      )
    );
  }

  // Process remaining run3-only matches
  if (match23) {
    for (const [, val] of run2ToRun3Map) {
      if (runs[2]) {
        allMatches.push(
          buildMatchObject(
            `match-${matchId++}`,
            [runs[2][val.run3Idx]],
            [2],
            0,
            'new',
            { distance: 0, dimensional: 0, clock: 0, feature_type: 0, total: 0 },
            years
          )
        );
      }
    }

    // Run3 unmatched to run2
    for (const run3Idx of match23.newAnomalies) {
      if (runs[2]) {
        allMatches.push(
          buildMatchObject(
            `match-${matchId++}`,
            [runs[2][run3Idx]],
            [2],
            0,
            'new',
            { distance: 0, dimensional: 0, clock: 0, feature_type: 0, total: 0 },
            years
          )
        );
      }
    }
  }

  return allMatches;
}

function buildMatchObject(
  id: string,
  anomalies: NormalizedAnomaly[],
  runIndices: number[],
  confidence: number,
  status: MatchStatus,
  similarity: SimilarityBreakdown,
  years: number[]
): AnomalyMatch {
  const growth = calculateGrowthRates(anomalies, runIndices, years);
  const priority = classifyPriority(anomalies, growth, status);

  // Use the most recent anomaly for position
  const latestAnomaly = anomalies[anomalies.length - 1];

  return {
    id,
    anomalies,
    run_indices: runIndices,
    confidence,
    match_status: status,
    similarity_breakdown: similarity,
    depth_growth_rate: growth.depth_growth_rate,
    length_growth_rate: growth.length_growth_rate,
    width_growth_rate: growth.width_growth_rate,
    time_to_critical: growth.time_to_critical,
    priority: priority.level,
    repair_deadline: priority.deadline,
    regulatory_citation: priority.citation,
    latitude: latestAnomaly.latitude || 0,
    longitude: latestAnomaly.longitude || 0,
  };
}
