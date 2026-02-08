/**
 * Comprehensive column alias map for vendor-agnostic ILI data ingestion.
 * Covers naming conventions from major ILI vendors (Rosen, TDW, PIMS, Baker Hughes, etc.)
 *
 * Keys are canonical column names used throughout the app.
 * Values are arrays of known vendor aliases (lowercase, underscored).
 */
export const COLUMN_ALIASES: Record<string, string[]> = {
  // --- Distance along pipeline ---
  distance: [
    'abs_distance', 'absolute_distance', 'dist', 'log_dist', 'log_distance',
    'chainage', 'station', 'pipeline_distance', 'cumulative_distance',
    'distance_ft', 'distance_m', 'distance_feet', 'distance_meters',
    'measured_distance', 'survey_distance', 'kp', 'milepost',
    'true_distance', 'corrected_dist', 'ref_distance',
  ],
  // --- Raw odometer reading ---
  odometer: [
    'odo', 'odometer_reading', 'odo_reading', 'raw_distance', 'tool_distance',
    'pig_distance', 'tool_odometer', 'run_distance', 'wheel_distance',
    'odo_dist', 'odometer_distance', 'internal_distance',
    'tool_odo', 'pig_odo',
  ],
  // --- Anomaly identifier ---
  feature_id: [
    'anomaly_id', 'defect_id', 'feature_number', 'feat_id',
    'indication_id', 'feature_no', 'anomaly_number', 'defect_no',
    'indication_number', 'item_id', 'item_number', 'report_id',
    'feature_identification', 'unique_id', 'record_id',
    'anomaly_no', 'defect_number', 'feature_ident',
  ],
  // --- Clock position (o'clock / degrees / decimal) ---
  clock_position: [
    'clock', 'clock_pos', 'orientation', 'circ_position', 'oclock', 'o_clock',
    'circumferential_position', 'angular_position', 'circ_loc',
    'clock_orientation', 'position_oclock', 'o_clock_position',
    'peak_clock', 'peak_orientation', 'center_clock', 'center_orientation',
    'circumferential_location', 'angular_loc',
    'circ_pos', 'peak_circ', 'clock_pos_hr',
  ],
  // --- Feature / anomaly type ---
  feature_type: [
    'anomaly_type', 'defect_type', 'classification', 'feat_type',
    'indication_type', 'feature_classification', 'anomaly_class',
    'defect_classification', 'category', 'feature_category',
    'component_type', 'indication_class',
    'anomaly_classification', 'defect_class',
  ],
  // --- Depth as percent of wall thickness ---
  depth_percent: [
    'depth', 'depth_pct', 'max_depth', 'depth_percentwall', 'depth_percent_wt',
    'depth_percent_of_wt', 'metal_loss_depth', 'peak_depth',
    'depth_percentwt', 'max_depth_percent', 'depth_of_wall',
    'depth_percent_wall_thickness', 'calculated_depth', 'measured_depth',
    'd_over_t', 'percent_wall_loss', 'wall_loss_percent',
    'depth_percentwall_thickness', 'peak_depth_percent',
  ],
  // --- Axial length ---
  length: [
    'axial_length', 'anomaly_length', 'defect_length', 'len',
    'feature_length', 'indication_length', 'extent_axial',
    'axial_extent', 'overall_length', 'total_length',
    'length_axial', 'length_in', 'length_mm',
    'axial_len', 'feat_length',
  ],
  // --- Circumferential width ---
  width: [
    'circ_width', 'anomaly_width', 'defect_width', 'circumferential_width',
    'feature_width', 'indication_width', 'extent_circ',
    'circ_extent', 'overall_width', 'total_width',
    'width_circ', 'width_in', 'width_mm',
    'circ_wid', 'feat_width',
  ],
  // --- Wall thickness ---
  wall_thickness: [
    'wt', 'nom_wt', 'nominal_wt', 'nominal_wall_thickness', 'pipe_wt',
    'wall_thick', 'wt_nominal', 'measured_wt', 'pipe_wall_thickness',
    'pipe_wall', 'pipe_thickness', 'wt_nom', 'wt_inches', 'wt_mm',
    'thickness', 'nominal_thickness',
    'wall_thk', 'nom_wall_thickness',
  ],
  // --- Joint / pipe section number ---
  joint_number: [
    'joint', 'joint_no', 'pipe_joint', 'jt_number', 'jt_no',
    'pipe_number', 'pipe_no', 'pipe_tally', 'joint_id',
    'pipe_joint_number', 'section_number', 'pipe_section',
    'jt', 'joint_num', 'pipe_jt',
  ],
  // --- Weld type ---
  weld_type: [
    'weld', 'weld_class', 'nearest_weld', 'weld_id',
    'upstream_weld', 'downstream_weld', 'weld_classification',
    'girth_weld_id', 'nearest_girth_weld',
    'weld_no', 'weld_number',
  ],
  // --- Relative position within joint ---
  relative_position: [
    'rel_position', 'rel_dist', 'relative_dist', 'dist_from_weld',
    'distance_from_upstream_weld', 'distance_from_girth_weld',
    'dist_upstream_gw', 'position_in_joint',
    'relative_distance', 'dist_from_upstream',
  ],
};

