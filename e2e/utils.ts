/**
 * Sets the map position in localStorage for consistent testing
 */
export function setMapPosition() {
  localStorage.setItem(
    'osm-hiking-map-position',
    JSON.stringify({
      center: [50, 10],
      zoom: 15,
    })
  )
}
