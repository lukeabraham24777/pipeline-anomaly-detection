import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ScatterChart,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { AnomalyMatch, RunFile } from '@/types';

interface GrowthTrendChartProps {
  match: AnomalyMatch;
  runFiles: RunFile[];
}

export function GrowthTrendChart({ match, runFiles }: GrowthTrendChartProps) {
  const years = useMemo(
    () => runFiles.map((f) => f.year).sort(),
    [runFiles]
  );

  const chartData = useMemo(() => {
    if (match.anomalies.length < 2) return [];

    const data: { year: number; depth: number; predicted?: number }[] = [];

    // Actual data points
    for (let i = 0; i < match.anomalies.length; i++) {
      const year = years[match.run_indices[i]];
      data.push({
        year,
        depth: match.anomalies[i].depth_percent,
      });
    }

    // Add prediction points if growth rate is positive
    if (match.depth_growth_rate > 0) {
      const lastYear = Math.max(...data.map((d) => d.year));
      const lastDepth = data[data.length - 1].depth;

      // Predict 5, 10, 15, 20 years into the future
      for (const offset of [5, 10, 15, 20]) {
        const futureYear = lastYear + offset;
        const futureDepth = Math.min(100, lastDepth + match.depth_growth_rate * offset);
        data.push({
          year: futureYear,
          depth: futureDepth,
          predicted: futureDepth,
        });
        if (futureDepth >= 100) break;
      }
    }

    return data;
  }, [match, years]);

  const latestAnomaly = match.anomalies[match.anomalies.length - 1];

  if (chartData.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Growth Trend: {latestAnomaly.feature_id}
        </CardTitle>
        <CardDescription>
          Depth progression across inspections with future projection
          {match.time_to_critical !== null && (
            <span className={match.time_to_critical < 5 ? 'text-red-600 font-semibold' : ''}>
              {' '}— Estimated {match.time_to_critical.toFixed(1)} years to critical threshold
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" />
            <YAxis
              domain={[0, 100]}
              label={{ value: 'Depth (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip
              formatter={(value: unknown, name?: string) => [
                `${Number(value).toFixed(1)}%`,
                name === 'depth' ? 'Actual Depth' : 'Predicted Depth',
              ]}
            />
            <Legend />

            {/* Critical threshold at 80% */}
            <ReferenceLine
              y={80}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label={{ value: '80% Critical', position: 'right', fill: '#dc2626', fontSize: 11 }}
            />

            {/* Warning threshold at 60% */}
            <ReferenceLine
              y={60}
              stroke="#ea580c"
              strokeDasharray="3 3"
              label={{ value: '60% Warning', position: 'right', fill: '#ea580c', fontSize: 10 }}
            />

            {/* Actual depth line */}
            <Line
              type="monotone"
              dataKey="depth"
              name="Actual Depth"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 5 }}
              connectNulls={false}
            />

            {/* Predicted line (dashed) */}
            <Line
              type="monotone"
              dataKey="predicted"
              name="Predicted"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#ef4444', r: 4 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
