/**
 * Sets the map position in localStorage for consistent testing
 */
export function setMapPosition() {
  localStorage.setItem(
    'osm-hiking-map-position',
    JSON.stringify({
      center: { lat: 50, lon: 10 },
      zoom: 15,
    })
  )
}
