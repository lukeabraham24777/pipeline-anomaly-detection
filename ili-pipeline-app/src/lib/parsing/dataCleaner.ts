import type { NormalizedAnomaly, CleaningReport, CleaningPass } from '@/types';

/**
 * Run all cleaning passes on a set of normalized anomalies for a single run.
 * Returns cleaned anomalies + a cleaning report.
 */
export function cleanData(
  anomalies: NormalizedAnomaly[],
  runIndex: number,
  runYear: number,
  otherRuns?: NormalizedAnomaly[][]
): { cleaned: NormalizedAnomaly[]; report: CleaningReport } {
  const originalCount = anomalies.length;
  const passes: CleaningPass[] = [];
  let data = [...anomalies];

  // Pass 1: Remove exact duplicates
  const { result: deduped, pass: dedupPass } = removeDuplicates(data);
  data = deduped;
  passes.push(dedupPass);

  // Pass 2: Detect and convert units (meters -> feet, mm -> inches)
  const { result: unitConverted, pass: unitPass, conversions } = detectAndConvertUnits(data);
  data = unitConverted;
  passes.push(unitPass);

  // Pass 3: Clamp outliers
  const { result: clamped, pass: clampPass, outlierCount } = clampOutliers(data);
  data = clamped;
  passes.push(clampPass);

  // Pass 4: Interpolate missing values
  const { result: interpolated, pass: interpPass, interpCount } = interpolateMissing(data);
  data = interpolated;
  passes.push(interpPass);

  // Pass 5: Enforce distance monotonicity
  const { result: monotonic, pass: monoPass, issueCount: monoIssues } = enforceMonotonicity(data);
  data = monotonic;
  passes.push(monoPass);

  // Pass 6: Cross-run wall thickness consistency
  if (otherRuns && otherRuns.length > 0) {
    const { result: wtChecked, pass: wtPass } = crossRunWallThickness(data, otherRuns);
    data = wtChecked;
    passes.push(wtPass);
  }

  // Pass 7: Flag anomalies with zero dimensions
  const { result: flagged, pass: flagPass } = flagZeroDimensions(data);
  data = flagged;
  passes.push(flagPass);

  const report: CleaningReport = {
    run_index: runIndex,
    run_year: runYear,
    original_row_count: originalCount,
    final_row_count: data.length,
    duplicates_removed: originalCount - deduped.length,
    units_converted: conversions,
    outliers_clamped: outlierCount,
    missing_values_interpolated: interpCount,
    distance_monotonicity_issues: monoIssues,
    passes,
  };

  return { cleaned: data, report };
}

// ============================================================
// Pass 1: Duplicate Removal
// ============================================================

