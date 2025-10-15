import { useRef, useState } from 'react'
import { Waypoint } from '../types'
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
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
import { RouteSegments } from './RouteSegments'
import { WaypointMarkers } from './WaypointMarkers'
import { useElevationLoader } from '../hooks/useElevationLoader'
import { useDataLoader } from '../hooks/useDataLoader'
import { useRouteManagement } from '../hooks/useRouteManagement'
import { useMarkerHandlers } from '../hooks/useMarkerHandlers'
import { useMapEvents as useMapEventsHandler } from '../hooks/useMapEvents'
import { INITIAL_POSITION } from '../constants/map'

const MAP_POSITION_KEY = 'osm-hiking-map-position'

interface MapPosition {
  center: Waypoint
  zoom: number
}

function getInitialMapPosition(): MapPosition {
  const saved = localStorage.getItem(MAP_POSITION_KEY)
  const defaultPosition = { center: INITIAL_POSITION, zoom: 5 }
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (
        typeof parsed?.center?.lat !== 'number' ||
        typeof parsed?.center?.lon !== 'number' ||
        typeof parsed?.zoom !== 'number'
      ) {
        return defaultPosition
      }
      return {
        center: { lat: parsed.center.lat, lon: parsed.center.lon },
        zoom: parsed.zoom,
      }
    } catch {
      return defaultPosition
    }
  }
  return defaultPosition
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
          center: { lat: center.lat, lon: center.lng },
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
      center={[initialPosition.center.lat, initialPosition.center.lon]}
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
    clearRoute,
    setError,
    setElevationData,
    hoveredElevationPoint,
  } = useRouteStore()

  // Track if a marker is currently being dragged
  const isDraggingMarkerRef = useRef(false)

  // Temporary route state for dragging
  const [tempRoute, setTempRoute] = useState<typeof route>(null)

  // Route management hook
  const { processMapClick } = useRouteManagement()

  // Data loading hook
  const { router, isDataLoaded, loadedBbox, loadData, isLoading } =
    useDataLoader({
      map,
      route,
      clearRoute,
      setError,
    })

  const {
    handleMarkerDragStart,
    handleMarkerDrag,
    handleMarkerDragEnd,
    handleMarkerClick,
    handleMarkerDoubleClick,
  } = useMarkerHandlers({
    router,
    route,
    isDraggingMarkerRef,
    setTempRoute,
  })

  // Map events hook
  const { currentZoom, currentBounds, isCurrentViewLoaded } =
    useMapEventsHandler({
      map,
      router,
      route,
      isDataLoaded,
      loadedBbox,
      isDraggingMarkerRef,
      processMapClick,
      loadData,
    })

  // Elevation data loader hook
  useElevationLoader({
    route,
    setElevationData,
  })

  return (
    <>
      <LoadedAreaOverlay loadedBbox={loadedBbox} />

      {route && (
        <>
          <RouteSegments route={route} tempRoute={tempRoute} />
          <WaypointMarkers
            waypoints={route.waypoints}
            onMarkerClick={handleMarkerClick}
            onMarkerDragStart={handleMarkerDragStart}
            onMarkerDrag={handleMarkerDrag}
            onMarkerDragEnd={handleMarkerDragEnd}
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
        isLoading={isLoading}
      />
      {route && route.waypoints.length > 1 && (
        <ElevationProfile
          elevationProfile={route?.elevationProfile}
          elevationStats={route?.elevationStats}
        />
      )}
    </>
  )
}
