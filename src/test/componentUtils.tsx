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
 * Create a mock route with default values
 */
export function createMockRoute(overrides?: Partial<Route>): Route {
  const defaultRoute = new Route(
    [
      {
        coordinates: [{ lat: 50.0, lon: 10.0 }],
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
    ],
    [
      { type: 'custom', lat: 50.0, lon: 10.0 },
      { type: 'custom', lat: 50.002, lon: 10.002 },
    ],
    314,
    undefined,
    undefined
  )

  if (overrides) {
    return new Route(
      overrides.segments || defaultRoute.segments,
      overrides.waypoints || defaultRoute.waypoints,
      overrides.totalDistance || defaultRoute.totalDistance,
      overrides.elevationProfile || defaultRoute.elevationProfile,
      overrides.elevationStats || defaultRoute.elevationStats
    )
  }

  return defaultRoute
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