function removeDuplicates(data: NormalizedAnomaly[]): {
  result: NormalizedAnomaly[];
  pass: CleaningPass;
} {
  const seen = new Set<string>();
  const unique: NormalizedAnomaly[] = [];
  let removedCount = 0;

  for (const a of data) {
    // Composite key: distance + clock + feature type + depth
    const key = `${a.distance.toFixed(2)}_${a.clock_degrees.toFixed(0)}_${a.canonical_type}_${a.depth_percent.toFixed(1)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    } else {
      removedCount++;
    }
  }

  return {
    result: unique,
    pass: {
      name: 'Duplicate Removal',
      description: 'Removed exact duplicate rows based on distance, clock, type, and depth.',
      rows_affected: removedCount,
      details: removedCount > 0
        ? [`Removed ${removedCount} duplicate rows`]
        : ['No duplicates found'],
    },
  };
}

// ============================================================
// Pass 2: Unit Detection & Conversion
// ============================================================

function detectAndConvertUnits(data: NormalizedAnomaly[]): {
  result: NormalizedAnomaly[];
  pass: CleaningPass;
  conversions: { field: string; from_unit: string; to_unit: string; count: number }[];
} {
  const conversions: { field: string; from_unit: string; to_unit: string; count: number }[] = [];
  const details: string[] = [];
  let result = [...data];

  // --- Distance: detect meters vs feet ---
  // Heuristic: if max distance < 20,000 and typical pipeline is 30+ miles (158,000+ ft),
  // the data is likely in meters. If max > 100,000, it's likely feet.
  const distances = data.filter((a) => a.distance > 0).map((a) => a.distance);
  if (distances.length > 0) {
    const maxDist = Math.max(...distances);
    const medianDist = median(distances);

    // Meters threshold: typical pipeline 5-100 km = 5,000-100,000 m
    // Feet threshold: typical pipeline 26,000-528,000 ft
    // If median < 5,000 and max < 100,000 — likely meters
    if (maxDist < 100_000 && medianDist < 30_000) {
      // Looks like meters — convert to feet
      const METERS_TO_FEET = 3.28084;
      result = result.map((a) => ({
        ...a,
        distance: a.distance * METERS_TO_FEET,
        odometer: a.odometer * METERS_TO_FEET,
        corrected_distance: a.corrected_distance * METERS_TO_FEET,
        cleaning_flags: [...a.cleaning_flags, 'distance_converted_m_to_ft'],
      }));
      conversions.push({ field: 'distance', from_unit: 'meters', to_unit: 'feet', count: result.length });
      conversions.push({ field: 'odometer', from_unit: 'meters', to_unit: 'feet', count: result.length });
      details.push(`Detected distance in meters (max=${maxDist.toFixed(0)}m). Converted to feet.`);
    }
  }

  // --- Dimensions (length, width): detect mm vs inches ---
  // Heuristic: if median length > 10, it's likely mm (anomalies are typically 0.5-6 inches)
  const lengths = data.filter((a) => a.length > 0).map((a) => a.length);
  if (lengths.length > 0) {
    const medianLen = median(lengths);
    if (medianLen > 10) {
      // Looks like mm — convert to inches
      const MM_TO_IN = 0.0393701;
      result = result.map((a) => ({
        ...a,
        length: a.length * MM_TO_IN,
        width: a.width * MM_TO_IN,
        cleaning_flags: [...a.cleaning_flags, 'dimensions_converted_mm_to_in'],
      }));
      conversions.push({ field: 'length', from_unit: 'mm', to_unit: 'inches', count: result.length });
      conversions.push({ field: 'width', from_unit: 'mm', to_unit: 'inches', count: result.length });
      details.push(`Detected dimensions in mm (median length=${medianLen.toFixed(1)}mm). Converted to inches.`);
    }
  }

  // --- Wall thickness: detect mm vs inches ---
  const wts = data.filter((a) => a.wall_thickness > 0).map((a) => a.wall_thickness);
  if (wts.length > 0) {
    const medianWt = median(wts);
    // Common wall thicknesses: 0.188 - 1.0 inches, or 4.78 - 25.4 mm
    if (medianWt > 3) {
      // Looks like mm — convert to inches
      const MM_TO_IN = 0.0393701;
      result = result.map((a) => ({
        ...a,
        wall_thickness: a.wall_thickness * MM_TO_IN,
        cleaning_flags: [...a.cleaning_flags, 'wt_converted_mm_to_in'],
      }));
      conversions.push({ field: 'wall_thickness', from_unit: 'mm', to_unit: 'inches', count: result.length });
      details.push(`Detected wall thickness in mm (median=${medianWt.toFixed(1)}mm). Converted to inches.`);
    }
  }

  if (details.length === 0) {
    details.push('All units appear to be in standard format (feet/inches).');
  }

  return {
    result,
    pass: {
      name: 'Unit Detection & Conversion',
      description: 'Auto-detected metric units and converted to imperial (feet/inches).',
      rows_affected: conversions.reduce((sum, c) => sum + c.count, 0),
      details,
    },
    conversions,
  };
}

// ============================================================
// Pass 3: Outlier Clamping
// ============================================================

function clampOutliers(data: NormalizedAnomaly[]): {
  result: NormalizedAnomaly[];
  pass: CleaningPass;
  outlierCount: number;
} {
  let count = 0;
  const details: string[] = [];

  const result = data.map((a) => {
    const flags = [...a.cleaning_flags];
    let depthPct = a.depth_percent;
    let wt = a.wall_thickness;
    let len = a.length;
    let wid = a.width;

    // Depth: clamp to 0-100
    if (depthPct < 0) { depthPct = 0; flags.push('depth_clamped_low'); count++; }
    if (depthPct > 100) { depthPct = 100; flags.push('depth_clamped_high'); count++; }

    // Wall thickness: reasonable range 0.1" to 2.0"
    if (wt > 0 && wt < 0.05) { wt = 0.188; flags.push('wt_clamped_low'); count++; }
    if (wt > 2.5) { wt = 2.0; flags.push('wt_clamped_high'); count++; }

    // Length/width: reasonable range 0 to 100 inches for individual anomalies
    if (len > 100) { len = 100; flags.push('length_clamped'); count++; }
    if (wid > 100) { wid = 100; flags.push('width_clamped'); count++; }

    return {
      ...a,
      depth_percent: depthPct,
      wall_thickness: wt,
      length: len,
      width: wid,
      cleaning_flags: flags,
    };
  });

  if (count > 0) {
    details.push(`Clamped ${count} out-of-range values to reasonable bounds.`);
  } else {
    details.push('No outliers detected.');
  }

  return {
    result,
    pass: {
      name: 'Outlier Clamping',
      description: 'Clamped extreme values (depth, wall thickness, dimensions) to physically reasonable bounds.',
      rows_affected: count,
      details,
    },
    outlierCount: count,
  };
}

// ============================================================
// Pass 4: Missing Value Interpolation
// ============================================================

function interpolateMissing(data: NormalizedAnomaly[]): {
  result: NormalizedAnomaly[];
  pass: CleaningPass;
  interpCount: number;
} {
  let count = 0;
  const details: string[] = [];

  // Sort by original index to preserve order
  const sorted = [...data];

  const result = sorted.map((a, idx) => {
    const flags = [...a.cleaning_flags];

    // Distance: if 0 and we have neighbours, interpolate
    if (a.distance === 0 && idx > 0 && idx < sorted.length - 1) {
      const prev = sorted[idx - 1].distance;
      const next = sorted[idx + 1].distance;
      if (prev > 0 && next > 0) {
        const interpolated = (prev + next) / 2;
        flags.push('distance_interpolated');
        count++;
        return {
          ...a,
          distance: interpolated,
          corrected_distance: interpolated,
          cleaning_flags: flags,
        };
      }
    }

    // Odometer: if 0, use distance
    if (a.odometer === 0 && a.distance > 0) {
      flags.push('odometer_from_distance');
      count++;
      return {
        ...a,
        odometer: a.distance,
        cleaning_flags: flags,
      };
    }

    return { ...a, cleaning_flags: flags };
  });

  if (count > 0) {
    details.push(`Interpolated/estimated ${count} missing values.`);
  } else {
    details.push('No missing values needed interpolation.');
  }

  return {
    result,
    pass: {
      name: 'Missing Value Interpolation',
      description: 'Estimated missing distance/odometer values from neighbouring data.',
      rows_affected: count,
      details,
    },
    interpCount: count,
  };
}

// ============================================================
// Pass 5: Distance Monotonicity
// ============================================================

function enforceMonotonicity(data: NormalizedAnomaly[]): {
  result: NormalizedAnomaly[];
  pass: CleaningPass;
  issueCount: number;
} {
  let issues = 0;
  const details: string[] = [];

  // Data should already be sorted by distance, but check for backward jumps
  const result = data.map((a, idx) => {
    if (idx === 0) return a;

    const prev = data[idx - 1];
    if (a.distance < prev.distance && a.distance > 0 && prev.distance > 0) {
      const diff = prev.distance - a.distance;
      // Small backward jumps (< 10 ft) likely due to measurement jitter — flag but keep
      if (diff < 10) {
        issues++;
        return {
          ...a,
          cleaning_flags: [...a.cleaning_flags, `distance_backward_jump_${diff.toFixed(1)}ft`],
        };
      }
      // Larger jumps — flag strongly
      issues++;
      return {
        ...a,
        cleaning_flags: [...a.cleaning_flags, `distance_major_backward_jump_${diff.toFixed(0)}ft`],
      };
    }
    return a;
  });

  if (issues > 0) {
    details.push(`Found ${issues} distance monotonicity issues (backward jumps).`);
  } else {
    details.push('Distance values are monotonically increasing.');
  }

  return {
    result,
    pass: {
      name: 'Distance Monotonicity',
      description: 'Checked that distance values increase along the pipeline. Flagged backward jumps.',
      rows_affected: issues,
      details,
    },
    issueCount: issues,
  };
}

// ============================================================
// Pass 6: Cross-Run Wall Thickness Consistency
// ============================================================

function crossRunWallThickness(
  data: NormalizedAnomaly[],
  otherRuns: NormalizedAnomaly[][]
): {
  result: NormalizedAnomaly[];
  pass: CleaningPass;
} {
  const details: string[] = [];
  let flagged = 0;

  // Compute median wall thickness from other runs
  const otherWts: number[] = [];
  for (const run of otherRuns) {
    for (const a of run) {
      if (a.wall_thickness > 0) {
        otherWts.push(a.wall_thickness);
      }
    }
  }

  if (otherWts.length === 0) {
    return {
      result: data,
      pass: {
        name: 'Cross-Run WT Consistency',
        description: 'No other runs to compare wall thickness.',
        rows_affected: 0,
        details: ['Skipped — no other run data available.'],
      },
    };
  }

  const medianOtherWt = median(otherWts);

  // Flag anomalies whose WT differs from cross-run median by > 30%
  const result = data.map((a) => {
    if (a.wall_thickness > 0) {
      const deviation = Math.abs(a.wall_thickness - medianOtherWt) / medianOtherWt;
      if (deviation > 0.3) {
        flagged++;
        return {
          ...a,
          cleaning_flags: [
            ...a.cleaning_flags,
            `wt_cross_run_deviation_${(deviation * 100).toFixed(0)}pct`,
          ],
        };
      }
    }
    return a;
  });

  if (flagged > 0) {
    details.push(`Flagged ${flagged} anomalies with wall thickness deviating >30% from other runs (median=${medianOtherWt.toFixed(3)}").`);
  } else {
    details.push(`Wall thickness consistent across runs (median=${medianOtherWt.toFixed(3)}").`);
  }

  return {
    result,
    pass: {
      name: 'Cross-Run WT Consistency',
      description: 'Compared wall thickness values against other inspection runs.',
      rows_affected: flagged,
      details,
    },
  };
}

// ============================================================
// Pass 7: Flag Zero Dimensions
// ============================================================

function flagZeroDimensions(data: NormalizedAnomaly[]): {
  result: NormalizedAnomaly[];
  pass: CleaningPass;
} {
  let count = 0;
  const details: string[] = [];

  const result = data.map((a) => {
    // Skip reference points — they don't have meaningful dimensions
    if (a.is_reference_point) return a;

    const flags = [...a.cleaning_flags];

    if (a.length === 0 && a.width === 0 && a.depth_percent === 0) {
      flags.push('zero_dimensions');
      count++;
      return { ...a, cleaning_flags: flags, has_missing_data: true };
    }

    return a;
  });

  if (count > 0) {
    details.push(`${count} anomalies have zero length, width, and depth.`);
  } else {
    details.push('All anomalies have at least some dimensional data.');
  }

  return {
    result,
    pass: {
      name: 'Zero Dimension Check',
      description: 'Flagged anomalies with no dimensional data.',
      rows_affected: count,
      details,
    },
  };
}

// ============================================================
// Utility: Median
// ============================================================

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
