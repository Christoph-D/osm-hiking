import { Polyline } from 'react-leaflet'
import { Route } from '../services/route'

interface RouteSegmentsProps {
  route: Route | null
  tempRoute: Route | null
}

export function RouteSegments({ route, tempRoute }: RouteSegmentsProps) {
  const activeRoute = tempRoute || route

  if (!activeRoute || activeRoute.segments.length === 0) {
    return null
  }

  return (
    <>
      {activeRoute.segments.map((segment) => {
        const positions = segment.coordinates.map(
          (waypoint) => [waypoint.lat, waypoint.lon] as [number, number]
        )
        return (
          <Polyline
            key={segment.id}
            positions={positions}
            color="blue"
            weight={4}
            opacity={0.7}
          />
        )
      })}
    </>
  )
}
