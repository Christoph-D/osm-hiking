import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { useRouteStore } from '../store/useRouteStore'
import { useMapDataStore } from '../store/mapDataStore'
import { ElevationPoint, ElevationStats } from '../types'
import { Route } from '../services/route'

/**
 * Custom render function that can be extended with providers if needed
 */
export function renderWithStore(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, options)
}

/**
 * Mock the route store with specific state
 */
export function mockRouteStore(
  state: Partial<ReturnType<typeof useRouteStore>>
) {
  const store = useRouteStore.getState()
  Object.assign(store, state)
}

/**
 * Reset the route store to initial state
 */
export function resetRouteStore() {
  useRouteStore.setState({
    route: null,
    error: null,
    hoveredElevationPoint: null,
  })
}

/**
 * Reset the map data store to initial state
 */
export function resetMapDataStore() {
  useMapDataStore.setState({
    isCurrentViewLoaded: false,
  })
}

/**
 * Create a mock route with default values or specific number of waypoints
 */
export function createMockRoute(
  numWaypointsOrOverrides?: number | Partial<Route>
): Route {
  // Handle number parameter case
  if (typeof numWaypointsOrOverrides === 'number') {
    const numWaypoints = numWaypointsOrOverrides
    if (numWaypoints <= 0) {
      return new Route([], [])
    }

    const waypoints: Route['waypoints'] = []
    for (let i = 0; i < numWaypoints; i++) {
      waypoints.push({
        type: 'custom' as const,
        lat: 50.0 + i * 0.001,
        lon: 10.0 + i * 0.001,
      })
    }

    const segments = createMockSegmentsForWaypoints(waypoints)
    return new Route(segments, waypoints)
  }

  // Handle overrides object case
  const overrides = numWaypointsOrOverrides

  const defaultSegments = [
    {
      coordinates: [],
      distance: 0,
    },
    {
      coordinates: [
        { lat: 50.0, lon: 10.0 },
        { lat: 50.001, lon: 10.001 },
        { lat: 50.002, lon: 10.002 },
      ],
      distance: 314,
    },
  ]

  const defaultWaypoints = [
    { type: 'custom' as const, lat: 50.0, lon: 10.0 },
    { type: 'custom' as const, lat: 50.002, lon: 10.002 },
  ]

  let finalSegments: Route['segments'] = defaultSegments
  let finalWaypoints: Route['waypoints'] = defaultWaypoints

  if (overrides) {
    // Use provided segments and waypoints if both are available
    if (overrides.segments && overrides.waypoints) {
      finalSegments = overrides.segments
      finalWaypoints = overrides.waypoints
    }
    // If only waypoints are provided, create matching segments
    else if (overrides.waypoints && !overrides.segments) {
      finalWaypoints = overrides.waypoints
      finalSegments = createMockSegmentsForWaypoints(overrides.waypoints)
    }
    // If only segments are provided, create matching waypoints
    else if (overrides.segments && !overrides.waypoints) {
      finalSegments = overrides.segments
      finalWaypoints = createMockWaypointsForSegments(overrides.segments)
    }
    // If neither segments nor waypoints are provided, use defaults
  }

  return new Route(
    finalSegments,
    finalWaypoints,
    overrides?.elevationProfile,
    overrides?.elevationStats
  )
}

/**
 * Create mock segments that match the number of waypoints
 */
function createMockSegmentsForWaypoints(
  waypoints: Route['waypoints']
): Route['segments'] {
  if (waypoints.length === 0) return []

  const segments = []
  for (let i = 0; i < waypoints.length; i++) {
    if (i === 0) {
      // First segment: must be empty according to Route validation
      segments.push({
        coordinates: [],
        distance: 0,
      })
    } else {
      // Subsequent segments: path from previous waypoint to current
      const prevWaypoint = waypoints[i - 1]
      const currentWaypoint = waypoints[i]
      segments.push({
        coordinates: [
          { lat: prevWaypoint.lat, lon: prevWaypoint.lon },
          { lat: currentWaypoint.lat, lon: currentWaypoint.lon },
        ],
        distance: 314, // Mock distance
      })
    }
  }
  return segments
}

/**
 * Create mock waypoints that match the number of segments
 */
function createMockWaypointsForSegments(
  segments: Route['segments']
): Route['waypoints'] {
  if (segments.length === 0) return []

  const waypoints = []
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    // Use the last coordinate of each segment as the waypoint
    const lastCoord = segment.coordinates[segment.coordinates.length - 1]
    waypoints.push({
      type: 'custom' as const,
      lat: lastCoord.lat,
      lon: lastCoord.lon,
    })
  }
  return waypoints
}

/**
 * Create mock elevation profile data
 */
export function createMockElevationProfile(
  count: number = 10
): ElevationPoint[] {
  const profile: ElevationPoint[] = []
  const maxDistance = 5000 // 5km

  for (let i = 0; i < count; i++) {
    const progress = count > 1 ? i / (count - 1) : 0
    profile.push({
      distance: maxDistance * progress,
      elevation: 100 + Math.sin(progress * Math.PI) * 200, // Creates a hill
      lat: 50.0 + progress * 0.01,
      lon: 10.0 + progress * 0.01,
    })
  }

  return profile
}

/**
 * Create mock elevation stats
 */
export function createMockElevationStats(
  overrides?: Partial<ElevationStats>
): ElevationStats {
  return {
    gain: 250,
    loss: 150,
    min: 100,
    max: 300,
    ...overrides,
  }
}
