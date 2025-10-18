import { Route } from './route'
import { fetchElevations } from './elevation'

import { Waypoint } from '../types'

function createGPX(
  coordinates: Waypoint[],
  metadata: { name: string; desc: string; creator: string },
  elevations?: number[]
): string {
  const trackPoints = coordinates
    .map((waypoint, i) => {
      const eleTag =
        elevations && elevations[i] !== undefined
          ? `<ele>${elevations[i].toFixed(1)}</ele>`
          : ''
      return `      <trkpt lat="${waypoint.lat}" lon="${waypoint.lon}">${eleTag}</trkpt>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${metadata.creator}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${metadata.name}</name>
    <desc>${metadata.desc}</desc>
  </metadata>
  <trk>
    <name>${metadata.name}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`
}

export async function exportRouteAsGPX(
  route: Route,
  filename: string = 'hiking-route.gpx'
): Promise<void> {
  // Collect all coordinates from segments, handling connections properly
  const allCoordinates = route.collectRouteCoordinates()

  // Fetch elevations for all coordinates
  let elevations: number[] | undefined
  try {
    elevations = await fetchElevations(allCoordinates)
  } catch (error) {
    console.warn(
      'Failed to fetch elevations for GPX export, continuing without elevation data:',
      error
    )
  }

  // Convert to GPX
  const gpx = createGPX(
    allCoordinates,
    {
      creator: 'OSM Hiking Route Planner',
      name: 'Hiking Route',
      desc: `Total distance: ${(route.totalDistance / 1000).toFixed(2)} km`,
    },
    elevations
  )

  // Download
  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
