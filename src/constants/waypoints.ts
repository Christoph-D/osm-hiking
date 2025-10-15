/**
 * Waypoint Constants
 *
 * Configuration values for custom waypoint behavior including
 * pixel-based distance thresholds for creation, snapping, and conversion.
 * These thresholds are defined in pixels to provide consistent visual
 * behavior across all zoom levels, then converted to meters for calculations.
 */

import { pixelsToMeters } from '../utils/zoomHelpers'

export const WAYPOINT_CONSTANTS = {
  SNAP_THRESHOLD_PIXELS: 50, // pixels - auto-snap to node within this visual distance
  CUSTOM_WAYPOINT_THRESHOLD_PIXELS: 100, // pixels - create custom if no node within this visual distance
} as const

/**
 * Get the snap-to-node threshold in meters for the current map view.
 *
 * @param latitude - Center latitude of the current map view
 * @param zoom - Current zoom level
 * @returns Snap threshold in meters
 */
export function getSnapToNodeThreshold(latitude: number, zoom: number): number {
  return pixelsToMeters(
    WAYPOINT_CONSTANTS.SNAP_THRESHOLD_PIXELS,
    latitude,
    zoom
  )
}

/**
 * Get the custom waypoint creation threshold in meters for the current map view.
 *
 * @param latitude - Center latitude of the current map view
 * @param zoom - Current zoom level
 * @returns Custom waypoint threshold in meters
 */
export function getCustomWaypointThreshold(
  latitude: number,
  zoom: number
): number {
  return pixelsToMeters(
    WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD_PIXELS,
    latitude,
    zoom
  )
}
