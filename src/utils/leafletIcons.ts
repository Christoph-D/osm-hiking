import L from 'leaflet'

// Custom flag icon for the final waypoint
export const createFlagIcon = () =>
  L.divIcon({
    className: 'custom-flag-icon',
    html: `<div style="font-size: 32px; text-align: center; line-height: 1; text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white;">🏁</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
