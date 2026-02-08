import type { PipelineCoordinate } from '@/types';

/**
 * A fake pipeline route through West Texas (Permian Basin area).
 * ~50 miles of pipeline from Midland to Big Spring area.
 * Coordinates form a realistic pipeline corridor.
 */
export const DEMO_PIPELINE_COORDINATES: PipelineCoordinate[] = generatePipelineRoute();

function generatePipelineRoute(): PipelineCoordinate[] {
  // Start point near Midland, TX
  const startLat = 31.9973;
  const startLng = -102.0779;

  // End point near Big Spring, TX (roughly NE direction)
  const endLat = 32.2507;
  const endLng = -101.4787;

  const numPoints = 200;
  const totalDistanceFeet = 50 * 5280; // 50 miles in feet

  const coords: PipelineCoordinate[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);

    // Add some natural curvature to make it look like a real pipeline
    const curve1 = Math.sin(t * Math.PI * 2) * 0.01;
    const curve2 = Math.sin(t * Math.PI * 4) * 0.005;

    const lat = startLat + (endLat - startLat) * t + curve1;
    const lng = startLng + (endLng - startLng) * t + curve2;
    const distance = t * totalDistanceFeet;

    coords.push({ lat, lng, distance });
  }

  return coords;
}

/**
 * Get the total length of the demo pipeline in feet.
 */
export function getPipelineLength(): number {
  const coords = DEMO_PIPELINE_COORDINATES;
  return coords[coords.length - 1].distance;
}
