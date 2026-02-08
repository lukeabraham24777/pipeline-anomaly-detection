import type { NormalizedAnomaly, PriorityLevel, MatchStatus } from '@/types';
import type { GrowthRates } from './growthRate';

export interface PriorityClassification {
  level: PriorityLevel;
  deadline: string;
  citation: string;
  score: number; // 0-100 for sorting
}

/**
 * Classify anomaly priority based on PHMSA 49 CFR 192/195 and ASME B31.8S.
 *
 * Priority levels:
 * - IMMEDIATE: depth >= 80% WT, or predicted to reach 80% within 1 year, or growth > 8%/yr
 * - 60-DAY: depth >= 60% WT, or growth > 5%/yr, or time-to-critical < 3 years
 * - 180-DAY: depth >= 40% WT, or growth > 2%/yr
 * - SCHEDULED: depth >= 20% WT, moderate conditions
 * - MONITOR: depth < 20%, minimal or no growth
 */
export function classifyPriority(
  anomalies: NormalizedAnomaly[],
  growth: GrowthRates,
  matchStatus: MatchStatus
): PriorityClassification {
  // Use most recent anomaly data
  const latest = anomalies[anomalies.length - 1];
  const depth = latest.depth_percent;
  const depthGrowth = Math.abs(growth.depth_growth_rate);
  const ttc = growth.time_to_critical;

  // IMMEDIATE conditions
  if (
    depth >= 80 ||
    (ttc !== null && ttc <= 1) ||
    depthGrowth >= 8
  ) {
    return {
      level: 'IMMEDIATE',
      deadline: 'Immediate repair required',
      citation: '49 CFR 192.485 - Remediation schedule for anomalies',
      score: 100,
    };
  }

  // 60-DAY conditions
  if (
    depth >= 60 ||
    depthGrowth >= 5 ||
    (ttc !== null && ttc <= 3)
  ) {
    return {
      level: '60-DAY',
      deadline: 'Repair within 60 days',
      citation: 'ASME B31.8S - Table 4, Condition 2',
      score: 80,
    };
  }

  // 180-DAY conditions
  if (
    depth >= 40 ||
    depthGrowth >= 2
  ) {
    return {
      level: '180-DAY',
      deadline: 'Repair within 180 days',
      citation: 'ASME B31.8S - Table 4, Condition 3',
      score: 60,
    };
  }

  // SCHEDULED conditions
  if (depth >= 20 || depthGrowth >= 0.5) {
    return {
      level: 'SCHEDULED',
      deadline: 'Schedule repair at next opportunity',
      citation: '49 CFR 192.485(c) - Scheduled conditions',
      score: 40,
    };
  }

  // MONITOR
  return {
    level: 'MONITOR',
    deadline: 'Monitor at next inspection',
    citation: '49 CFR 192.485(d) - Monitored conditions',
    score: 20,
  };
}

/**
 * Get a numeric sort score for priority level (higher = more urgent).
 */
export function priorityToScore(level: PriorityLevel): number {
  const scores: Record<PriorityLevel, number> = {
    'IMMEDIATE': 100,
    '60-DAY': 80,
    '180-DAY': 60,
    'SCHEDULED': 40,
    'MONITOR': 20,
  };
  return scores[level];
}
