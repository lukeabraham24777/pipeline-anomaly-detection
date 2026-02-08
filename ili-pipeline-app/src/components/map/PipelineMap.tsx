import { useState, useCallback, useMemo } from 'react';
import Map, { Source, Layer, Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { usePipelineStore } from '@/store/pipelineStore';
import { useUIStore } from '@/store/uiStore';
import { DEMO_PIPELINE_COORDINATES } from '@/data/demoPipeline';
import { PRIORITY_CONFIG } from '@/types';
import type { AnomalyMatch } from '@/types';
import { AnomalyPopup } from './AnomalyPopup';
import { AlertCircle } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export function PipelineMap() {
  const { matches } = usePipelineStore();
  const { selectedMatchId, setSelectedMatchId, setProfileOpen } = useUIStore();
  const [popupMatch, setPopupMatch] = useState<AnomalyMatch | null>(null);

  // Pipeline GeoJSON
  const pipelineGeoJson = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: DEMO_PIPELINE_COORDINATES.map((c) => [c.lng, c.lat]),
    },
  }), []);

  // Initial view centered on the pipeline
  const initialViewState = useMemo(() => {
    const lats = DEMO_PIPELINE_COORDINATES.map((c) => c.lat);
    const lngs = DEMO_PIPELINE_COORDINATES.map((c) => c.lng);
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      zoom: 10,
    };
  }, []);

  const handleMarkerClick = useCallback(
    (match: AnomalyMatch) => {
      setPopupMatch(match);
      setSelectedMatchId(match.id);
    },
    [setSelectedMatchId]
  );

  const handleViewDetails = useCallback(
    (match: AnomalyMatch) => {
      setSelectedMatchId(match.id);
      setProfileOpen(true);
      setPopupMatch(null);
    },
    [setSelectedMatchId, setProfileOpen]
  );

  // Get marker size based on severity
  const getMarkerSize = (match: AnomalyMatch): number => {
    const depth = match.anomalies[match.anomalies.length - 1]?.depth_percent || 0;
    if (depth >= 60) return 16;
    if (depth >= 40) return 13;
    if (depth >= 20) return 10;
    return 8;
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-[500px] bg-gray-100 flex flex-col items-center justify-center p-8">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Mapbox Token Required</h3>
        <p className="text-sm text-gray-500 text-center max-w-md mb-4">
          Add your Mapbox access token to <code className="bg-gray-200 px-1 rounded">.env</code> as <code className="bg-gray-200 px-1 rounded">VITE_MAPBOX_TOKEN</code> to enable the interactive map.
        </p>
        <p className="text-xs text-gray-400">
          Get a free token at <a href="https://mapbox.com" className="text-blue-500 underline" target="_blank" rel="noopener noreferrer">mapbox.com</a> (no credit card needed)
        </p>
        {/* Show a summary of anomalies instead */}
        <div className="mt-6 grid grid-cols-5 gap-3">
          {(['IMMEDIATE', '60-DAY', '180-DAY', 'SCHEDULED', 'MONITOR'] as const).map((level) => {
            const count = matches.filter((m) => m.priority === level).length;
            const config = PRIORITY_CONFIG[level];
            return (
              <div key={level} className="text-center">
                <div
                  className="w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: config.color }}
                >
                  {count}
                </div>
                <p className="text-xs text-gray-500">{config.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[500px] relative">
      <Map
        initialViewState={initialViewState}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />

        {/* Pipeline polyline */}
        <Source id="pipeline" type="geojson" data={pipelineGeoJson}>
          <Layer
            id="pipeline-line"
            type="line"
            paint={{
              'line-color': '#3b82f6',
              'line-width': 4,
              'line-opacity': 0.7,
            }}
          />
          <Layer
            id="pipeline-line-casing"
            type="line"
            paint={{
              'line-color': '#1e40af',
              'line-width': 6,
              'line-opacity': 0.3,
            }}
          />
        </Source>

        {/* Anomaly markers */}
        {matches
          .filter((m) => m.latitude !== 0 && m.longitude !== 0)
          .map((match) => {
            const config = PRIORITY_CONFIG[match.priority];
            const size = getMarkerSize(match);
            const isSelected = match.id === selectedMatchId;

            return (
              <Marker
                key={match.id}
                latitude={match.latitude}
                longitude={match.longitude}
                anchor="center"
                onClick={(e: { originalEvent: MouseEvent }) => {
                  e.originalEvent.stopPropagation();
                  handleMarkerClick(match);
                }}
              >
                <div
                  className={`rounded-full cursor-pointer transition-all border-2 ${
                    isSelected ? 'border-white ring-2 ring-blue-500' : 'border-white'
                  }`}
                  style={{
                    width: size * 2,
                    height: size * 2,
                    backgroundColor: config.color,
                    opacity: isSelected ? 1 : 0.85,
                    transform: isSelected ? 'scale(1.3)' : 'scale(1)',
                  }}
                  title={`${match.anomalies[match.anomalies.length - 1]?.feature_id} - ${config.label}`}
                />
              </Marker>
            );
          })}

        {/* Popup */}
        {popupMatch && (
          <Popup
            latitude={popupMatch.latitude}
            longitude={popupMatch.longitude}
            anchor="bottom"
            onClose={() => setPopupMatch(null)}
            closeOnClick={false}
            maxWidth="320px"
          >
            <AnomalyPopup
              match={popupMatch}
              onViewDetails={() => handleViewDetails(popupMatch)}
            />
          </Popup>
        )}
      </Map>

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-2">Priority Legend</p>
        <div className="space-y-1">
          {(['IMMEDIATE', '60-DAY', '180-DAY', 'SCHEDULED', 'MONITOR'] as const).map((level) => {
            const config = PRIORITY_CONFIG[level];
            const count = matches.filter((m) => m.priority === level).length;
            return (
              <div key={level} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-gray-600">{config.label}</span>
                <span className="text-gray-400 ml-auto">({count})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
