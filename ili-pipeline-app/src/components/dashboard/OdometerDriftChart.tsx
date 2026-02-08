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
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { usePipelineStore } from '@/store/pipelineStore';
import { getDriftStatistics } from '@/lib/alignment/odometerDrift';
import { AlertTriangle, Gauge } from 'lucide-react';

const RUN_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];

export function OdometerDriftChart() {
  const { odometerDrift, runFiles } = usePipelineStore();

  const years = useMemo(
    () => runFiles.map((f) => f.year).sort(),
    [runFiles]
  );

  // Group drift by run
  const chartData = useMemo(() => {
    if (odometerDrift.length === 0) return [];

    // Build combined data points with distance as x-axis
    const allDistances = new Set<number>();
    const byRun: Record<number, Map<number, number>> = {};

    for (const dp of odometerDrift) {
      const roundedDist = Math.round(dp.distance / 100) * 100; // Round to nearest 100ft
      allDistances.add(roundedDist);
      if (!byRun[dp.run_index]) byRun[dp.run_index] = new Map();
      byRun[dp.run_index].set(roundedDist, dp.drift);
    }

    const sortedDistances = Array.from(allDistances).sort((a, b) => a - b);

    return sortedDistances.map((dist) => {
      const point: Record<string, number> = { distance: dist };
      for (const [runIdx, driftMap] of Object.entries(byRun)) {
        const val = driftMap.get(dist);
        if (val !== undefined) {
          point[`run${runIdx}`] = val;
        }
      }
      return point;
    });
  }, [odometerDrift]);

  // Statistics per run
  const stats = useMemo(() => {
    const runIndices = [...new Set(odometerDrift.map((d) => d.run_index))];
    return runIndices.map((idx) => {
      const runDrift = odometerDrift.filter((d) => d.run_index === idx);
      return {
        runIndex: idx,
        year: years[idx] || idx,
        ...getDriftStatistics(runDrift),
      };
    });
  }, [odometerDrift, years]);

  const maxAbsDrift = stats.length > 0
    ? Math.max(...stats.map((s) => Math.max(Math.abs(s.maxDrift), Math.abs(s.minDrift))))
    : 0;

  const needsRecalibration = maxAbsDrift > 50;

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-5 w-5 text-gray-500" />
              Odometer Drift Analysis
            </CardTitle>
            <CardDescription>
              Difference between surveyed distance and odometer reading along the pipeline
            </CardDescription>
          </div>
          {needsRecalibration && (
            <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-700">
                Drift exceeds {maxAbsDrift.toFixed(0)}ft — Recalibration recommended
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="distance"
              tickFormatter={(v) => `${(v / 5280).toFixed(1)} mi`}
              label={{ value: 'Distance Along Pipeline', position: 'insideBottom', offset: -5, style: { fontSize: 12 } }}
            />
            <YAxis
              label={{ value: 'Drift (ft)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip
              formatter={(value: unknown, name?: string) => [`${Number(value).toFixed(1)} ft`, name ?? '']}
              labelFormatter={(dist) => `Distance: ${Number(dist).toFixed(0)} ft (${(Number(dist) / 5280).toFixed(2)} mi)`}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="5 5" />

            {years.map((year, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={`run${idx}`}
                name={`Run ${idx + 1} (${year})`}
                stroke={RUN_COLORS[idx % RUN_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Drift Statistics */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          {stats.map((stat) => (
            <div
              key={stat.runIndex}
              className="border border-gray-200 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: RUN_COLORS[stat.runIndex % RUN_COLORS.length] }}
                />
                <span className="text-xs font-semibold text-gray-600">
                  Run {stat.runIndex + 1} ({stat.year})
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-gray-500">Max Drift:</span>
                <span className="font-medium">{stat.maxDrift.toFixed(1)} ft</span>
                <span className="text-gray-500">Avg Drift:</span>
                <span className="font-medium">{stat.avgDrift.toFixed(1)} ft</span>
                <span className="text-gray-500">Drift Rate:</span>
                <span className="font-medium">{stat.driftRate.toFixed(2)} ft/1000ft</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
