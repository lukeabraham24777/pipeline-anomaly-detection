import type { RawAnomaly, NormalizedAnomaly, FeatureType } from '@/types';

/**
 * Normalize raw anomaly data: convert units, standardize types, clean values.
 *
 * IMPORTANT: This function NO LONGER filters out rows with missing data.
 * Every row is kept and missing fields receive sensible defaults.
 * The `has_missing_data` flag is set so downstream logic can handle them.
 */
export function normalizeAnomalies(
  rawData: RawAnomaly[],
  runIndex: number
): NormalizedAnomaly[] {
  return rawData
    .map((row, idx) => {
      // --- String cleanup pass (trim whitespace, collapse internal spaces) ---
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        cleaned[k] = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v;
      }
      const r = cleaned as unknown as RawAnomaly;

      const clockDegrees = parseClockPosition(r.clock_position);
      const normalizedType = normalizeFeatureType(String(r.feature_type || 'unknown'));
      const isReference = ['girth_weld', 'valve', 'fitting'].includes(normalizedType);

      const dist = safeNum(r.distance, 0);
      const odo = safeNum(r.odometer, dist); // fall back to distance

      // Track if any critical field was missing / defaulted
      const hasMissing =
        r.distance == null || r.distance === '' ||
        r.depth_percent == null || r.depth_percent === '' ||
        r.feature_type == null || r.feature_type === '' ||
        r.clock_position == null || r.clock_position === '';

      return {
        id: `run${runIndex}-${idx}`,
        feature_id: String(r.feature_id || `UNKNOWN-${idx}`),
        distance: dist,
        odometer: odo,
        corrected_distance: dist, // Will be updated after alignment
        joint_number: safeNum(r.joint_number, 0),
        relative_position: safeNum(r.relative_position, 0),
        clock_degrees: clockDegrees,
        clock_display: degreesToClockDisplay(clockDegrees),
        feature_type: String(r.feature_type || 'unknown'),
        canonical_type: normalizedType,
        depth_percent: clamp(safeNum(r.depth_percent, 0), 0, 100),
        length: Math.abs(safeNum(r.length, 0)),
        width: Math.abs(safeNum(r.width, 0)),
        wall_thickness: safeNum(r.wall_thickness, 0.375), // Default to common 3/8" pipe
        weld_type: String(r.weld_type || ''),
        run_index: runIndex,
        is_reference_point: isReference,
        has_missing_data: hasMissing,
        cleaning_flags: [] as string[],
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Safely parse a number, returning the fallback if the value is null/undefined/NaN.
 */
function safeNum(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

/**
 * Parse clock position from various formats to degrees (0-360).
 * Supports: "4:30", "4.5", 4.5, "4:30 o'clock", 135 (if already degrees)
 */
function parseClockPosition(value: string | number | null | undefined): number {
  if (value == null) return 0;

  const str = String(value).trim().toLowerCase().replace(/o'?clock/g, '').trim();

  // Check if it's in "H:MM" format
  const clockMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (clockMatch) {
    const hours = parseInt(clockMatch[1], 10);
    const minutes = parseInt(clockMatch[2], 10);
    return ((hours % 12) * 30 + minutes * 0.5) % 360;
  }

  // Check if it's a decimal hour (e.g., 4.5 = 4:30)
  const num = parseFloat(str);
  if (!isNaN(num)) {
    if (num <= 12) {
      // Treat as clock hours
      return ((num % 12) * 30) % 360;
    }
    // Already in degrees
    return num % 360;
  }

  return 0;
}

/**
 * Convert degrees back to clock display format.
 */
function degreesToClockDisplay(degrees: number): string {
  const totalMinutes = (degrees / 0.5);
  const hours = Math.floor(totalMinutes / 60) || 12;
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Normalize feature type strings to canonical enum values.
 */
function normalizeFeatureType(raw: string): FeatureType {
  const lower = raw.toLowerCase().trim();

  const mapping: Record<string, FeatureType> = {
    'external metal loss': 'external_metal_loss',
    'ext metal loss': 'external_metal_loss',
    'ext. metal loss': 'external_metal_loss',
    'external corrosion': 'external_metal_loss',
    'ext corrosion': 'external_metal_loss',
    'internal metal loss': 'internal_metal_loss',
    'int metal loss': 'internal_metal_loss',
    'int. metal loss': 'internal_metal_loss',
    'internal corrosion': 'internal_metal_loss',
    'metal loss': 'metal_loss',
    'general metal loss': 'metal_loss',
    'corrosion': 'metal_loss',
    'dent': 'dent',
    'plain dent': 'dent',
    'mechanical damage': 'dent',
    'crack': 'crack',
    'scc': 'crack',
    'stress corrosion cracking': 'crack',
    'crack-like': 'crack',
    'gouge': 'gouge',
    'lamination': 'lamination',
    'manufacturing defect': 'manufacturing_defect',
    'mfg defect': 'manufacturing_defect',
    'girth weld': 'girth_weld',
    'circumferential weld': 'girth_weld',
    'seam weld': 'seam_weld',
    'longitudinal weld': 'seam_weld',
    'valve': 'valve',
    'mainline valve': 'valve',
    'fitting': 'fitting',
    'tee': 'fitting',
    'elbow': 'fitting',
    'reducer': 'fitting',
    'casing': 'casing',
  };

  for (const [pattern, type] of Object.entries(mapping)) {
    if (lower.includes(pattern) || lower === pattern) {
      return type;
    }
  }

  return 'unknown';
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
