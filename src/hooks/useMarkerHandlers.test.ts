/**
 * Marker Handlers Hook Tests
 */

import { renderHook, act } from '@testing-library/react'
import { RefObject } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeafletEvent } from 'leaflet'
import { useMarkerHandlers } from './useMarkerHandlers'
import { Router } from '../services/router'
import { RouteWaypoint } from '../types'
import { Route } from '../services/route'
import { CustomWaypoint } from '../types'

// Mock the mapHelpers
vi.mock('../utils/mapHelpers', () => ({
  createNodeWaypoint: vi.fn(),
  createCustomWaypoint: vi.fn(),
}))

// Mock debounce
vi.mock('../utils/debounce', () => ({
  debounce: vi.fn((fn) => fn), // Return the function directly for testing
}))

// Mock useRouteStore
vi.mock('../store/useRouteStore', () => ({
  useRouteStore: vi.fn(() => ({
    setRoute: vi.fn(),
    clearRoute: vi.fn(),
  })),
}))

// Mock useRouterStore
vi.mock('../store/routerStore', () => ({
  useRouterStore: vi.fn(() => ({
    router: null,
  })),
}))

// Import mocked functions
import { createNodeWaypoint, createCustomWaypoint } from '../utils/mapHelpers'
import { useRouteStore } from '../store/useRouteStore'
import { useRouterStore } from '../store/routerStore'

const mockUseRouteStore = useRouteStore as unknown as ReturnType<typeof vi.fn>
const mockUseRouterStore = useRouterStore as unknown as ReturnType<typeof vi.fn>

const mockCreateNodeWaypoint = createNodeWaypoint as ReturnType<typeof vi.fn>
const mockCreateCustomWaypoint = createCustomWaypoint as ReturnType<
  typeof vi.fn
>

