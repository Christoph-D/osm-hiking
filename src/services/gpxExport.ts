import togpx from 'togpx'
import { Route } from '../types'

export function exportRouteAsGPX(route: Route, filename: string = 'hiking-route.gpx'): void {
  // Flatten all segments into a single line
  const allCoordinates: [number, number][] = []

  route.segments.forEach(segment => {
    allCoordinates.push(...segment.coordinates)
  })

  // Create GeoJSON Feature
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Hiking Route',
          distance: route.totalDistance,
        },
        geometry: {
          type: 'LineString',
          coordinates: allCoordinates,
        },
      },
    ],
  }

  // Convert to GPX
  const gpx = togpx(geojson, {
    creator: 'OSM Hiking Route Planner',
    metadata: {
      name: 'Hiking Route',
      desc: `Total distance: ${(route.totalDistance / 1000).toFixed(2)} km`,
    },
  })

  // Download
  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
