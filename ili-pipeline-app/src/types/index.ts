// ============================================================
// Core ILI Data Types
// ============================================================

export interface RawAnomaly {
  feature_id: string;
  distance: number;
  odometer: number;
  joint_number: number;
  relative_position: number;
  clock_position: string | number;
  feature_type: string;
  depth_percent: number;
  length: number;
  width: number;
  wall_thickness: number;
  weld_type?: string;
  [key: string]: unknown;
}

export interface NormalizedAnomaly {
  id: string;
  feature_id: string;
  distance: number;
  odometer: number;
  corrected_distance: number;
  joint_number: number;
  relative_position: number;
  clock_degrees: number; // 0-360
  clock_display: string; // "4:30" format
  feature_type: string;
  canonical_type: FeatureType;
  depth_percent: number;
  length: number;
  width: number;
  wall_thickness: number;
  weld_type: string;
  run_index: number;
  is_reference_point: boolean;
  has_missing_data: boolean;
  cleaning_flags: string[];
  latitude?: number;
  longitude?: number;
}

export type FeatureType =
  | 'external_metal_loss'
  | 'internal_metal_loss'
  | 'metal_loss'
  | 'dent'
  | 'crack'
  | 'gouge'
  | 'lamination'
  | 'manufacturing_defect'
  | 'girth_weld'
  | 'seam_weld'
  | 'valve'
  | 'fitting'
  | 'casing'
  | 'unknown';

// ============================================================
// Alignment Types
// ============================================================

export interface ReferencePoint {
  id: string;
  distance: number;
  odometer: number;
  joint_number: number;
  feature_type: string;
  run_index: number;
}

export interface MatchedReference {
  run1: ReferencePoint;
  run2: ReferencePoint;
  distance_offset: number;
  odometer_drift: number;
}

export interface AlignmentZone {
  start_ref: MatchedReference;
  end_ref: MatchedReference;
  correction_factor: number;
  is_pipe_replacement: boolean;
}

export interface OdometerDriftPoint {
  distance: number;
  odometer: number;
  drift: number;
  reference_label: string;
  run_index: number;
  run_year: number;
}

// ============================================================
// Matching Types
// ============================================================

export interface AnomalyMatch {
  id: string;
  anomalies: NormalizedAnomaly[]; // One per run (2 or 3)
  run_indices: number[];
  confidence: number;
  match_status: MatchStatus;
  similarity_breakdown: SimilarityBreakdown;
  // Growth data
  depth_growth_rate: number; // %/yr
  length_growth_rate: number; // in/yr
  width_growth_rate: number; // in/yr
  time_to_critical: number | null; // years
  // Priority
  priority: PriorityLevel;
  repair_deadline: string;
  regulatory_citation: string;
  // Gemini AI
  gemini_assessment?: GeminiAssessment;
  // Map position
  latitude: number;
  longitude: number;
}

export type MatchStatus = 'matched' | 'uncertain' | 'new' | 'missing';

export interface SimilarityBreakdown {
  distance: number;
  dimensional: number;
  clock: number;
  feature_type: number;
  total: number;
}

// ============================================================
// Priority Types (PHMSA 49 CFR 192/195)
// ============================================================

export type PriorityLevel = 'IMMEDIATE' | '60-DAY' | '180-DAY' | 'SCHEDULED' | 'MONITOR';

export const PRIORITY_CONFIG: Record<PriorityLevel, {
  color: string;
  bgColor: string;
  textColor: string;
  label: string;
  description: string;
}> = {
  'IMMEDIATE': {
    color: '#dc2626',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    label: 'Immediate',
    description: 'Repair required within days per 49 CFR 192.485',
  },
  '60-DAY': {
    color: '#ea580c',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    label: '60-Day',
    description: 'Repair within 60 days per ASME B31.8S',
  },
  '180-DAY': {
    color: '#eab308',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    label: '180-Day',
    description: 'Repair within 180 days per ASME B31.8S',
  },
  'SCHEDULED': {
    color: '#2563eb',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    label: 'Scheduled',
    description: 'Schedule repair at next opportunity',
  },
  'MONITOR': {
    color: '#16a34a',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    label: 'Monitor',
    description: 'Continue monitoring at next inspection',
  },
};

// ============================================================
// Gemini AI Types
// ============================================================

export interface GeminiAssessment {
  recommendation: 'match' | 'no_match' | 'uncertain';
  reasoning: string;
  adjusted_confidence: number;
}

export interface PipelineInsights {
  summary: string;
  key_risks: string[];
  recommendations: string[];
  odometer_assessment: string;
}

// ============================================================
// UI State Types
// ============================================================

export interface RunFile {
  file: File;
  name: string;
  year: number;
  run_index: number;
  raw_data: RawAnomaly[];
  normalized_data: NormalizedAnomaly[];
  row_count: number;
  validation: ValidationResult;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  missing_columns: string[];
  row_count: number;
}

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'parsing' | 'normalizing' | 'aligning' | 'matching' | 'analyzing' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

// ============================================================
// Pipeline Map Types
// ============================================================

export interface PipelineCoordinate {
  lat: number;
  lng: number;
  distance: number; // cumulative distance in feet
}

// ============================================================
// Data Cleaning Types
// ============================================================

export interface CleaningPass {
  name: string;
  description: string;
  rows_affected: number;
  details: string[];
}

export interface CleaningReport {
  run_index: number;
  run_year: number;
  original_row_count: number;
  final_row_count: number;
  duplicates_removed: number;
  units_converted: { field: string; from_unit: string; to_unit: string; count: number }[];
  outliers_clamped: number;
  missing_values_interpolated: number;
  distance_monotonicity_issues: number;
  passes: CleaningPass[];
}
