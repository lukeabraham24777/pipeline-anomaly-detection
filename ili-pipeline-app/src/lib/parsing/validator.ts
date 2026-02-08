import type { RawAnomaly, ValidationResult } from '@/types';
import { canResolveColumn } from './columnAliases';

const DESIRED_COLUMNS = [
  'feature_id',
  'distance',
  'odometer',
  'clock_position',
  'feature_type',
  'depth_percent',
  'length',
  'width',
  'wall_thickness',
];

const OPTIONAL_COLUMNS = [
  'joint_number',
  'relative_position',
  'weld_type',
];

/**
 * Validate parsed XLSX data against expected schema.
 *
 * Key change: missing columns are now WARNINGS, not errors.
 * The only hard error is a completely empty file (0 rows).
 * Files are always accepted so the data cleaner can attempt to salvage them.
 */
export function validateData(data: RawAnomaly[], headers: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Normalize incoming headers the same way xlsxParser does
  const normalizedHeaders = headers.map((h) =>
    h.toLowerCase().trim()
      .replace(/\s+/g, '_')
      .replace(/[()]/g, '')
      .replace(/%/g, 'percent')
      .replace(/['']/g, '')
      .replace(/[^\w]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  );

  // Check desired columns – missing ones are WARNINGS not errors
  const missingColumns = DESIRED_COLUMNS.filter(
    (col) => !canResolveColumn(normalizedHeaders, col)
  );

  if (missingColumns.length > 0) {
    warnings.push(
      `Could not map the following columns (defaults will be used): ${missingColumns.join(', ')}`
    );
  }

  // Check optional columns
  const missingOptional = OPTIONAL_COLUMNS.filter(
    (col) => !canResolveColumn(normalizedHeaders, col)
  );
  if (missingOptional.length > 0) {
    warnings.push(`Optional columns not found: ${missingOptional.join(', ')}`);
  }

  // The ONLY hard error: truly empty file
  if (data.length === 0) {
    errors.push('File contains no data rows');
  }

  // Data quality warnings (never block)
  if (data.length > 0) {
    let nullDistanceCount = 0;
    let nullDepthCount = 0;
    let negativeValues = 0;

    for (const row of data) {
      if (row.distance == null || isNaN(Number(row.distance))) nullDistanceCount++;
      if (row.depth_percent == null || isNaN(Number(row.depth_percent))) nullDepthCount++;
      if (Number(row.distance) < 0) negativeValues++;
      if (Number(row.depth_percent) < 0 || Number(row.depth_percent) > 100) {
        if (Number(row.depth_percent) > 110) negativeValues++;
      }
    }

    if (nullDistanceCount > 0) {
      warnings.push(`${nullDistanceCount} rows have missing or invalid distance values`);
    }
    if (nullDepthCount > 0) {
      warnings.push(`${nullDepthCount} rows have missing or invalid depth values`);
    }
    if (negativeValues > 0) {
      warnings.push(`${negativeValues} rows have out-of-range values`);
    }
  }

  return {
    is_valid: errors.length === 0, // Only false for truly empty files
    errors,
    warnings,
    missing_columns: missingColumns,
    row_count: data.length,
  };
}
