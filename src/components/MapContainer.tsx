import { useEffect } from 'react'
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../utils/leafletIcons'
import { useRouteStore } from '../store/useRouteStore'
import { Controls } from './Controls'
import { ElevationProfile } from './ElevationProfile'
import { LoadedAreaOverlay } from './LoadedAreaOverlay'
import { WaypointMarkers } from './WaypointMarkers'
import { useElevationData } from '../hooks/useElevationData'
import { useDataLoader } from '../hooks/useDataLoader'
import { useRouteManagement } from '../hooks/useRouteManagement'
import { useMarkerHandlers } from '../hooks/useMarkerHandlers'
import { useMapEvents as useMapEventsHandler } from '../hooks/useMapEvents'
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from '../constants/map'

const MAP_POSITION_KEY = 'osm-hiking-map-position'

function getInitialMapPosition() {
  const saved = localStorage.getItem(MAP_POSITION_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return { center: [DEFAULT_LATITUDE, DEFAULT_LONGITUDE], zoom: 5 }
    }
  }
  return { center: [DEFAULT_LATITUDE, DEFAULT_LONGITUDE], zoom: 5 }
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

  // Route management hook
  const {
    waypointNodeIds,
    preservedWaypointsRef,
    clearRoute,
    processMapClick,
  } = useRouteManagement({
    route,
    addSegment,
    insertWaypoint,
    clearRouteStore,
    setError,
  })

  // Data loading hook
  const { router, isDataLoaded, loadedBbox, loadData } = useDataLoader({
    map,
    route,
    clearRoute,
    addSegment,
    clearRouteStore,
    setLoading,
    setError,
  })

  // Marker handlers hook
  const { handleMarkerDrag, handleMarkerClick, handleMarkerDoubleClick } =
    useMarkerHandlers({
      router,
      route,
      waypointNodeIdsRef: waypointNodeIds,
      updateWaypoint,
      deleteWaypoint,
      clearRoute,
    })

  // Map events hook
  const { currentZoom, currentBounds, isCurrentViewLoaded } =
    useMapEventsHandler({
      map,
      router,
      isDataLoaded,
      loadedBbox,
      processMapClick,
      loadData,
    })

  // Elevation data hook
  useElevationData({
    route,
    setLoadingElevation,
    setElevationData,
  })

  // Synchronize preservedWaypoints with route changes for data reloading
  useEffect(() => {
    if (route && route.waypoints.length > 0) {
      preservedWaypointsRef.current = [...route.waypoints]
    }
  }, [route, preservedWaypointsRef])

  return (
    <>
      <LoadedAreaOverlay loadedBbox={loadedBbox} />

      {route && (
        <>
          {route.segments.map((segment, i) => {
            const positions = segment.coordinates.map(
              (waypoint) => [waypoint.lat, waypoint.lon] as [number, number]
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
          <WaypointMarkers
            waypoints={route.waypoints}
            onMarkerClick={handleMarkerClick}
            onMarkerDrag={handleMarkerDrag}
            onMarkerDoubleClick={handleMarkerDoubleClick}
          />
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
