import { useEffect, useState } from 'react'
import { MapContainer as LeafletMapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../utils/leafletIcons'
import { useRouteStore } from '../store/useRouteStore'
import { fetchOSMData } from '../services/overpass'
import { buildRoutingGraph } from '../services/graphBuilder'
import { Router } from '../services/router'
import { getCachedRegion, setCachedRegion } from '../services/cache'
import { Controls } from './Controls'

const MAP_POSITION_KEY = 'osm-hiking-map-position'

function getInitialMapPosition() {
  const saved = localStorage.getItem(MAP_POSITION_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return { center: [51.505, -0.09], zoom: 13 }
    }
  }
  return { center: [51.505, -0.09], zoom: 13 }
}

function MapPositionSaver() {
  const map = useMap()

  useMapEvents({
    moveend() {
      const center = map.getCenter()
      const zoom = map.getZoom()
      localStorage.setItem(
        MAP_POSITION_KEY,
        JSON.stringify({
          center: [center.lat, center.lng],
          zoom,
        })
      )
    },
  })

  return null
}

export function MapContainer() {
  const initialPosition = getInitialMapPosition()

  return (
    <LeafletMapContainer
      center={initialPosition.center as [number, number]}
      zoom={initialPosition.zoom}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapPositionSaver />
      <RouteLayer />
    </LeafletMapContainer>
  )
}

function RouteLayer() {
  const map = useMap()
  const [router, setRouter] = useState<Router | null>(null)
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [lastWaypoint, setLastWaypoint] = useState<string | null>(null)
  const [loadedBbox, setLoadedBbox] = useState<{ south: number; west: number; north: number; east: number } | null>(null)
  const { route, addSegment, clearRoute, setLoading, setError } = useRouteStore()

  // Load OSM data when map moves
  const loadData = async (force = false) => {
    try {
      // Check zoom level - only load if zoomed in enough (zoom 13+)
      const zoom = map.getZoom()
      const MIN_ZOOM = 13

      if (zoom < MIN_ZOOM) {
        setError(`Zoom in to at least level ${MIN_ZOOM} to load hiking paths`)
        setIsDataLoaded(false)
        return
      }

      setLoading(true)
      setError(null)

      const bounds = map.getBounds()
      const bbox = {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      }

      // Check if we need to reload based on bbox change
      if (!force && loadedBbox) {
        const center = map.getCenter()
        const isInLoadedBbox =
          center.lat >= loadedBbox.south &&
          center.lat <= loadedBbox.north &&
          center.lng >= loadedBbox.west &&
          center.lng <= loadedBbox.east

        if (isInLoadedBbox) {
          setLoading(false)
          return // Still in the loaded region
        }
      }

      // Clear route when loading new region
      if (loadedBbox) {
        clearRoute()
        setLastWaypoint(null)
      }

      // Check cache first
      let osmData = await getCachedRegion(bbox)

      if (!osmData) {
        osmData = await fetchOSMData(bbox)
        await setCachedRegion(bbox, osmData)
      }

      const graph = buildRoutingGraph(osmData)
      console.log(`Loaded ${osmData.nodes.size} nodes, ${osmData.ways.length} ways`)
      console.log(`Built graph with ${graph.nodes.size} nodes`)
      setRouter(new Router(graph))
      setLoadedBbox(bbox)
      setIsDataLoaded(true)
    } catch (error) {
      console.error('Failed to load OSM data:', error)
      setError('Failed to load map data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Don't auto-load on mount - wait for user to zoom in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle map clicks
  useMapEvents({
    click(e) {
      if (!router || !isDataLoaded) {
        setError('Map data not loaded yet. Please wait...')
        return
      }

      const { lat, lng } = e.latlng
      console.log(`Clicked at: ${lat}, ${lng}`)

      // Find nearest node with increased search radius
      const nodeId = router.findNearestNode(lat, lng, 500)
      console.log(`Found node: ${nodeId}`)

      if (!nodeId) {
        setError('No path found nearby. Click closer to a hiking trail.')
        return
      }

      setError(null)

      // First waypoint - just mark it
      if (!lastWaypoint) {
        setLastWaypoint(nodeId)
        addSegment({ coordinates: [[lng, lat]], distance: 0 }, [lng, lat])
        return
      }

      // Route from last waypoint to new one
      const segment = router.route(lastWaypoint, nodeId)

      if (!segment) {
        setError('Could not find a route between these points.')
        return
      }

      addSegment(segment, [lng, lat])
      setLastWaypoint(nodeId)
    },

    moveend() {
      // Check zoom level and show message if needed
      const zoom = map.getZoom()
      if (zoom < 13) {
        setError('Zoom in to at least level 13 to load hiking paths')
        setIsDataLoaded(false)
      } else if (!isDataLoaded || !loadedBbox) {
        // Auto-load if zoomed in and no data loaded
        loadData(false)
      } else {
        // Check if we need to reload data for new region
        loadData(false)
      }
    },
  })

  if (!route) return null

  // Flatten all coordinates for rendering
  const allCoordinates = route.segments.flatMap(s =>
    s.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])
  )

  return (
    <>
      <Polyline positions={allCoordinates} color="blue" weight={4} opacity={0.7} />
      {route.waypoints.map(([lon, lat], i) => (
        <Marker key={i} position={[lat, lon]} />
      ))}
      <Controls onLoadData={() => loadData(true)} isDataLoaded={isDataLoaded} zoom={map.getZoom()} />
    </>
  )
}
