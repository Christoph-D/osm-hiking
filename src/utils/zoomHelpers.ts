/**
 * Zoom Helpers Utility
 *
 * Utility functions for calculating distances based on map zoom levels
 * and converting between pixels and meters using Web Mercator projection.
 */

/**
 * Calculate the horizontal distance of one pixel in meters at a given latitude and zoom level.
 * Uses the Web Mercator projection formula.
 *
 * Formula: meters_per_pixel = (Earth circumference * cos(latitude)) / (256 * 2^zoom)
 *
 * @param latitude - Latitude in degrees (center of the map view)
 * @param zoom - Zoom level (0-18+)
 * @returns Meters per pixel at the given location and zoom
 */
export function metersPerPixel(latitude: number, zoom: number): number {
  // Earth circumference in meters at the equator
  const EARTH_CIRCUMFERENCE = 40075016.686

  // Convert latitude to radians
  const latRad = (latitude * Math.PI) / 180

  // Calculate meters per pixel using Web Mercator projection
  return (EARTH_CIRCUMFERENCE * Math.cos(latRad)) / (256 * Math.pow(2, zoom))
}

/**
 * Convert a distance in pixels to meters at a given latitude and zoom level.
 *
 * @param pixels - Distance in pixels
 * @param latitude - Latitude in degrees (center of the map view)
 * @param zoom - Zoom level (0-18+)
 * @returns Distance in meters
 */
export function pixelsToMeters(
  pixels: number,
  latitude: number,
  zoom: number
): number {
  return pixels * metersPerPixel(latitude, zoom)
}

/**
 * Convert a distance in meters to pixels at a given latitude and zoom level.
 *
 * @param meters - Distance in meters
 * @param latitude - Latitude in degrees (center of the map view)
 * @param zoom - Zoom level (0-18+)
 * @returns Distance in pixels
 */
export function metersToPixels(
  meters: number,
  latitude: number,
  zoom: number
): number {
  return meters / metersPerPixel(latitude, zoom)
}
