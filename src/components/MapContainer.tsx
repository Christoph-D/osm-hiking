import { useEffect, useState, useRef } from 'react'
import { MapContainer as LeafletMapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet'
import { LeafletEvent } from 'leaflet'
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
  const waypointNodeIds = useRef<string[]>([])
  const isProcessingMarkerClick = useRef(false)
  const { route, addSegment, updateWaypoint, deleteWaypoint, clearRoute, setLoading, setError } = useRouteStore()

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
        waypointNodeIds.current = []
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
      // Ignore clicks that are from marker interactions
      if (isProcessingMarkerClick.current) {
        isProcessingMarkerClick.current = false
        return
      }

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

      // Get the actual node coordinates
      const node = router.getNode(nodeId)
      if (!node) {
        setError('Invalid node selected.')
        return
      }

      // First waypoint - just mark it
      if (!lastWaypoint) {
        setLastWaypoint(nodeId)
        waypointNodeIds.current = [nodeId]
        addSegment({ coordinates: [[node.lon, node.lat]], distance: 0 }, [node.lon, node.lat])
        return
      }

      // Route from last waypoint to new one
      const segment = router.route(lastWaypoint, nodeId)

      if (!segment) {
        setError('Could not find a route between these points.')
        return
      }

      waypointNodeIds.current.push(nodeId)
      addSegment(segment, [node.lon, node.lat])
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

  const handleMarkerDrag = (index: number, event: LeafletEvent) => {
    if (!router) return

    const marker = event.target
    const { lat, lng } = marker.getLatLng()

    // Find nearest node to new position
    const nodeId = router.findNearestNode(lat, lng, 500)
    if (!nodeId) return

    const node = router.getNode(nodeId)
    if (!node) return

    // Snap marker to the node
    marker.setLatLng([node.lat, node.lon])

    // Update the waypoint node ID
    waypointNodeIds.current[index] = nodeId

    // Recalculate all segments
    const newSegments: typeof route.segments = []
    let totalDistance = 0

    for (let i = 0; i < waypointNodeIds.current.length; i++) {
      if (i === 0) {
        // First waypoint - just a marker
        const firstNode = router.getNode(waypointNodeIds.current[i])
        if (firstNode) {
          newSegments.push({ coordinates: [[firstNode.lon, firstNode.lat]], distance: 0 })
        }
      } else {
        // Route from previous waypoint
        const segment = router.route(waypointNodeIds.current[i - 1], waypointNodeIds.current[i])
        if (segment) {
          newSegments.push(segment)
          totalDistance += segment.distance
        }
      }
    }

    // Update the last waypoint reference
    setLastWaypoint(waypointNodeIds.current[waypointNodeIds.current.length - 1])

    // Update the route store
    updateWaypoint(index, [node.lon, node.lat], newSegments, totalDistance)
  }

  const handleMarkerClick = (event: LeafletEvent) => {
    // Mark that we're processing a marker click to prevent map click handler
    isProcessingMarkerClick.current = true
    event.originalEvent?.stopPropagation()
  }

  const handleMarkerDoubleClick = (index: number, event: LeafletEvent) => {
    if (!router) return

    // Mark that we're processing a marker click to prevent map click handler
    isProcessingMarkerClick.current = true
    event.originalEvent?.stopPropagation()

    // Remove this waypoint from the node IDs list
    waypointNodeIds.current.splice(index, 1)

    // If no waypoints left, clear everything
    if (waypointNodeIds.current.length === 0) {
      clearRoute()
      setLastWaypoint(null)
      return
    }

    // Recalculate all segments
    const newSegments: typeof route.segments = []
    let totalDistance = 0

    for (let i = 0; i < waypointNodeIds.current.length; i++) {
      if (i === 0) {
        // First waypoint - just a marker
        const firstNode = router.getNode(waypointNodeIds.current[i])
        if (firstNode) {
          newSegments.push({ coordinates: [[firstNode.lon, firstNode.lat]], distance: 0 })
        }
      } else {
        // Route from previous waypoint
        const segment = router.route(waypointNodeIds.current[i - 1], waypointNodeIds.current[i])
        if (segment) {
          newSegments.push(segment)
          totalDistance += segment.distance
        }
      }
    }

    // Update the last waypoint reference
    setLastWaypoint(waypointNodeIds.current[waypointNodeIds.current.length - 1])

    // Update the route store
    deleteWaypoint(index, newSegments, totalDistance)
  }

  if (!route) return null

  return (
    <>
      {route.segments.map((segment, i) => {
        const positions = segment.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])
        return <Polyline key={i} positions={positions} color="blue" weight={4} opacity={0.7} />
      })}
      {route.waypoints.map(([lon, lat], i) => (
        <Marker
          key={i}
          position={[lat, lon]}
          draggable={true}
          eventHandlers={{
            click: handleMarkerClick,
            dragend: (e) => handleMarkerDrag(i, e),
            dblclick: (e) => handleMarkerDoubleClick(i, e)
          }}
        />
      ))}
      <Controls onLoadData={() => loadData(true)} isDataLoaded={isDataLoaded} zoom={map.getZoom()} />
    </>
  )
}
