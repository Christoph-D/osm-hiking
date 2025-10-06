import { useEffect, useState, useRef } from 'react'
import { MapContainer as LeafletMapContainer, TileLayer, Polyline, Marker, Rectangle, Polygon, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import { LeafletEvent } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../utils/leafletIcons'
import { useRouteStore } from '../store/useRouteStore'
import { fetchOSMData } from '../services/overpass'
import { buildRoutingGraph } from '../services/graphBuilder'
import { Router } from '../services/router'
import { getCachedRegion, setCachedRegion } from '../services/cache'
import { Controls } from './Controls'
import { ElevationProfile } from './ElevationProfile'
import { fetchElevations, subdividePathEqually, calculateDistances, calculateElevationStats } from '../services/elevation'
import { ElevationPoint, RouteSegment } from '../types'

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
  const [currentZoom, setCurrentZoom] = useState(map.getZoom())
  const [currentBounds, setCurrentBounds] = useState<{ south: number; west: number; north: number; east: number } | null>(null)
  const waypointNodeIds = useRef<string[]>([])
  const preservedWaypoints = useRef<[number, number][]>([])
  const isProcessingMarkerClick = useRef(false)
  const { route, addSegment, updateWaypoint, deleteWaypoint, clearRoute: clearRouteStore, setLoading, setError, setLoadingElevation, setElevationData, isLoadingElevation, hoveredElevationPoint } = useRouteStore()

  // Wrap clearRoute to also clear local state
  const clearRoute = () => {
    clearRouteStore()
    setLastWaypoint(null)
    waypointNodeIds.current = []
    preservedWaypoints.current = []
  }

  // Fetch elevation data when route changes
  useEffect(() => {
    if (!route || route.waypoints.length < 2) {
      return
    }

    // Don't refetch if we already have elevation data
    if (route.elevationProfile) {
      return
    }

    const fetchElevationData = async () => {
      try {
        setLoadingElevation(true)

        // Collect all coordinates from all segments in order
        // The first segment is just a single point (first waypoint), subsequent segments are routes
        const allCoordinates: [number, number][] = []
        for (let i = 0; i < route.segments.length; i++) {
          const segment = route.segments[i]
          if (i === 0) {
            // First segment: include all coordinates (usually just one point)
            allCoordinates.push(...segment.coordinates)
          } else {
            // Check if this segment connects to the previous one
            const prevLastCoord = allCoordinates[allCoordinates.length - 1]
            const currFirstCoord = segment.coordinates[0]
            const coordsMatch = prevLastCoord &&
              Math.abs(prevLastCoord[0] - currFirstCoord[0]) < 0.000001 &&
              Math.abs(prevLastCoord[1] - currFirstCoord[1]) < 0.000001

            if (coordsMatch) {
              // Skip the first coordinate (it's the same as the last coordinate of the previous segment)
              allCoordinates.push(...segment.coordinates.slice(1))
            } else {
              // Segments don't connect, include all coordinates
              allCoordinates.push(...segment.coordinates)
            }
          }
        }

        // Subdivide the path into equally spaced points
        const numPoints = 70
        const equallySpacedCoords = subdividePathEqually(allCoordinates, numPoints)

        // Fetch elevations for all equally spaced points
        const elevations = await fetchElevations(equallySpacedCoords)

        // Calculate cumulative distances along the original path
        // We need this to properly map each subdivided point to its distance
        const originalDistances = calculateDistances(allCoordinates)
        const totalDistance = originalDistances[originalDistances.length - 1]
        const spacing = totalDistance / (numPoints - 1)

        // Assign theoretical distances to each subdivided point
        // These match what the subdivision algorithm uses
        const distances = Array.from({ length: numPoints }, (_, i) => i * spacing)

        // Build elevation profile
        // Note: equallySpacedCoords are in [lon, lat] format
        const elevationProfile: ElevationPoint[] = equallySpacedCoords.map((coord, i) => ({
          distance: distances[i],
          elevation: elevations[i],
          lat: coord[1],  // coord[1] is latitude
          lon: coord[0],  // coord[0] is longitude
        }))

        // Calculate stats
        const elevationStats = calculateElevationStats(elevations)

        // Update store
        setElevationData(elevationProfile, elevationStats)
      } catch (error) {
        console.error('Failed to fetch elevation data:', error)
      } finally {
        setLoadingElevation(false)
      }
    }

    fetchElevationData()
  }, [route?.segments, route?.elevationProfile, setLoadingElevation, setElevationData])

  // Load OSM data when user clicks "Reload Data"
  const loadData = async () => {
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

      // Check if we have an existing route and preserve waypoints if they fit in new bbox
      if (route && route.waypoints.length > 0) {
        const allWaypointsFit = route.waypoints.every(([lon, lat]) =>
          isPointInBbox(lon, lat, bbox)
        )

        if (allWaypointsFit) {
          // Preserve waypoints for recalculation after loading
          preservedWaypoints.current = [...route.waypoints]
          console.log('Preserving route with waypoints:', preservedWaypoints.current)
        } else {
          // Route doesn't fit in new bbox, clear it
          clearRoute()
          preservedWaypoints.current = []
          console.log('Route does not fit in new bbox, clearing')
        }
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

      const newRouter = new Router(graph)
      setRouter(newRouter)
      setLoadedBbox(bbox)
      setIsDataLoaded(true)

      // Recalculate route if we have preserved waypoints
      if (preservedWaypoints.current.length > 0) {
        console.log('Recalculating route with preserved waypoints')

        // Map preserved waypoints to nearest nodes in new graph
        const newNodeIds: string[] = []
        for (const [lon, lat] of preservedWaypoints.current) {
          const nodeId = newRouter.findNearestNode(lat, lon, 500)
          if (!nodeId) {
            console.log('Could not find node for preserved waypoint, clearing route')
            clearRoute()
            preservedWaypoints.current = []
            return
          }
          newNodeIds.push(nodeId)
        }

        // Recalculate all segments
        const newSegments: RouteSegment[] = []
        let totalDistance = 0

        for (let i = 0; i < newNodeIds.length; i++) {
          if (i === 0) {
            // First waypoint - just a marker
            const firstNode = newRouter.getNode(newNodeIds[i])
            if (firstNode) {
              newSegments.push({ coordinates: [[firstNode.lon, firstNode.lat]], distance: 0 })
            }
          } else {
            // Route from previous waypoint
            const segment = newRouter.route(newNodeIds[i - 1], newNodeIds[i])
            if (segment) {
              newSegments.push(segment)
              totalDistance += segment.distance
            } else {
              console.log('Could not route between preserved waypoints, clearing route')
              clearRoute()
              preservedWaypoints.current = []
              return
            }
          }
        }

        // Update state with recalculated route
        waypointNodeIds.current = newNodeIds
        setLastWaypoint(newNodeIds[newNodeIds.length - 1])

        // Clear the route first then rebuild it
        clearRouteStore()
        for (let i = 0; i < preservedWaypoints.current.length; i++) {
          addSegment(newSegments[i], preservedWaypoints.current[i])
        }

        console.log('Route recalculated successfully')
        preservedWaypoints.current = []
      }
    } catch (error) {
      console.error('Failed to load OSM data:', error)
      setError('Failed to load map data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to check if a point is within a bounding box
  const isPointInBbox = (lon: number, lat: number, bbox: { south: number; west: number; north: number; east: number }) => {
    return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east
  }

  useEffect(() => {
    // Initialize current bounds on mount
    const bounds = map.getBounds()
    setCurrentBounds({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    })
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
      // Update zoom level state and validate
      const zoom = map.getZoom()
      setCurrentZoom(zoom)

      // Update current bounds
      const bounds = map.getBounds()
      setCurrentBounds({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      })
    },
  })

  const handleMarkerDrag = (index: number, event: LeafletEvent) => {
    if (!router || !route) return

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
    const newSegments: RouteSegment[] = []
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
    const origEvent = (event as any).originalEvent
    if (origEvent) {
      origEvent.stopPropagation()
    }
  }

  const handleMarkerDoubleClick = (index: number, event: LeafletEvent) => {
    if (!router || !route) return

    // Mark that we're processing a marker click to prevent map click handler
    isProcessingMarkerClick.current = true
    const origEvent = (event as any).originalEvent
    if (origEvent) {
      origEvent.stopPropagation()
    }

    // Remove this waypoint from the node IDs list
    waypointNodeIds.current.splice(index, 1)

    // If no waypoints left, clear everything
    if (waypointNodeIds.current.length === 0) {
      clearRoute()
      setLastWaypoint(null)
      return
    }

    // Recalculate all segments
    const newSegments: RouteSegment[] = []
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

  return (
    <>
      {/* Show loaded bounding box with gray overlay outside */}
      {loadedBbox && (
        <>
          {/* Gray overlay with hole for loaded region */}
          <Polygon
            positions={[
              // Outer ring: covers the whole world
              [
                [-90, -180],
                [90, -180],
                [90, 180],
                [-90, 180],
                [-90, -180]
              ],
              // Inner ring (hole): the loaded bounding box
              [
                [loadedBbox.south, loadedBbox.west],
                [loadedBbox.north, loadedBbox.west],
                [loadedBbox.north, loadedBbox.east],
                [loadedBbox.south, loadedBbox.east],
                [loadedBbox.south, loadedBbox.west]
              ]
            ]}
            pathOptions={{
              color: 'transparent',
              fillColor: 'gray',
              fillOpacity: 0.4,
              weight: 0
            }}
          />
          {/* Green border around loaded region */}
          <Rectangle
            bounds={[
              [loadedBbox.south, loadedBbox.west],
              [loadedBbox.north, loadedBbox.east]
            ]}
            pathOptions={{
              color: 'green',
              weight: 2,
              fillOpacity: 0,
              dashArray: '5, 5'
            }}
          />
        </>
      )}

      {route && (
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
        </>
      )}

      {/* Hover marker for elevation profile */}
      {hoveredElevationPoint && (
        <CircleMarker
          center={[hoveredElevationPoint.lat, hoveredElevationPoint.lon]}
          radius={8}
          pathOptions={{
            color: 'red',
            fillColor: 'red',
            fillOpacity: 0.8,
            weight: 2
          }}
        />
      )}

      <Controls onLoadData={() => loadData()} onClearRoute={clearRoute} isDataLoaded={isDataLoaded} zoom={currentZoom} mapBounds={currentBounds} />
      {route?.elevationProfile && route?.elevationStats && (
        <ElevationProfile
          elevationProfile={route.elevationProfile}
          elevationStats={route.elevationStats}
          isLoading={isLoadingElevation}
        />
      )}
    </>
  )
}
