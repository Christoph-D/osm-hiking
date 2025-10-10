import L from 'leaflet'

// Fix for default marker icons in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// Custom flag icon for the final waypoint
export const createFlagIcon = () =>
  L.divIcon({
    className: 'custom-flag-icon',
    html: `<div style="font-size: 32px; text-align: center; line-height: 1; text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white;">🏁</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
