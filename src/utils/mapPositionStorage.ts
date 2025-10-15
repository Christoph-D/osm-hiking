/**
 * Map Position Storage Utilities
 *
 * Centralized utilities for managing map position persistence in localStorage.
 * This module handles saving, loading, and validating map position data.
 */

import { Waypoint } from '../types'

const MAP_POSITION_KEY = 'osm-hiking-map-position'

export interface MapPosition {
  center: Waypoint
  zoom: number
}

const DEFAULT_MAP_POSITION: MapPosition = {
  center: { lat: 50, lon: 10 },
  zoom: 5,
}

/**
 * Validates that a map position object has the correct structure
 */
function isValidMapPosition(obj: unknown): obj is MapPosition {
  if (!obj || typeof obj !== 'object') return false

  const positionObj = obj as Record<string, unknown>
  const center = positionObj.center

  if (!center || typeof center !== 'object') return false

  const centerObj = center as Record<string, unknown>

  return (
    typeof centerObj.lat === 'number' &&
    typeof centerObj.lon === 'number' &&
    typeof positionObj.zoom === 'number' &&
    !isNaN(centerObj.lat) &&
    !isNaN(centerObj.lon) &&
    !isNaN(positionObj.zoom)
  )
}

/**
 * Retrieves the saved map position from localStorage
 * Returns default position if no valid saved position exists
 */
export function getMapPosition(): MapPosition {
  if (typeof window === 'undefined') {
    return DEFAULT_MAP_POSITION
  }

  try {
    const saved = localStorage.getItem(MAP_POSITION_KEY)
    if (!saved) {
      return DEFAULT_MAP_POSITION
    }

    const parsed = JSON.parse(saved)
    if (isValidMapPosition(parsed)) {
      return {
        center: { lat: parsed.center.lat, lon: parsed.center.lon },
        zoom: parsed.zoom,
      }
    }
  } catch (error) {
    console.warn('Failed to parse saved map position:', error)
  }

  return DEFAULT_MAP_POSITION
}

/**
 * Saves the current map position to localStorage
 */
export function setMapPosition(center: Waypoint, zoom: number): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const position: MapPosition = {
      center: { lat: center.lat, lon: center.lon },
      zoom,
    }
    localStorage.setItem(MAP_POSITION_KEY, JSON.stringify(position))
  } catch (error) {
    console.warn('Failed to save map position:', error)
  }
}
