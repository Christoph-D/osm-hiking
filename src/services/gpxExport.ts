import { Route } from '../types'

function createGPX(coordinates: [number, number][], metadata: { name: string; desc: string; creator: string }): string {
  const trackPoints = coordinates
    .map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`)
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

export function exportRouteAsGPX(route: Route, filename: string = 'hiking-route.gpx'): void {
  // Flatten all segments into a single line
  const allCoordinates: [number, number][] = []

  route.segments.forEach(segment => {
    allCoordinates.push(...segment.coordinates)
  })

  // Convert to GPX
  const gpx = createGPX(allCoordinates, {
    creator: 'OSM Hiking Route Planner',
    name: 'Hiking Route',
    desc: `Total distance: ${(route.totalDistance / 1000).toFixed(2)} km`,
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
