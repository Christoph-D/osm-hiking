import { useEffect, useState, useRef } from 'react'
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  Polyline,
  Marker,
  Rectangle,
  Polygon,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { LeafletEvent } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../utils/leafletIcons'
import { createFlagIcon } from '../utils/leafletIcons'
import { useRouteStore } from '../store/useRouteStore'
import { fetchOSMData } from '../services/overpass'
import { buildRoutingGraph } from '../services/graphBuilder'
import { Router } from '../services/router'
import { Controls } from './Controls'
import { ElevationProfile } from './ElevationProfile'
import {
  fetchElevations,
  subdividePathEqually,
  calculateDistances,
  calculateElevationStats,
} from '../services/elevation'
import { ElevationPoint, RouteSegment } from '../types'
import { MIN_ZOOM } from '../constants/map'

const MAP_POSITION_KEY = 'osm-hiking-map-position'

function getInitialMapPosition() {
  const saved = localStorage.getItem(MAP_POSITION_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return { center: [50.0, 10.0], zoom: 5 }
    }
  }
  return { center: [50.0, 10.0], zoom: 5 }
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
      worldCopyJump={false}
      maxBounds={[
        [-90, -180],
        [90, 180],
      ]}
      maxBoundsViscosity={1.0}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        noWrap={true}
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
  const [isCurrentViewLoaded, setIsCurrentViewLoaded] = useState(false)
  const [lastWaypoint, setLastWaypoint] = useState<string | null>(null)
  const [loadedBbox, setLoadedBbox] = useState<{
    south: number
    west: number
    north: number
    east: number
  } | null>(null)
  const [currentZoom, setCurrentZoom] = useState(map.getZoom())
  const [currentBounds, setCurrentBounds] = useState<{
    south: number
    west: number
    north: number
    east: number
  } | null>(null)
  const waypointNodeIds = useRef<string[]>([])
  const preservedWaypoints = useRef<[number, number][]>([])
  const isProcessingMarkerClick = useRef(false)
  const pendingClick = useRef<{ lat: number; lng: number } | null>(null)
  const {
    route,
    addSegment,
    insertWaypoint,
    updateWaypoint,
    deleteWaypoint,
    clearRoute: clearRouteStore,
    setLoading,
    setError,
    setLoadingElevation,
    setElevationData,
    isLoadingElevation,
    hoveredElevationPoint,
  } = useRouteStore()

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
            const coordsMatch =
              prevLastCoord &&
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
        const equallySpacedCoords = subdividePathEqually(
          allCoordinates,
          numPoints
        )

        // Fetch elevations for all equally spaced points
        const elevations = await fetchElevations(equallySpacedCoords)

        // Calculate cumulative distances along the original path
        // We need this to properly map each subdivided point to its distance
        const originalDistances = calculateDistances(allCoordinates)
        const totalDistance = originalDistances[originalDistances.length - 1]
        const spacing = totalDistance / (numPoints - 1)

        // Assign theoretical distances to each subdivided point
        // These match what the subdivision algorithm uses
        const distances = Array.from(
          { length: numPoints },
          (_, i) => i * spacing
        )

        // Build elevation profile
        // Note: equallySpacedCoords are in [lon, lat] format
        const elevationProfile: ElevationPoint[] = equallySpacedCoords.map(
          (coord, i) => ({
            distance: distances[i],
            elevation: elevations[i],
            lat: coord[1], // coord[1] is latitude
            lon: coord[0], // coord[0] is longitude
          })
        )

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
  }, [route, setLoadingElevation, setElevationData])

  // Load OSM data when user clicks "Reload Data"
  const loadData = async (
    onSuccess?: (router: Router, treatAsFirstWaypoint: boolean) => void,
    skipConfirmation = false
  ) => {
    try {
      // Check zoom level - only load if zoomed in enough (zoom 13+)
      if (!validateZoomLevel()) {
        setIsDataLoaded(false)
        pendingClick.current = null
        return
      }

      // Get current bounding box
      const bbox = getCurrentBbox()

      // Check if loading would clear existing route and confirm with user
      if (!skipConfirmation && wouldClearRoute(bbox)) {
        const confirmed = window.confirm(
          'Loading hiking paths for this area will clear your current route because some waypoints are outside the visible area. Continue?'
        )
        if (!confirmed) {
          pendingClick.current = null
          return
        }
      }

      setLoading(true)
      setError(null)

      // Check if we have an existing route and preserve waypoints if they fit in new bbox
      if (route && route.waypoints.length > 0) {
        const allWaypointsFit = route.waypoints.every(([lon, lat]) =>
          isPointInBbox(lon, lat, bbox)
        )

        if (allWaypointsFit) {
          // Preserve waypoints for recalculation after loading
          preservedWaypoints.current = [...route.waypoints]
          console.log(
            'Preserving route with waypoints:',
            preservedWaypoints.current
          )
        } else {
          // Route doesn't fit in new bbox, clear it
          clearRoute()
          preservedWaypoints.current = []
          console.log('Route does not fit in new bbox, clearing')
        }
      }

      const osmData = await fetchOSMData(bbox)

      const graph = buildRoutingGraph(osmData)
      console.log(
        `Loaded ${osmData.nodes.size} nodes, ${osmData.ways.length} ways`
      )
      console.log(`Built graph with ${graph.nodes.size} nodes`)

      const newRouter = new Router(graph)
      setRouter(newRouter)
      setLoadedBbox(bbox)
      setIsDataLoaded(true)
      setIsCurrentViewLoaded(true)

      // Clear old waypoint references if we're not preserving waypoints
      // This ensures lastWaypoint doesn't reference nodes from the old graph
      if (preservedWaypoints.current.length === 0) {
        setLastWaypoint(null)
        waypointNodeIds.current = []
      }

      // Track if we successfully preserved waypoints
      // We need to check this before clearing preservedWaypoints
      const hadPreservedWaypoints = preservedWaypoints.current.length > 0

      // Recalculate route if we have preserved waypoints
      if (hadPreservedWaypoints) {
        // Map preserved waypoints to nearest nodes in new graph
        const newNodeIds: string[] = []

        for (const [lon, lat] of preservedWaypoints.current) {
          const nodeId = newRouter.findNearestNode(lat, lon, 500)
          if (!nodeId) {
            clearRoute()
            preservedWaypoints.current = []
            waypointNodeIds.current = []
            setLastWaypoint(null)
            return
          }
          newNodeIds.push(nodeId)
        }

        // Recalculate all segments
        const newSegments: RouteSegment[] = []

        for (let i = 0; i < newNodeIds.length; i++) {
          if (i === 0) {
            // First waypoint - just a marker
            const firstNode = newRouter.getNode(newNodeIds[i])
            if (firstNode) {
              newSegments.push({
                coordinates: [[firstNode.lon, firstNode.lat]],
                distance: 0,
              })
            }
          } else {
            // Route from previous waypoint
            const segment = newRouter.route(newNodeIds[i - 1], newNodeIds[i])
            if (segment) {
              newSegments.push(segment)
            } else {
              clearRoute()
              preservedWaypoints.current = []
              waypointNodeIds.current = []
              setLastWaypoint(null)
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

        preservedWaypoints.current = []
      }

      // Call success callback if provided (even if route recalculation failed)
      // Treat pending click as first waypoint only when we didn't preserve waypoints
      if (onSuccess) {
        onSuccess(newRouter, !hadPreservedWaypoints)
      }
    } catch (error) {
      console.error('Failed to load OSM data:', error)
      const currentZoom = map.getZoom()
      const maxZoom = map.getMaxZoom()
      const errorMessage =
        currentZoom < maxZoom
          ? 'Failed to load map data. Try zooming in more and try again.'
          : 'Failed to load map data. Please try again.'
      setError(errorMessage)
      pendingClick.current = null
    } finally {
      setLoading(false)
    }
  }

  // Helper function to validate zoom level
  const validateZoomLevel = (): boolean => {
    const zoom = map.getZoom()

    if (zoom < MIN_ZOOM) {
      setError(`Zoom in to at least level ${MIN_ZOOM} to load hiking paths`)
      return false
    }
    return true
  }

  // Helper function to get current bounding box
  const getCurrentBbox = () => {
    const bounds = map.getBounds()
    return {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    }
  }

  // Helper function to check if a point is within a bounding box
  const isPointInBbox = (
    lon: number,
    lat: number,
    bbox: { south: number; west: number; north: number; east: number }
  ) => {
    return (
      lat >= bbox.south &&
      lat <= bbox.north &&
      lon >= bbox.west &&
      lon <= bbox.east
    )
  }

  // Helper function to check if loading new data would clear the existing route
  const wouldClearRoute = (newBbox: {
    south: number
    west: number
    north: number
    east: number
  }): boolean => {
    if (!route || route.waypoints.length === 0) {
      return false
    }

    // Check if all waypoints fit in the new bbox
    const allWaypointsFit = route.waypoints.every(([lon, lat]) =>
      isPointInBbox(lon, lat, newBbox)
    )

    return !allWaypointsFit
  }

  // Helper function to check if a node exists on the current route
  // Returns the segment index + 1 where the node should be inserted as a waypoint, or null if not on route
  const findNodeOnRoute = (
    nodeId: string,
    routerToUse?: Router
  ): number | null => {
    const activeRouter = routerToUse || router
    if (!route || !activeRouter || route.segments.length < 2) {
      return null
    }

    const node = activeRouter.getNode(nodeId)
    if (!node) return null

    // Check each segment (skip first segment which is just the starting waypoint marker)
    for (let segmentIdx = 1; segmentIdx < route.segments.length; segmentIdx++) {
      const segment = route.segments[segmentIdx]

      // Check if this node's coordinates match any coordinate in this segment
      for (const [lon, lat] of segment.coordinates) {
        if (
          Math.abs(lon - node.lon) < 0.000001 &&
          Math.abs(lat - node.lat) < 0.000001
        ) {
          // Node is on this segment, so it should be inserted after waypoint at segmentIdx-1
          // and before waypoint at segmentIdx
          return segmentIdx
        }
      }
    }

    return null
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

  // Process a map click to add a waypoint
  const processMapClick = (
    lat: number,
    lng: number,
    skipDataCheck = false,
    routerOverride?: Router,
    treatAsFirstWaypoint = false
  ) => {
    // Use the provided router override (for auto-load callbacks) or the state router
    const activeRouter = routerOverride || router

    if (!skipDataCheck && (!router || !isDataLoaded)) {
      setError('Map data not loaded yet.')
      return
    }

    if (!activeRouter) {
      setError('Map data not loaded yet.')
      return
    }

    // Find nearest node with increased search radius
    const nodeId = activeRouter.findNearestNode(lat, lng, 500)

    if (!nodeId) {
      setError('No path found nearby. Click closer to a hiking trail.')
      return
    }

    setError(null)

    // Get the actual node coordinates
    const node = activeRouter.getNode(nodeId)
    if (!node) {
      setError('Invalid node selected.')
      return
    }

    // First waypoint - just mark it
    // treatAsFirstWaypoint flag allows us to override the lastWaypoint check
    // This is needed when loading new data clears the old route
    if (!lastWaypoint || treatAsFirstWaypoint) {
      setLastWaypoint(nodeId)
      waypointNodeIds.current = [nodeId]
      addSegment({ coordinates: [[node.lon, node.lat]], distance: 0 }, [
        node.lon,
        node.lat,
      ])
      return
    }

    // Check if this node is on the existing route
    const insertIndex = findNodeOnRoute(nodeId, activeRouter)

    if (insertIndex !== null) {
      // Node is on the route - insert it at the correct position
      // Insert the node ID in the waypoint list
      waypointNodeIds.current.splice(insertIndex, 0, nodeId)

      // Recalculate all segments
      const newSegments: RouteSegment[] = []
      let totalDistance = 0

      for (let i = 0; i < waypointNodeIds.current.length; i++) {
        if (i === 0) {
          // First waypoint - just a marker
          const firstNode = activeRouter.getNode(waypointNodeIds.current[i])
          if (firstNode) {
            newSegments.push({
              coordinates: [[firstNode.lon, firstNode.lat]],
              distance: 0,
            })
          }
        } else {
          // Route from previous waypoint
          const segment = activeRouter.route(
            waypointNodeIds.current[i - 1],
            waypointNodeIds.current[i]
          )
          if (segment) {
            newSegments.push(segment)
            totalDistance += segment.distance
          }
        }
      }

      // Update the last waypoint reference
      setLastWaypoint(
        waypointNodeIds.current[waypointNodeIds.current.length - 1]
      )

      // Update the route store
      insertWaypoint(
        insertIndex,
        [node.lon, node.lat],
        newSegments,
        totalDistance
      )
      return
    }

    // Node is not on the route - add to the end (existing behavior)
    const segment = activeRouter.route(lastWaypoint, nodeId)

    if (!segment) {
      setError('Could not find a route between these points.')
      return
    }

    waypointNodeIds.current.push(nodeId)
    addSegment(segment, [node.lon, node.lat])
    setLastWaypoint(nodeId)
  }

  // Handle map clicks
  useMapEvents({
    click(e) {
      // Ignore clicks that are from marker interactions
      if (isProcessingMarkerClick.current) {
        isProcessingMarkerClick.current = false
        return
      }

      const { lat, lng } = e.latlng

      // Check if data needs to be loaded
      const needsDataLoad =
        !router ||
        !isDataLoaded ||
        (loadedBbox && !isPointInBbox(lng, lat, loadedBbox))

      if (needsDataLoad) {
        // Store pending click and load data
        // loadData will handle zoom validation and route clearing confirmation
        pendingClick.current = { lat, lng }
        loadData((loadedRouter, treatAsFirstWaypoint) => {
          // Process the pending click after data loads
          if (pendingClick.current) {
            const pendingLat = pendingClick.current.lat
            const pendingLng = pendingClick.current.lng
            pendingClick.current = null
            // Skip data check since we just loaded the data, pass the loaded router,
            // and treat as first waypoint if we didn't preserve the old route
            processMapClick(
              pendingLat,
              pendingLng,
              true,
              loadedRouter,
              treatAsFirstWaypoint
            )
          }
        })
        return
      }

      // Process the click normally
      processMapClick(lat, lng)
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

      // Mark that the view has changed, so button can be re-enabled
      setIsCurrentViewLoaded(false)
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
          newSegments.push({
            coordinates: [[firstNode.lon, firstNode.lat]],
            distance: 0,
          })
        }
      } else {
        // Route from previous waypoint
        const segment = router.route(
          waypointNodeIds.current[i - 1],
          waypointNodeIds.current[i]
        )
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
    const origEvent = (event as LeafletEvent & { originalEvent?: Event })
      .originalEvent
    if (origEvent) {
      origEvent.stopPropagation()
    }
  }

  const handleMarkerDoubleClick = (index: number, event: LeafletEvent) => {
    if (!router || !route) return

    // Mark that we're processing a marker click to prevent map click handler
    isProcessingMarkerClick.current = true
    const origEvent = (event as LeafletEvent & { originalEvent?: Event })
      .originalEvent
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
          newSegments.push({
            coordinates: [[firstNode.lon, firstNode.lat]],
            distance: 0,
          })
        }
      } else {
        // Route from previous waypoint
        const segment = router.route(
          waypointNodeIds.current[i - 1],
          waypointNodeIds.current[i]
        )
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

    // Reset the marker click flag so subsequent map clicks work
    isProcessingMarkerClick.current = false
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
                [-90, -180],
              ],
              // Inner ring (hole): the loaded bounding box
              [
                [loadedBbox.south, loadedBbox.west],
                [loadedBbox.north, loadedBbox.west],
                [loadedBbox.north, loadedBbox.east],
                [loadedBbox.south, loadedBbox.east],
                [loadedBbox.south, loadedBbox.west],
              ],
            ]}
            pathOptions={{
              color: 'transparent',
              fillColor: 'gray',
              fillOpacity: 0.4,
              weight: 0,
            }}
          />
          {/* Green border around loaded region */}
          <Rectangle
            bounds={[
              [loadedBbox.south, loadedBbox.west],
              [loadedBbox.north, loadedBbox.east],
            ]}
            pathOptions={{
              color: 'green',
              weight: 2,
              fillOpacity: 0,
              dashArray: '5, 5',
            }}
          />
        </>
      )}

      {route && (
        <>
          {route.segments.map((segment, i) => {
            const positions = segment.coordinates.map(
              ([lon, lat]) => [lat, lon] as [number, number]
            )
            return (
              <Polyline
                key={i}
                positions={positions}
                color="blue"
                weight={4}
                opacity={0.7}
              />
            )
          })}
          {route.waypoints.map(([lon, lat], i) => {
            const isLastWaypoint =
              i === route.waypoints.length - 1 && route.waypoints.length > 1
            return (
              <Marker
                key={i}
                position={[lat, lon]}
                draggable={true}
                icon={isLastWaypoint ? createFlagIcon() : new L.Icon.Default()}
                eventHandlers={{
                  click: handleMarkerClick,
                  dragend: (e: LeafletEvent) => handleMarkerDrag(i, e),
                  dblclick: (e: LeafletEvent) => handleMarkerDoubleClick(i, e),
                  contextmenu: (e: LeafletEvent) =>
                    handleMarkerDoubleClick(i, e),
                }}
              />
            )
          })}
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
            weight: 2,
          }}
        />
      )}

      <Controls
        onLoadData={() => loadData(undefined, true)}
        onClearRoute={clearRoute}
        isDataLoaded={isDataLoaded}
        isCurrentViewLoaded={isCurrentViewLoaded}
        zoom={currentZoom}
        mapBounds={currentBounds}
      />
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
