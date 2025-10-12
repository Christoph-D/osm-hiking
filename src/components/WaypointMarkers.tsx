/**
 * Waypoint Markers Component
 *
 * Renders all waypoint markers on the map for a route.
 * Features:
 * - Draggable markers that snap to nearest hiking path nodes
 * - Flag icon for the last waypoint, default icon for others
 * - Double-click or right-click to remove waypoints
 * - Click events properly isolated from map click events
 *
 * This is a pure presentational component that delegates all
 * interaction logic to provided event handlers.
 */

import { Marker } from 'react-leaflet'
import { LeafletEvent } from 'leaflet'
import L from 'leaflet'
import { createFlagIcon } from '../utils/leafletIcons'

interface WaypointMarkersProps {
  waypoints: [number, number][]
  onMarkerClick: (event: LeafletEvent) => void
  onMarkerDrag: (index: number, event: LeafletEvent) => void
  onMarkerDoubleClick: (index: number, event: LeafletEvent) => void
}

/**
 * Component that renders draggable waypoint markers on the map
 */
export function WaypointMarkers({
  waypoints,
  onMarkerClick,
  onMarkerDrag,
  onMarkerDoubleClick,
}: WaypointMarkersProps) {
  return (
    <>
      {waypoints.map(([lon, lat], i) => {
        const isLastWaypoint =
          i === waypoints.length - 1 && waypoints.length > 1
        return (
          <Marker
            key={i}
            position={[lat, lon]}
            draggable={true}
            icon={isLastWaypoint ? createFlagIcon() : new L.Icon.Default()}
            eventHandlers={{
              click: onMarkerClick,
              dragend: (e: LeafletEvent) => onMarkerDrag(i, e),
              dblclick: (e: LeafletEvent) => onMarkerDoubleClick(i, e),
              contextmenu: (e: LeafletEvent) => onMarkerDoubleClick(i, e),
            }}
          />
        )
      })}
    </>
  )
}
