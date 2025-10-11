import L from 'leaflet'

import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix default marker icon paths for production builds
// Vite/webpack need explicit imports to bundle these assets
L.Icon.Default.prototype.options.iconUrl = markerIconUrl
L.Icon.Default.prototype.options.iconRetinaUrl = markerIconRetinaUrl
L.Icon.Default.prototype.options.shadowUrl = markerShadowUrl
L.Icon.Default.imagePath = ''

// Custom flag icon for the final waypoint
export const createFlagIcon = () =>
  L.divIcon({
    className: 'custom-flag-icon',
    html: `<div style="font-size: 32px; text-align: center; line-height: 1; text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white;">🏁</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
