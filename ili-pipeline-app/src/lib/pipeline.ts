import type { RunFile, NormalizedAnomaly, AnomalyMatch, OdometerDriftPoint, CleaningReport } from '@/types';
import { extractReferencePoints, matchReferencePoints, detectPipeReplacements } from '@/lib/alignment/referenceMatching';
import { createAlignmentZones, applyDistanceCorrection } from '@/lib/alignment/distanceCorrection';
import { calculateOdometerDrift, calculateFullDrift } from '@/lib/alignment/odometerDrift';
import { matchAcrossRuns } from '@/lib/matching/matcher';
import { assignGpsCoordinates, distanceToGps } from '@/data/gpsInterpolator';
import { cleanData } from '@/lib/parsing/dataCleaner';
import { usePipelineStore } from '@/store/pipelineStore';

/**
 * Run the full processing pipeline:
 * 1. Clean and standardize data (unit conversion, dedup, outliers, interpolation)
 * 2. Extract reference points from all runs
 * 3. Match reference points between consecutive runs
 * 4. Create alignment zones and apply distance correction
 * 5. Calculate odometer drift
 * 6. Match anomalies across all runs
 * 7. Assign GPS coordinates
 * 8. Store results
 */
export async function runPipeline(
  runFiles: RunFile[],
  years: number[]
): Promise<void> {
  const store = usePipelineStore.getState();

  // Sort runs by year
  const sortedFiles = [...runFiles].sort((a, b) => a.year - b.year);
  const sortedYears = sortedFiles.map((f) => f.year);

  // ──────── Data Cleaning Step ────────
  store.setProcessing({ status: 'normalizing', progress: 5, message: 'Cleaning & standardizing data...' });
  await sleep(50);

  // Get raw normalized anomalies per run
  const rawRuns: NormalizedAnomaly[][] = sortedFiles.map((f) => f.normalized_data);

  // Clean each run (pass other runs for cross-run checks)
  const cleaningReports: CleaningReport[] = [];
  const runs: NormalizedAnomaly[][] = [];

  for (let i = 0; i < rawRuns.length; i++) {
    const otherRuns = rawRuns.filter((_, j) => j !== i);
    const { cleaned, report } = cleanData(rawRuns[i], i, sortedYears[i], otherRuns);
    runs.push(cleaned);
    cleaningReports.push(report);
  }

  store.setCleaningReports(cleaningReports);

  store.setProcessing({ status: 'aligning', progress: 10, message: 'Extracting reference points...' });
  await sleep(50); // Let UI update

  // Step 1: Extract reference points
  const refPoints = runs.map((run, i) => extractReferencePoints(run, i));

  store.setProcessing({ status: 'aligning', progress: 20, message: 'Matching reference points...' });
  await sleep(50);

  // Step 2: Match reference points between consecutive runs and apply correction
  const allDrift: OdometerDriftPoint[] = [];
  const correctedRuns: NormalizedAnomaly[][] = [runs[0]]; // Run 0 is the baseline

  for (let i = 0; i < runs.length - 1; i++) {
    const matched = matchReferencePoints(refPoints[i], refPoints[i + 1]);

    // Detect pipe replacements
    const replacements = detectPipeReplacements(refPoints[i], refPoints[i + 1], matched);
    if (replacements.length > 0) {
      console.log(`Detected ${replacements.length} potential pipe replacements between Run ${i + 1} and Run ${i + 2}:`, replacements);
    }

    // Create alignment zones
    const zones = createAlignmentZones(matched);
    store.setAlignmentZones(zones);

    // Apply distance correction to the later run
    const corrected = applyDistanceCorrection(runs[i + 1], zones, matched);
    correctedRuns.push(corrected);

    // Calculate odometer drift
    const driftForRun = calculateOdometerDrift(refPoints[i + 1], i + 1, sortedYears[i + 1]);
    allDrift.push(...driftForRun);
  }

  // Also add drift for first run
  const driftRun0 = calculateOdometerDrift(refPoints[0], 0, sortedYears[0]);
  allDrift.push(...driftRun0);

  // Add full drift data from all anomalies
  for (let i = 0; i < runs.length; i++) {
    const fullDrift = calculateFullDrift(runs[i], i, sortedYears[i]);
    allDrift.push(...fullDrift);
  }

  store.setOdometerDrift(allDrift);
  store.setProcessing({ status: 'matching', progress: 50, message: 'Matching anomalies across runs...' });
  await sleep(50);

  // Step 3: Match anomalies across all runs
  const matches = matchAcrossRuns(correctedRuns, sortedYears);

  store.setProcessing({ status: 'analyzing', progress: 75, message: 'Assigning GPS coordinates...' });
  await sleep(50);

  // Step 4: Assign GPS coordinates to matches
  const geoMatches = matches.map((match) => {
    const latestAnomaly = match.anomalies[match.anomalies.length - 1];
    const gps = distanceToGps(latestAnomaly.corrected_distance);
    return {
      ...match,
      latitude: gps.lat,
      longitude: gps.lng,
    };
  });

  // Also assign GPS to all aligned anomalies
  const allAligned = correctedRuns.flat();
  const geoAligned = assignGpsCoordinates(allAligned);

  store.setAlignedAnomalies(geoAligned);
  store.setMatches(geoMatches);

  store.setProcessing({ status: 'complete', progress: 100, message: 'Analysis complete!' });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
