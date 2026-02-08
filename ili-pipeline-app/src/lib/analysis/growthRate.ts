import type { NormalizedAnomaly } from '@/types';

export interface GrowthRates {
  depth_growth_rate: number; // %/yr
  length_growth_rate: number; // in/yr
  width_growth_rate: number; // in/yr
  time_to_critical: number | null; // years until 80% wall loss
  depth_trend: { year: number; value: number }[];
  predicted_depth_at_year: (year: number) => number;
}

/**
 * Calculate growth rates for matched anomalies across 2-3 runs.
 * With 3 runs, fits a linear regression for trend prediction.
 */
export function calculateGrowthRates(
  anomalies: NormalizedAnomaly[],
  runIndices: number[],
  years: number[]
): GrowthRates {
  if (anomalies.length < 2) {
    return {
      depth_growth_rate: 0,
      length_growth_rate: 0,
      width_growth_rate: 0,
      time_to_critical: null,
      depth_trend: anomalies.length > 0
        ? [{ year: years[runIndices[0]], value: anomalies[0].depth_percent }]
        : [],
      predicted_depth_at_year: () => anomalies[0]?.depth_percent || 0,
    };
  }

  // Build time series
  const depthSeries: { year: number; value: number }[] = [];
  const lengthSeries: { year: number; value: number }[] = [];
  const widthSeries: { year: number; value: number }[] = [];

  for (let i = 0; i < anomalies.length; i++) {
    const year = years[runIndices[i]];
    depthSeries.push({ year, value: anomalies[i].depth_percent });
    lengthSeries.push({ year, value: anomalies[i].length });
    widthSeries.push({ year, value: anomalies[i].width });
  }

  // Fit linear regression for depth
  const depthRegression = linearRegression(
    depthSeries.map((p) => p.year),
    depthSeries.map((p) => p.value)
  );

  const lengthRegression = linearRegression(
    lengthSeries.map((p) => p.year),
    lengthSeries.map((p) => p.value)
  );

  const widthRegression = linearRegression(
    widthSeries.map((p) => p.year),
    widthSeries.map((p) => p.value)
  );

  // Growth rate = slope of regression (per year)
  const depthGrowthRate = depthRegression.slope;
  const lengthGrowthRate = lengthRegression.slope;
  const widthGrowthRate = widthRegression.slope;

  // Time to critical (80% wall thickness)
  const currentDepth = depthSeries[depthSeries.length - 1].value;
  const currentYear = depthSeries[depthSeries.length - 1].year;
  let timeToCritical: number | null = null;

  if (depthGrowthRate > 0 && currentDepth < 80) {
    timeToCritical = (80 - currentDepth) / depthGrowthRate;
  } else if (currentDepth >= 80) {
    timeToCritical = 0;
  }

  return {
    depth_growth_rate: depthGrowthRate,
    length_growth_rate: lengthGrowthRate,
    width_growth_rate: widthGrowthRate,
    time_to_critical: timeToCritical,
    depth_trend: depthSeries,
    predicted_depth_at_year: (year: number) =>
      depthRegression.slope * year + depthRegression.intercept,
  };
}

/**
 * Simple linear regression: y = mx + b
 */
function linearRegression(
  x: number[],
  y: number[]
): { slope: number; intercept: number } {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: y[0] || 0 };

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) {
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}
