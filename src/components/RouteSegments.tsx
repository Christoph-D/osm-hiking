import { Polyline } from 'react-leaflet'
import { Route } from '../services/route'

interface RouteSegmentsProps {
  route: Route | null
  tempRoute: Route | null
}

export function RouteSegments({ route, tempRoute }: RouteSegmentsProps) {
  const activeRoute = tempRoute || route

  if (!activeRoute || activeRoute.segments.length < 2) {
    return null
  }

  return (
    <>
      {activeRoute.segments.map((segment, i) => {
        const positions = segment.coordinates.map(
          (waypoint) => [waypoint.lat, waypoint.lon] as [number, number]
        )
        return (
          <Polyline
            key={i}
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
