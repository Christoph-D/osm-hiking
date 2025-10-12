/**
 * Loaded Area Overlay Component
 *
 * Visual component that shows which area of the map has loaded OSM data.
 * Renders:
 * - A semi-transparent gray overlay covering areas outside the loaded region
 * - A green dashed border around the loaded bounding box
 *
 * This helps users understand where they can create routes and where they
 * need to load data first.
 */

import { Polygon, Rectangle } from 'react-leaflet'

interface LoadedAreaOverlayProps {
  loadedBbox: {
    south: number
    west: number
    north: number
    east: number
  } | null
}

/**
 * Component that displays a gray overlay outside the loaded area
 * and a green dashed border around the loaded area
 */
export function LoadedAreaOverlay({ loadedBbox }: LoadedAreaOverlayProps) {
  if (!loadedBbox) return null

  return (
    <>
      {/* Gray overlay with hole for loaded region */}
      <Polygon
        positions={[
          // Outer ring: covers the whole world
          [
            [-90, -180],
            [90, -180],
            [90, 180],
            [-90, 180],
            [-90, -180],
          ],
          // Inner ring (hole): the loaded bounding box
          [
            [loadedBbox.south, loadedBbox.west],
            [loadedBbox.north, loadedBbox.west],
            [loadedBbox.north, loadedBbox.east],
            [loadedBbox.south, loadedBbox.east],
            [loadedBbox.south, loadedBbox.west],
          ],
        ]}
        pathOptions={{
          color: 'transparent',
          fillColor: 'gray',
          fillOpacity: 0.4,
          weight: 0,
        }}
      />
      {/* Green border around loaded region */}
      <Rectangle
        bounds={[
          [loadedBbox.south, loadedBbox.west],
          [loadedBbox.north, loadedBbox.east],
        ]}
        pathOptions={{
          color: 'green',
          weight: 2,
          fillOpacity: 0,
          dashArray: '5, 5',
        }}
      />
    </>
  )
}