describe('useMarkerHandlers', () => {
  const mockRouter = {
    getNode: vi.fn(),
    findNearestNodeWithDistance: vi.fn(),
    route: vi.fn(),
    createStraightSegment: vi.fn(),
  } as unknown as Router

  const mockSetRoute = vi.fn()
  const mockClearRoute = vi.fn()

  const mockSetTempRoute = vi.fn()
  const mockIsDraggingMarkerRef = {
    current: false,
  } as RefObject<boolean>

  beforeEach(() => {
    mockUseRouteStore.mockReturnValue({
      setRoute: mockSetRoute,
      clearRoute: mockClearRoute,
    })
    mockUseRouterStore.mockReturnValue({
      router: mockRouter,
    })

    // Setup default mock implementations
  })

  // Mock variables for Route methods
  let mockDeleteWaypoint: ReturnType<typeof vi.fn>
  let mockRecalculateAffectedSegments: ReturnType<typeof vi.fn>
  let mockRecalculateSegment: ReturnType<typeof vi.fn>

  // Create mock route with required data
  const mockRoute = new Route(
    [
      { coordinates: [{ lat: 50, lon: 8 }], distance: 0 },
      { coordinates: [{ lat: 51, lon: 9 }], distance: 0 },
    ], // segments
    [
      { type: 'custom', lat: 50, lon: 8 },
      { type: 'node', nodeId: 123, lat: 51, lon: 9 },
    ] as RouteWaypoint[] // waypoints
  )

  const mockMarker = {
    getLatLng: vi.fn(),
    setLatLng: vi.fn(),
  } as {
    getLatLng: ReturnType<typeof vi.fn>
    setLatLng: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDraggingMarkerRef.current = false

    // Default mock implementations
    mockMarker.getLatLng.mockReturnValue({ lat: 50.5, lng: 8.5 })
    mockCreateCustomWaypoint.mockImplementation((lat: number, lon: number) => ({
      type: 'custom',
      lat,
      lon,
    }))
    mockCreateNodeWaypoint.mockImplementation(
      (lat: number, lon: number, nodeId: number) => ({
        type: 'node',
        nodeId,
        lat,
        lon,
      })
    )

    // Setup default mock implementations for Route methods using prototype spies
    mockDeleteWaypoint = vi
      .fn()
      .mockImplementation((index: number, _router: Router) => {
        const newWaypoints = [...mockRoute.waypoints]
        newWaypoints.splice(index, 1)
        const newSegments = [...mockRoute.segments]
        newSegments.splice(index, 1)
        return new Route(
          newSegments,
          newWaypoints,
          mockRoute.elevationProfile,
          mockRoute.elevationStats
        )
      })

    mockRecalculateAffectedSegments = vi.fn().mockImplementation(function (
      this: Route,
      _index: number,
      _router: Router
    ) {
      // Return a route with the same waypoints as this instance (simulating successful recalculation)
      return new Route(
        this.segments,
        this.waypoints,
        this.elevationProfile,
        this.elevationStats
      )
    })

    mockRecalculateSegment = vi.fn().mockImplementation(function (
      this: Route,
      _index: number,
      _router: Router
    ) {
      // Return a route with the same waypoints as this instance (simulating successful recalculation)
      return new Route(
        this.segments,
        this.waypoints,
        this.elevationProfile,
        this.elevationStats
      )
    })

    // Spy on Route prototype methods to apply mocks to all instances
    vi.spyOn(Route.prototype, 'deleteWaypoint').mockImplementation(
      mockDeleteWaypoint
    )
    vi.spyOn(Route.prototype, 'recalculateAffectedSegments').mockImplementation(
      mockRecalculateAffectedSegments
    )
    vi.spyOn(Route.prototype, 'recalculateSegment').mockImplementation(
      mockRecalculateSegment
    )
  })

  describe('handleMarkerDrag', () => {
    it('should recalculate route during dragging with custom waypoint', () => {
      mockRoute.waypoints[0] = {
        type: 'custom',
        lat: 50,
        lon: 8,
      } as CustomWaypoint
      mockRouter.findNearestNode = vi.fn().mockReturnValue(null)

      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDrag(0, mockEvent)
      })

      expect(mockCreateCustomWaypoint).toHaveBeenCalledWith(50.5, 8.5)
      expect(mockRecalculateAffectedSegments).toHaveBeenCalled()
      expect(mockSetTempRoute).toHaveBeenCalled()
    })

    it('should snap custom waypoint to nearby node', () => {
      mockRoute.waypoints[0] = {
        type: 'custom',
        lat: 50,
        lon: 8,
      } as CustomWaypoint
      mockRouter.findNearestNode = vi.fn().mockReturnValue({
        nodeId: 456,
        distance: 50,
        node: { lat: 51, lon: 9 },
      })

      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDrag(0, mockEvent)
      })

      expect(mockRouter.findNearestNode).toHaveBeenCalled()
      expect(mockCreateNodeWaypoint).toHaveBeenCalledWith(51, 9, 456)
      expect(mockMarker.setLatLng).not.toHaveBeenCalled()
      expect(mockSetTempRoute).toHaveBeenCalled()
    })

    it('should return early if router or route is not available', () => {
      mockUseRouterStore.mockReturnValue({
        router: null,
      })
      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: null,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDrag(0, mockEvent)
      })

      expect(mockCreateCustomWaypoint).not.toHaveBeenCalled()
      expect(mockSetRoute).not.toHaveBeenCalled()
    })

    it('should handle missing waypoint gracefully', () => {
      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      act(() => {
        result.current.handleMarkerDrag(999, mockEvent) // Invalid index
      })

      expect(mockSetTempRoute).not.toHaveBeenCalled()
      expect(mockSetRoute).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('handleMarkerDragEnd', () => {
    it('should perform immediate update on drag end', () => {
      // Set up a custom waypoint for testing
      const testRoute = new Route(
        [{ coordinates: [{ lat: 50, lon: 8 }], distance: 0 }], // segments
        [{ type: 'custom', lat: 50, lon: 8 } as CustomWaypoint] // waypoints
      )

      // Reset mocks to ensure clean state
      vi.clearAllMocks()
      mockRouter.findNearestNode = vi.fn().mockReturnValue(null)

      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: testRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDragEnd(0, mockEvent)
      })

      expect(mockCreateCustomWaypoint).toHaveBeenCalledWith(50.5, 8.5)
      expect(mockRecalculateAffectedSegments).toHaveBeenCalled()
      expect(mockSetRoute).toHaveBeenCalled()
      expect(mockMarker.setLatLng).toHaveBeenCalledWith([50.5, 8.5])
    })

    it('should snap custom waypoint to nearby node and update marker on drag end', () => {
      const testRoute = new Route(
        [{ coordinates: [{ lat: 50, lon: 8 }], distance: 0 }], // segments
        [{ type: 'custom', lat: 50, lon: 8 } as CustomWaypoint] // waypoints
      )

      vi.clearAllMocks()
      mockRouter.findNearestNode = vi.fn().mockReturnValue({
        nodeId: 456,
        distance: 50,
        node: { lat: 51, lon: 9 },
      })

      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: testRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDragEnd(0, mockEvent)
      })

      expect(mockRouter.findNearestNode).toHaveBeenCalled()
      expect(mockCreateNodeWaypoint).toHaveBeenCalledWith(51, 9, 456)
      expect(mockMarker.setLatLng).toHaveBeenCalledWith([51, 9]) // Marker should snap to node
      expect(mockSetRoute).toHaveBeenCalled()
    })
  })

  describe('handleMarkerDragStart', () => {
    it('should set dragging flag to true', () => {
      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      act(() => {
        result.current.handleMarkerDragStart()
      })

      expect(mockIsDraggingMarkerRef.current).toBe(true)
    })
  })

  describe('handleMarkerClick', () => {
    it('should stop event propagation', () => {
      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      const mockEvent = {
        originalEvent: {
          stopPropagation: vi.fn(),
        },
      } as LeafletEvent & {
        originalEvent: { stopPropagation: ReturnType<typeof vi.fn> }
      }

      act(() => {
        result.current.handleMarkerClick(mockEvent)
      })

      expect(mockEvent.originalEvent.stopPropagation).toHaveBeenCalled()
    })
  })

  describe('handleMarkerDoubleClick', () => {
    it('should delete waypoint and recalculate route', () => {
      const { result } = renderHook(() =>
        useMarkerHandlers({
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
          mapCenter: { lat: 45.0, lng: 9.0 },
          currentZoom: 10,
        })
      )

      const mockEvent = {
        originalEvent: {
          stopPropagation: vi.fn(),
        },
      } as LeafletEvent & {
        originalEvent: { stopPropagation: ReturnType<typeof vi.fn> }
      }

      act(() => {
        result.current.handleMarkerDoubleClick(0, mockEvent)
      })

      expect(mockDeleteWaypoint).toHaveBeenCalled()
      expect(mockSetRoute).toHaveBeenCalledWith(
        new Route(
          [
            {
              coordinates: [{ lat: 51, lon: 9 }],
              distance: 0,
            },
          ], // segments
          [
            {
              type: 'node',
              nodeId: 123,
              lat: 51,
              lon: 9,
            },
          ] // waypoints
        )
      )
    })
  })
})
