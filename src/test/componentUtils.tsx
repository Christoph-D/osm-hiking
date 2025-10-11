import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { useRouteStore } from '../store/useRouteStore'
import { ElevationPoint, ElevationStats, Route } from '../types'

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
    isLoading: false,
    error: null,
    isLoadingElevation: false,
    hoveredElevationPoint: null,
  })
}

/**
 * Create a mock route with default values
 */
export function createMockRoute(overrides?: Partial<Route>): Route {
  return {
    segments: [
      {
        coordinates: [[10.0, 50.0]],
        distance: 0,
      },
      {
        coordinates: [
          [10.0, 50.0],
          [10.001, 50.001],
          [10.002, 50.002],
        ],
        distance: 314,
      },
    ],
    waypoints: [
      [10.0, 50.0],
      [10.002, 50.002],
    ],
    totalDistance: 314,
    elevationProfile: undefined,
    elevationStats: undefined,
    ...overrides,
  }
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

/**
 * Create a mock route with elevation data
 */
export function createMockRouteWithElevation(): Route {
  const profile = createMockElevationProfile(10)
  // Calculate matching stats from the profile
  const elevations = profile.map((p) => p.elevation)
  const min = Math.min(...elevations)
  const max = Math.max(...elevations)

  return createMockRoute({
    totalDistance: 5000,
    elevationProfile: profile,
    elevationStats: createMockElevationStats({
      min,
      max,
      gain: 200,
      loss: 100,
    }),
  })
}
