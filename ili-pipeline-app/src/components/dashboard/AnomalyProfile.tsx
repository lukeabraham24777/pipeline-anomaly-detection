import { useMemo } from 'react';
import { X, AlertTriangle, Clock, TrendingUp, MapPin, Ruler } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { usePipelineStore } from '@/store/pipelineStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PRIORITY_CONFIG } from '@/types';
import type { AnomalyMatch } from '@/types';

const priorityVariantMap: Record<string, 'immediate' | 'sixtyDay' | 'oneEightyDay' | 'scheduled' | 'monitor'> = {
  'IMMEDIATE': 'immediate',
  '60-DAY': 'sixtyDay',
  '180-DAY': 'oneEightyDay',
  'SCHEDULED': 'scheduled',
  'MONITOR': 'monitor',
};

interface AnomalyProfileProps {
  match: AnomalyMatch;
}

export function AnomalyProfile({ match }: AnomalyProfileProps) {
  const { setProfileOpen, setSelectedMatchId } = useUIStore();
  const { runFiles } = usePipelineStore();

  const config = PRIORITY_CONFIG[match.priority];
  const latest = match.anomalies[match.anomalies.length - 1];
  const years = runFiles.map((f) => f.year).sort();

  const handleClose = () => {
    setProfileOpen(false);
    setSelectedMatchId(null);
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg text-gray-900">{latest.feature_id}</h2>
          <Badge variant={priorityVariantMap[match.priority]} className="mt-1">
            {config.label} Priority
          </Badge>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded-lg hover:bg-gray-100"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Priority & Regulatory Info */}
        <div className="rounded-lg p-4" style={{ backgroundColor: `${config.color}10` }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4" style={{ color: config.color }} />
            <span className="font-semibold text-sm" style={{ color: config.color }}>
              {match.repair_deadline}
            </span>
          </div>
          <p className="text-xs text-gray-600">{match.regulatory_citation}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <MetricBox
            icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
            label="Depth Growth"
            value={`${match.depth_growth_rate.toFixed(2)}%/yr`}
            warning={match.depth_growth_rate > 3}
          />
          <MetricBox
            icon={<Clock className="h-4 w-4 text-orange-600" />}
            label="Time to Critical"
            value={match.time_to_critical !== null ? `${match.time_to_critical.toFixed(1)} yr` : 'N/A'}
            warning={match.time_to_critical !== null && match.time_to_critical < 5}
          />
          <MetricBox
            icon={<Ruler className="h-4 w-4 text-green-600" />}
            label="Distance"
            value={`${latest.corrected_distance.toFixed(0)} ft`}
          />
          <MetricBox
            icon={<MapPin className="h-4 w-4 text-purple-600" />}
            label="Clock Position"
            value={latest.clock_display}
          />
        </div>

        {/* Run-by-Run Comparison */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Inspection History
          </h3>
          <div className="space-y-3">
            {match.anomalies.map((anomaly, i) => {
              const year = years[match.run_indices[i]] || match.run_indices[i];
              return (
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Run {match.run_indices[i] + 1} — {year}
                    </span>
                    <span className="text-xs text-gray-400">
                      {anomaly.feature_id}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Depth</span>
                      <p className="font-medium">{anomaly.depth_percent.toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Length</span>
                      <p className="font-medium">{anomaly.length.toFixed(2)} in</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Width</span>
                      <p className="font-medium">{anomaly.width.toFixed(2)} in</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Distance</span>
                      <p className="font-medium">{anomaly.distance.toFixed(0)} ft</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Odometer</span>
                      <p className="font-medium">{anomaly.odometer.toFixed(0)} ft</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Wall</span>
                      <p className="font-medium">{anomaly.wall_thickness.toFixed(3)} in</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Growth Rates Summary */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Growth Rates</h3>
          <div className="space-y-2">
            <GrowthBar label="Depth" rate={match.depth_growth_rate} unit="%/yr" max={10} />
            <GrowthBar label="Length" rate={match.length_growth_rate} unit="in/yr" max={2} />
            <GrowthBar label="Width" rate={match.width_growth_rate} unit="in/yr" max={2} />
          </div>
        </div>

        {/* Match Confidence */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Match Confidence</h3>
          <div className="space-y-2">
            <ConfidenceBar label="Distance" value={match.similarity_breakdown.distance} />
            <ConfidenceBar label="Dimensions" value={match.similarity_breakdown.dimensional} />
            <ConfidenceBar label="Clock Position" value={match.similarity_breakdown.clock} />
            <ConfidenceBar label="Feature Type" value={match.similarity_breakdown.feature_type} />
            <div className="border-t pt-2 mt-2">
              <ConfidenceBar label="Overall" value={match.confidence} highlight />
            </div>
          </div>
        </div>

        {/* Clock Position Visual */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pipe Cross-Section</h3>
          <ClockPositionDiagram degrees={latest.clock_degrees} />
        </div>

        {/* Gemini Assessment */}
        {match.gemini_assessment && (
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-purple-800 mb-2">AI Assessment</h3>
            <p className="text-xs text-purple-700">{match.gemini_assessment.reasoning}</p>
            <p className="text-xs text-purple-600 mt-2">
              Recommendation: <span className="font-semibold">{match.gemini_assessment.recommendation}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricBox({
  icon,
  label,
  value,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className={`text-sm font-semibold ${warning ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function GrowthBar({
  label,
  rate,
  unit,
  max,
}: {
  label: string;
  rate: number;
  unit: string;
  max: number;
}) {
  const pct = Math.min(100, (Math.abs(rate) / max) * 100);
  const isNeg = rate < 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-14">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${
            Math.abs(rate) > max * 0.6 ? 'bg-red-500' : Math.abs(rate) > max * 0.3 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-16 text-right ${isNeg ? 'text-blue-600' : ''}`}>
        {rate.toFixed(2)} {unit}
      </span>
    </div>
  );
}

function ConfidenceBar({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs w-20 ${highlight ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
        {label}
      </span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${
            value >= 0.7 ? 'bg-green-500' : value >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className={`text-xs w-10 text-right ${highlight ? 'font-semibold' : ''}`}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function ClockPositionDiagram({ degrees }: { degrees: number }) {
  const radius = 50;
  const cx = 60;
  const cy = 60;

  // Convert degrees to SVG coordinates (0° = 12 o'clock = top)
  const rad = ((degrees - 90) * Math.PI) / 180;
  const dotX = cx + radius * Math.cos(rad);
  const dotY = cy + radius * Math.sin(rad);

  return (
    <div className="flex justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Pipe cross-section */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#d1d5db" strokeWidth="8" />
        <circle cx={cx} cy={cy} r={radius - 4} fill="none" stroke="#e5e7eb" strokeWidth="1" />

        {/* Clock markers */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const r = ((deg - 90) * Math.PI) / 180;
          const x1 = cx + (radius - 12) * Math.cos(r);
          const y1 = cy + (radius - 12) * Math.sin(r);
          const x2 = cx + (radius - 6) * Math.cos(r);
          const y2 = cy + (radius - 6) * Math.sin(r);
          return (
            <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth="1" />
          );
        })}

        {/* 12, 3, 6, 9 labels */}
        <text x={cx} y={15} textAnchor="middle" fontSize="8" fill="#6b7280">12</text>
        <text x={115} y={cy + 3} textAnchor="middle" fontSize="8" fill="#6b7280">3</text>
        <text x={cx} y={112} textAnchor="middle" fontSize="8" fill="#6b7280">6</text>
        <text x={5} y={cy + 3} textAnchor="middle" fontSize="8" fill="#6b7280">9</text>

        {/* Anomaly position */}
        <circle cx={dotX} cy={dotY} r={5} fill="#dc2626" stroke="white" strokeWidth="2" />

        {/* Line from center to anomaly */}
        <line x1={cx} y1={cy} x2={dotX} y2={dotY} stroke="#dc2626" strokeWidth="1" strokeDasharray="3,2" />
      </svg>
    </div>
  );
}