/**
 * Keyword groups that help identify columns when exact/substring match fails.
 * If a column header contains ALL keywords in a group, it maps to the canonical name.
 */
const KEYWORD_RULES: { canonical: string; keywords: string[] }[] = [
  { canonical: 'depth_percent', keywords: ['depth', 'percent'] },
  { canonical: 'depth_percent', keywords: ['depth', 'wall'] },
  { canonical: 'depth_percent', keywords: ['wall', 'loss'] },
  { canonical: 'depth_percent', keywords: ['metal', 'loss', 'depth'] },
  { canonical: 'wall_thickness', keywords: ['wall', 'thick'] },
  { canonical: 'wall_thickness', keywords: ['nominal', 'thick'] },
  { canonical: 'wall_thickness', keywords: ['pipe', 'thick'] },
  { canonical: 'clock_position', keywords: ['clock'] },
  { canonical: 'clock_position', keywords: ['circumferential', 'position'] },
  { canonical: 'clock_position', keywords: ['angular', 'position'] },
  { canonical: 'feature_type', keywords: ['anomaly', 'type'] },
  { canonical: 'feature_type', keywords: ['defect', 'type'] },
  { canonical: 'feature_type', keywords: ['feature', 'type'] },
  { canonical: 'feature_type', keywords: ['feature', 'class'] },
  { canonical: 'feature_id', keywords: ['feature', 'id'] },
  { canonical: 'feature_id', keywords: ['anomaly', 'id'] },
  { canonical: 'feature_id', keywords: ['defect', 'id'] },
  { canonical: 'joint_number', keywords: ['joint', 'number'] },
  { canonical: 'joint_number', keywords: ['joint', 'no'] },
  { canonical: 'joint_number', keywords: ['pipe', 'joint'] },
  { canonical: 'relative_position', keywords: ['relative', 'position'] },
  { canonical: 'relative_position', keywords: ['dist', 'weld'] },
  { canonical: 'length', keywords: ['axial', 'length'] },
  { canonical: 'length', keywords: ['axial', 'extent'] },
  { canonical: 'width', keywords: ['circ', 'width'] },
  { canonical: 'width', keywords: ['circ', 'extent'] },
  { canonical: 'distance', keywords: ['absolute', 'distance'] },
  { canonical: 'distance', keywords: ['log', 'dist'] },
  { canonical: 'odometer', keywords: ['odometer'] },
  { canonical: 'odometer', keywords: ['tool', 'dist'] },
];

/**
 * Resolve a normalized column header to its canonical name.
 * Uses three levels of matching:
 * 1. Exact match (header IS one of the aliases)
 * 2. Substring match (header CONTAINS an alias)
 * 3. Keyword match (header contains all keywords in a rule)
 *
 * Returns the canonical name, or null if no match found.
 */
export function resolveCanonicalName(normalizedHeader: string): string | null {
  // Don't remap if the header is already a canonical name
  const canonicalNames = Object.keys(COLUMN_ALIASES);
  if (canonicalNames.includes(normalizedHeader)) {
    return normalizedHeader;
  }

  // Level 1: Exact alias match
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(normalizedHeader)) {
      return canonical;
    }
  }

  // Level 2: Substring match (prefer longest alias = most specific)
  let bestMatch: string | null = null;
  let bestLength = 0;

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (normalizedHeader.includes(alias) && alias.length > bestLength) {
        bestMatch = canonical;
        bestLength = alias.length;
      }
    }
  }

  if (bestMatch) return bestMatch;

  // Level 3: Keyword match
  const headerWords = normalizedHeader.split(/[_\s-]+/);
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.every((kw) => headerWords.some((w) => w.includes(kw)))) {
      return rule.canonical;
    }
  }

  return null;
}

/**
 * Check if a canonical column name can be resolved from a set of headers.
 * Used by the validator to report which columns were/weren't found.
 */
export function canResolveColumn(headers: string[], canonicalName: string): boolean {
  return headers.some((h) => {
    const resolved = resolveCanonicalName(h);
    return resolved === canonicalName;
  });
}
