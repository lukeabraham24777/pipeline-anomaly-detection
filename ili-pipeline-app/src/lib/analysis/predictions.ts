import type { AnomalyMatch } from '@/types';

/**
 * Predict future depth at a given year using the growth trend.
 */
export function predictFutureDepth(
  match: AnomalyMatch,
  targetYear: number
): number {
  if (match.anomalies.length < 2 || match.depth_growth_rate === 0) {
    return match.anomalies[match.anomalies.length - 1]?.depth_percent || 0;
  }

  const latest = match.anomalies[match.anomalies.length - 1];
  const currentDepth = latest.depth_percent;
  // rough approximation: years from latest run
  const yearsAhead = targetYear - new Date().getFullYear();

  return Math.min(100, Math.max(0, currentDepth + match.depth_growth_rate * yearsAhead));
}

/**
 * Calculate repair cost estimate based on priority and anomaly type.
 */
export function estimateRepairCost(match: AnomalyMatch): {
  low: number;
  high: number;
  unit: string;
} {
  const type = match.anomalies[match.anomalies.length - 1]?.canonical_type;

  // Industry-standard cost ranges
  const costRanges: Record<string, { low: number; high: number }> = {
    external_metal_loss: { low: 50000, high: 200000 },
    internal_metal_loss: { low: 75000, high: 250000 },
    metal_loss: { low: 50000, high: 200000 },
    dent: { low: 30000, high: 150000 },
    crack: { low: 100000, high: 500000 },
    gouge: { low: 75000, high: 300000 },
    default: { low: 50000, high: 250000 },
  };

  const range = costRanges[type] || costRanges.default;

  // Adjust based on depth severity
  const depth = match.anomalies[match.anomalies.length - 1]?.depth_percent || 0;
  const severityMultiplier = depth > 60 ? 1.5 : depth > 40 ? 1.2 : 1.0;

  return {
    low: Math.round(range.low * severityMultiplier),
    high: Math.round(range.high * severityMultiplier),
    unit: 'USD',
  };
}
