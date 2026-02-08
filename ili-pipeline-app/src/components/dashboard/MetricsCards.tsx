import { usePipelineStore } from '@/store/pipelineStore';
import { Card, CardContent } from '@/components/ui/card';
import { PRIORITY_CONFIG } from '@/types';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Gauge,
  Clock,
} from 'lucide-react';

export function MetricsCards() {
  const { matches, odometerDrift, runFiles } = usePipelineStore();

  const totalAnomalies = matches.length;
  const matchedCount = matches.filter((m) => m.match_status === 'matched').length;
  const uncertainCount = matches.filter((m) => m.match_status === 'uncertain').length;
  const newCount = matches.filter((m) => m.match_status === 'new').length;
  const missingCount = matches.filter((m) => m.match_status === 'missing').length;

  const criticalCount = matches.filter(
    (m) => m.priority === 'IMMEDIATE' || m.priority === '60-DAY'
  ).length;

  const avgGrowthRate =
    matches.filter((m) => m.depth_growth_rate > 0).length > 0
      ? matches
          .filter((m) => m.depth_growth_rate > 0)
          .reduce((sum, m) => sum + m.depth_growth_rate, 0) /
        matches.filter((m) => m.depth_growth_rate > 0).length
      : 0;

  const fastestGrowing = matches
    .filter((m) => m.depth_growth_rate > 0)
    .sort((a, b) => b.depth_growth_rate - a.depth_growth_rate)[0];

  const maxDrift = odometerDrift.length > 0
    ? Math.max(...odometerDrift.map((d) => Math.abs(d.drift)))
    : 0;

  const matchRate = totalAnomalies > 0
    ? ((matchedCount + uncertainCount) / totalAnomalies * 100)
    : 0;

  const metrics = [
    {
      title: 'Total Anomalies',
      value: totalAnomalies.toLocaleString(),
      subtitle: `${matchedCount} matched, ${newCount} new, ${missingCount} missing`,
      icon: <Activity className="h-5 w-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Match Rate',
      value: `${matchRate.toFixed(1)}%`,
      subtitle: `${uncertainCount} uncertain matches need review`,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Critical Priority',
      value: criticalCount.toString(),
      subtitle: 'Immediate + 60-Day repairs needed',
      icon: <AlertTriangle className="h-5 w-5" />,
      color: criticalCount > 0 ? 'text-red-600' : 'text-green-600',
      bgColor: criticalCount > 0 ? 'bg-red-50' : 'bg-green-50',
    },
    {
      title: 'Avg Growth Rate',
      value: `${avgGrowthRate.toFixed(2)}%/yr`,
      subtitle: fastestGrowing
        ? `Fastest: ${fastestGrowing.anomalies[fastestGrowing.anomalies.length - 1]?.feature_id} (${fastestGrowing.depth_growth_rate.toFixed(2)}%/yr)`
        : 'No growth detected',
      icon: <TrendingUp className="h-5 w-5" />,
      color: avgGrowthRate > 3 ? 'text-red-600' : 'text-yellow-600',
      bgColor: avgGrowthRate > 3 ? 'bg-red-50' : 'bg-yellow-50',
    },
    {
      title: 'Max Odometer Drift',
      value: `${maxDrift.toFixed(1)} ft`,
      subtitle: maxDrift > 50 ? 'Recalibration recommended' : 'Within acceptable range',
      icon: <Gauge className="h-5 w-5" />,
      color: maxDrift > 50 ? 'text-orange-600' : 'text-green-600',
      bgColor: maxDrift > 50 ? 'bg-orange-50' : 'bg-green-50',
    },
    {
      title: 'Inspection Span',
      value: `${runFiles.length} Runs`,
      subtitle: runFiles.map((f) => f.year).sort().join(' → '),
      icon: <Clock className="h-5 w-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {metric.title}
              </span>
              <div className={`p-1.5 rounded-lg ${metric.bgColor} ${metric.color}`}>
                {metric.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {metric.value}
            </div>
            <p className="text-xs text-gray-500 leading-tight">
              {metric.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
