import type { AnomalyMatch } from '@/types';
import { PRIORITY_CONFIG } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AnomalyPopupProps {
  match: AnomalyMatch;
  onViewDetails: () => void;
}

const priorityVariantMap: Record<string, 'immediate' | 'sixtyDay' | 'oneEightyDay' | 'scheduled' | 'monitor'> = {
  'IMMEDIATE': 'immediate',
  '60-DAY': 'sixtyDay',
  '180-DAY': 'oneEightyDay',
  'SCHEDULED': 'scheduled',
  'MONITOR': 'monitor',
};

export function AnomalyPopup({ match, onViewDetails }: AnomalyPopupProps) {
  const latest = match.anomalies[match.anomalies.length - 1];
  const config = PRIORITY_CONFIG[match.priority];

  return (
    <div className="p-1 min-w-[250px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900 text-sm">
          {latest.feature_id}
        </span>
        <Badge variant={priorityVariantMap[match.priority]}>
          {config.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
        <div>
          <span className="text-gray-500">Depth:</span>{' '}
          <span className="font-medium">{latest.depth_percent.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-gray-500">Clock:</span>{' '}
          <span className="font-medium">{latest.clock_display}</span>
        </div>
        <div>
          <span className="text-gray-500">Growth:</span>{' '}
          <span className={`font-medium ${match.depth_growth_rate > 3 ? 'text-red-600' : 'text-gray-900'}`}>
            {match.depth_growth_rate.toFixed(2)}%/yr
          </span>
        </div>
        <div>
          <span className="text-gray-500">Type:</span>{' '}
          <span className="font-medium capitalize">{latest.canonical_type.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-gray-500">Distance:</span>{' '}
          <span className="font-medium">{latest.corrected_distance.toFixed(0)} ft</span>
        </div>
        <div>
          <span className="text-gray-500">Time to Critical:</span>{' '}
          <span className={`font-medium ${match.time_to_critical !== null && match.time_to_critical < 5 ? 'text-red-600' : ''}`}>
            {match.time_to_critical !== null ? `${match.time_to_critical.toFixed(1)} yr` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-2 italic">
        {config.description}
      </div>

      <Button size="sm" className="w-full" onClick={onViewDetails}>
        View Full Details
      </Button>
    </div>
  );
}
