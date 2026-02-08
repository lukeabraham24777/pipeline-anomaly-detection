import type { PipelineCoordinate } from '@/types';
import { DEMO_PIPELINE_COORDINATES } from './demoPipeline';

/**
 * Convert a distance-along-pipe (in feet) to GPS coordinates
 * by interpolating along the pipeline polyline.
 */
export function distanceToGps(
  distanceFeet: number,
  pipelineCoords: PipelineCoordinate[] = DEMO_PIPELINE_COORDINATES
): { lat: number; lng: number } {
  if (pipelineCoords.length === 0) {
    return { lat: 0, lng: 0 };
  }

  // Clamp to pipeline extent
  const maxDist = pipelineCoords[pipelineCoords.length - 1].distance;
  const clampedDist = Math.max(0, Math.min(distanceFeet, maxDist));

  // Find the two surrounding points
  let i = 0;
  while (i < pipelineCoords.length - 1 && pipelineCoords[i + 1].distance < clampedDist) {
    i++;
  }

  if (i >= pipelineCoords.length - 1) {
    const last = pipelineCoords[pipelineCoords.length - 1];
    return { lat: last.lat, lng: last.lng };
  }

  const p1 = pipelineCoords[i];
  const p2 = pipelineCoords[i + 1];

  // Linear interpolation
  const segmentLength = p2.distance - p1.distance;
  const t = segmentLength > 0 ? (clampedDist - p1.distance) / segmentLength : 0;

  return {
    lat: p1.lat + (p2.lat - p1.lat) * t,
    lng: p1.lng + (p2.lng - p1.lng) * t,
  };
}

/**
 * Assign GPS coordinates to all anomalies based on their distance along the pipeline.
 */
export function assignGpsCoordinates<T extends { corrected_distance: number; latitude?: number; longitude?: number }>(
  anomalies: T[]
): T[] {
  return anomalies.map((a) => {
    const { lat, lng } = distanceToGps(a.corrected_distance);
    return { ...a, latitude: lat, longitude: lng };
  });
}

/**
 * Get the pipeline polyline as an array of [lng, lat] for Mapbox.
 */
export function getPipelinePolyline(): [number, number][] {
  return DEMO_PIPELINE_COORDINATES.map((c) => [c.lng, c.lat]);
}
