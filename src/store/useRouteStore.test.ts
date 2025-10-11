import { describe, it, expect, beforeEach } from 'vitest'
import { useRouteStore } from './useRouteStore'
import { RouteSegment, ElevationPoint, ElevationStats } from '../types'

describe('useRouteStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useRouteStore.setState({
      route: null,
      isLoading: false,
      isLoadingElevation: false,
      error: null,
      hoveredElevationPoint: null,
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useRouteStore.getState()

      expect(state.route).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.isLoadingElevation).toBe(false)
      expect(state.error).toBeNull()
      expect(state.hoveredElevationPoint).toBeNull()
    })
  })

  describe('addSegment', () => {
    it('should add first segment and waypoint to empty route', () => {
      const segment: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      const waypoint: [number, number] = [10.0, 50.0]

      useRouteStore.getState().addSegment(segment, waypoint)

      const state = useRouteStore.getState()
      expect(state.route).not.toBeNull()
      expect(state.route?.segments).toHaveLength(1)
      expect(state.route?.waypoints).toHaveLength(1)
      expect(state.route?.waypoints[0]).toEqual(waypoint)
      expect(state.route?.totalDistance).toBe(1000)
    })

    it('should add segment to existing route', () => {
      const segment1: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      const segment2: RouteSegment = {
        coordinates: [
          [10.1, 50.1],
          [10.2, 50.2],
        ],
        distance: 1500,
      }

      useRouteStore.getState().addSegment(segment1, [10.0, 50.0])
      useRouteStore.getState().addSegment(segment2, [10.1, 50.1])

      const state = useRouteStore.getState()
      expect(state.route?.segments).toHaveLength(2)
      expect(state.route?.waypoints).toHaveLength(2)
      expect(state.route?.totalDistance).toBe(2500)
    })

    it('should calculate total distance correctly', () => {
      const segments = [
        {
          coordinates: [
            [10.0, 50.0],
            [10.1, 50.1],
          ],
          distance: 500,
        },
        {
          coordinates: [
            [10.1, 50.1],
            [10.2, 50.2],
          ],
          distance: 700,
        },
        {
          coordinates: [
            [10.2, 50.2],
            [10.3, 50.3],
          ],
          distance: 300,
        },
      ] as RouteSegment[]

      segments.forEach((seg) => {
        useRouteStore.getState().addSegment(seg, seg.coordinates[0])
      })

      const state = useRouteStore.getState()
      expect(state.route?.totalDistance).toBe(1500)
    })

    it('should clear elevation data when adding segment', () => {
      // Add initial segment with elevation data
      const segment1: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      useRouteStore.getState().addSegment(segment1, [10.0, 50.0])

      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }
      useRouteStore.getState().setElevationData(profile, stats)

      // Add another segment
      const segment2: RouteSegment = {
        coordinates: [
          [10.1, 50.1],
          [10.2, 50.2],
        ],
        distance: 1000,
      }
      useRouteStore.getState().addSegment(segment2, [10.1, 50.1])

      const state = useRouteStore.getState()
      expect(state.route?.elevationProfile).toBeUndefined()
      expect(state.route?.elevationStats).toBeUndefined()
    })
  })

  describe('insertWaypoint', () => {
    beforeEach(() => {
      // Set up a route with 2 waypoints
      const segment: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      useRouteStore.getState().addSegment(segment, [10.0, 50.0])
      useRouteStore.getState().addSegment(segment, [10.1, 50.1])
    })

    it('should insert waypoint at correct index', () => {
      const newWaypoint: [number, number] = [10.05, 50.05]
      const newSegments: RouteSegment[] = [
        {
          coordinates: [
            [10.0, 50.0],
            [10.05, 50.05],
          ],
          distance: 500,
        },
        {
          coordinates: [
            [10.05, 50.05],
            [10.1, 50.1],
          ],
          distance: 500,
        },
      ]

      useRouteStore.getState().insertWaypoint(1, newWaypoint, newSegments, 1000)

      const state = useRouteStore.getState()
      expect(state.route?.waypoints).toHaveLength(3)
      expect(state.route?.waypoints[1]).toEqual(newWaypoint)
      expect(state.route?.segments).toEqual(newSegments)
    })

    it('should update total distance when inserting waypoint', () => {
      const newWaypoint: [number, number] = [10.05, 50.05]
      const newSegments: RouteSegment[] = [
        {
          coordinates: [
            [10.0, 50.0],
            [10.05, 50.05],
          ],
          distance: 600,
        },
        {
          coordinates: [
            [10.05, 50.05],
            [10.1, 50.1],
          ],
          distance: 700,
        },
      ]

      useRouteStore.getState().insertWaypoint(1, newWaypoint, newSegments, 1300)

      const state = useRouteStore.getState()
      expect(state.route?.totalDistance).toBe(1300)
    })

    it('should clear elevation data when inserting waypoint', () => {
      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }
      useRouteStore.getState().setElevationData(profile, stats)

      const newWaypoint: [number, number] = [10.05, 50.05]
      const newSegments: RouteSegment[] = [
        {
          coordinates: [
            [10.0, 50.0],
            [10.05, 50.05],
          ],
          distance: 500,
        },
        {
          coordinates: [
            [10.05, 50.05],
            [10.1, 50.1],
          ],
          distance: 500,
        },
      ]

      useRouteStore.getState().insertWaypoint(1, newWaypoint, newSegments, 1000)

      const state = useRouteStore.getState()
      expect(state.route?.elevationProfile).toBeUndefined()
      expect(state.route?.elevationStats).toBeUndefined()
    })

    it('should return unchanged state if no route exists', () => {
      useRouteStore.setState({ route: null })

      const newWaypoint: [number, number] = [10.05, 50.05]
      const newSegments: RouteSegment[] = []

      useRouteStore.getState().insertWaypoint(1, newWaypoint, newSegments, 0)

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
    })
  })

  describe('updateWaypoint', () => {
    beforeEach(() => {
      // Set up a route with 2 waypoints
      const segment: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      useRouteStore.getState().addSegment(segment, [10.0, 50.0])
      useRouteStore.getState().addSegment(segment, [10.1, 50.1])
    })

    it('should update waypoint at specific index', () => {
      const updatedWaypoint: [number, number] = [10.05, 50.05]
      const newSegments: RouteSegment[] = [
        {
          coordinates: [
            [10.05, 50.05],
            [10.1, 50.1],
          ],
          distance: 700,
        },
      ]

      useRouteStore
        .getState()
        .updateWaypoint(0, updatedWaypoint, newSegments, 700)

      const state = useRouteStore.getState()
      expect(state.route?.waypoints[0]).toEqual(updatedWaypoint)
      expect(state.route?.segments).toEqual(newSegments)
      expect(state.route?.totalDistance).toBe(700)
    })

    it('should clear elevation data when updating waypoint', () => {
      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }
      useRouteStore.getState().setElevationData(profile, stats)

      const updatedWaypoint: [number, number] = [10.05, 50.05]
      const newSegments: RouteSegment[] = [
        {
          coordinates: [
            [10.05, 50.05],
            [10.1, 50.1],
          ],
          distance: 700,
        },
      ]

      useRouteStore
        .getState()
        .updateWaypoint(0, updatedWaypoint, newSegments, 700)

      const state = useRouteStore.getState()
      expect(state.route?.elevationProfile).toBeUndefined()
      expect(state.route?.elevationStats).toBeUndefined()
    })

    it('should return unchanged state if no route exists', () => {
      useRouteStore.setState({ route: null })

      const updatedWaypoint: [number, number] = [10.05, 50.05]
      const newSegments: RouteSegment[] = []

      useRouteStore
        .getState()
        .updateWaypoint(0, updatedWaypoint, newSegments, 0)

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
    })
  })

  describe('deleteWaypoint', () => {
    beforeEach(() => {
      // Set up a route with 3 waypoints
      const segments = [
        {
          coordinates: [
            [10.0, 50.0],
            [10.1, 50.1],
          ],
          distance: 1000,
        },
        {
          coordinates: [
            [10.1, 50.1],
            [10.2, 50.2],
          ],
          distance: 1000,
        },
      ] as RouteSegment[]

      segments.forEach((seg) => {
        useRouteStore.getState().addSegment(seg, seg.coordinates[0])
      })
      // Add final waypoint
      useRouteStore.getState().addSegment(segments[0], [10.2, 50.2])
    })

    it('should remove waypoint at specific index', () => {
      const newSegments: RouteSegment[] = [
        {
          coordinates: [
            [10.0, 50.0],
            [10.2, 50.2],
          ],
          distance: 1500,
        },
      ]

      useRouteStore.getState().deleteWaypoint(1, newSegments, 1500)

      const state = useRouteStore.getState()
      expect(state.route?.waypoints).toHaveLength(2)
      expect(state.route?.segments).toEqual(newSegments)
      expect(state.route?.totalDistance).toBe(1500)
    })

    it('should clear route when deleting last waypoint', () => {
      useRouteStore.setState({
        route: {
          segments: [],
          waypoints: [[10.0, 50.0]],
          totalDistance: 0,
        },
      })

      useRouteStore.getState().deleteWaypoint(0, [], 0)

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
      expect(state.error).toBeNull()
    })

    it('should clear elevation data when deleting waypoint', () => {
      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }
      useRouteStore.getState().setElevationData(profile, stats)

      const newSegments: RouteSegment[] = [
        {
          coordinates: [
            [10.0, 50.0],
            [10.2, 50.2],
          ],
          distance: 1500,
        },
      ]

      useRouteStore.getState().deleteWaypoint(1, newSegments, 1500)

      const state = useRouteStore.getState()
      expect(state.route?.elevationProfile).toBeUndefined()
      expect(state.route?.elevationStats).toBeUndefined()
    })

    it('should return unchanged state if no route exists', () => {
      useRouteStore.setState({ route: null })

      useRouteStore.getState().deleteWaypoint(0, [], 0)

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
    })
  })

  describe('clearRoute', () => {
    it('should reset route to null', () => {
      const segment: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      useRouteStore.getState().addSegment(segment, [10.0, 50.0])

      useRouteStore.getState().clearRoute()

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
    })

    it('should clear error when clearing route', () => {
      useRouteStore.setState({ error: 'Some error' })

      useRouteStore.getState().clearRoute()

      const state = useRouteStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set loading state to true', () => {
      useRouteStore.getState().setLoading(true)

      const state = useRouteStore.getState()
      expect(state.isLoading).toBe(true)
    })

    it('should set loading state to false', () => {
      useRouteStore.setState({ isLoading: true })
      useRouteStore.getState().setLoading(false)

      const state = useRouteStore.getState()
      expect(state.isLoading).toBe(false)
    })
  })

  describe('setLoadingElevation', () => {
    it('should set loading elevation state to true', () => {
      useRouteStore.getState().setLoadingElevation(true)

      const state = useRouteStore.getState()
      expect(state.isLoadingElevation).toBe(true)
    })

    it('should set loading elevation state to false', () => {
      useRouteStore.setState({ isLoadingElevation: true })
      useRouteStore.getState().setLoadingElevation(false)

      const state = useRouteStore.getState()
      expect(state.isLoadingElevation).toBe(false)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      useRouteStore.getState().setError('Test error')

      const state = useRouteStore.getState()
      expect(state.error).toBe('Test error')
    })

    it('should clear error message', () => {
      useRouteStore.setState({ error: 'Some error' })
      useRouteStore.getState().setError(null)

      const state = useRouteStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setElevationData', () => {
    beforeEach(() => {
      // Set up a route first
      const segment: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      useRouteStore.getState().addSegment(segment, [10.0, 50.0])
    })

    it('should store elevation profile and stats', () => {
      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
        { distance: 500, elevation: 150, lat: 50.05, lon: 10.05 },
        { distance: 1000, elevation: 200, lat: 50.1, lon: 10.1 },
      ]
      const stats: ElevationStats = {
        gain: 100,
        loss: 0,
        min: 100,
        max: 200,
      }

      useRouteStore.getState().setElevationData(profile, stats)

      const state = useRouteStore.getState()
      expect(state.route?.elevationProfile).toEqual(profile)
      expect(state.route?.elevationStats).toEqual(stats)
    })

    it('should return unchanged state if no route exists', () => {
      useRouteStore.setState({ route: null })

      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }

      useRouteStore.getState().setElevationData(profile, stats)

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
    })

    it('should preserve other route properties when setting elevation data', () => {
      const originalRoute = useRouteStore.getState().route

      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }

      useRouteStore.getState().setElevationData(profile, stats)

      const state = useRouteStore.getState()
      expect(state.route?.segments).toEqual(originalRoute?.segments)
      expect(state.route?.waypoints).toEqual(originalRoute?.waypoints)
      expect(state.route?.totalDistance).toEqual(originalRoute?.totalDistance)
    })
  })

  describe('setHoveredElevationPoint', () => {
    it('should set hovered elevation point', () => {
      const point: ElevationPoint = {
        distance: 500,
        elevation: 150,
        lat: 50.05,
        lon: 10.05,
      }

      useRouteStore.getState().setHoveredElevationPoint(point)

      const state = useRouteStore.getState()
      expect(state.hoveredElevationPoint).toEqual(point)
    })

    it('should clear hovered elevation point', () => {
      const point: ElevationPoint = {
        distance: 500,
        elevation: 150,
        lat: 50.05,
        lon: 10.05,
      }
      useRouteStore.setState({ hoveredElevationPoint: point })

      useRouteStore.getState().setHoveredElevationPoint(null)

      const state = useRouteStore.getState()
      expect(state.hoveredElevationPoint).toBeNull()
    })
  })

  describe('complex scenarios', () => {
    it('should maintain waypoint order through multiple operations', () => {
      const waypoints: [number, number][] = [
        [10.0, 50.0],
        [10.1, 50.1],
        [10.2, 50.2],
        [10.3, 50.3],
      ]

      waypoints.forEach((wp) => {
        const segment: RouteSegment = {
          coordinates: [wp, [wp[0] + 0.01, wp[1] + 0.01]],
          distance: 100,
        }
        useRouteStore.getState().addSegment(segment, wp)
      })

      const state = useRouteStore.getState()
      expect(state.route?.waypoints).toEqual(waypoints)
    })

    it('should handle complete route lifecycle', () => {
      // Add segments
      const segment1: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      useRouteStore.getState().addSegment(segment1, [10.0, 50.0])
      useRouteStore.getState().addSegment(segment1, [10.1, 50.1])

      // Set elevation data
      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }
      useRouteStore.getState().setElevationData(profile, stats)

      // Set loading
      useRouteStore.getState().setLoading(true)

      // Clear route
      useRouteStore.getState().clearRoute()

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
      expect(state.error).toBeNull()
      expect(state.isLoading).toBe(true) // Loading state should persist
    })

    it('should handle error state with route data', () => {
      const segment: RouteSegment = {
        coordinates: [
          [10.0, 50.0],
          [10.1, 50.1],
        ],
        distance: 1000,
      }
      useRouteStore.getState().addSegment(segment, [10.0, 50.0])
      useRouteStore.getState().setError('Failed to fetch elevation')

      const state = useRouteStore.getState()
      expect(state.route).not.toBeNull()
      expect(state.error).toBe('Failed to fetch elevation')
    })
  })
})
