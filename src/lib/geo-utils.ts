/**
 * Geographic utility functions for distance calculations
 * Uses the Haversine formula for calculating distances on Earth's surface
 * All distances are in MILES (US standard)
 */

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula
 * @param lat1 - Latitude of the first point (degrees)
 * @param lng1 - Longitude of the first point (degrees)
 * @param lat2 - Latitude of the second point (degrees)
 * @param lng2 - Longitude of the second point (degrees)
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate a bounding box for rough filtering before precise distance calculation
 * This can be used to pre-filter database results before applying exact distance calculations
 * @param lat - Center latitude (degrees)
 * @param lng - Center longitude (degrees)
 * @param radiusMiles - Radius in miles
 * @returns Bounding box coordinates
 */
export function getBoundingBox(
  lat: number,
  lng: number,
  radiusMiles: number
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  // 1 degree of latitude is approximately 69 miles
  const latDelta = radiusMiles / 69;
  // 1 degree of longitude varies with latitude
  const lngDelta = radiusMiles / (69 * Math.cos(toRadians(lat)));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/**
 * Format distance for display
 * @param distanceMiles - Distance in miles
 * @returns Formatted string (e.g., "1.5 mi" or "0.3 mi")
 */
export function formatDistance(distanceMiles: number): string {
  if (distanceMiles < 0.1) {
    // Show in feet for very short distances (1 mile = 5280 feet)
    return `${Math.round(distanceMiles * 5280)} ft`;
  }
  if (distanceMiles < 10) {
    return `${distanceMiles.toFixed(1)} mi`;
  }
  return `${Math.round(distanceMiles)} mi`;
}

/**
 * Check if a point is within a given radius from a center point
 * @param centerLat - Center latitude
 * @param centerLng - Center longitude
 * @param pointLat - Point latitude
 * @param pointLng - Point longitude
 * @param radiusMiles - Radius in miles
 * @returns true if the point is within the radius
 */
export function isWithinRadius(
  centerLat: number,
  centerLng: number,
  pointLat: number,
  pointLng: number,
  radiusMiles: number
): boolean {
  const distance = calculateDistance(centerLat, centerLng, pointLat, pointLng);
  return distance <= radiusMiles;
}

/**
 * Radius options for the selector component (in miles)
 */
export const RADIUS_OPTIONS = [
  { value: 0, label: "Any distance" },
  { value: 5, label: "5 mi" },
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
  { value: 200, label: "200 mi" },
] as const;

export type RadiusOption = (typeof RADIUS_OPTIONS)[number]["value"];
