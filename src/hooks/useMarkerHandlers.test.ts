/**
 * Marker Handlers Hook Tests
 */

import { renderHook, act } from '@testing-library/react'
import { RefObject } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeafletEvent } from 'leaflet'
import { useMarkerHandlers } from './useMarkerHandlers'
import { Router } from '../services/router'
import { Route, RouteWaypoint } from '../types'
import { NodeWaypoint, CustomWaypoint } from '../types'

// Mock the mapHelpers
vi.mock('../utils/mapHelpers', () => ({
  createNodeWaypoint: vi.fn(),
  createCustomWaypoint: vi.fn(),
  recalculateMixedSegments: vi.fn(),
}))

// Mock debounce
vi.mock('../utils/debounce', () => ({
  debounce: vi.fn((fn) => fn), // Return the function directly for testing
}))

// Mock useRouteStore
vi.mock('../store/useRouteStore', () => ({
  useRouteStore: vi.fn(() => ({
    setRoute: vi.fn(),
    deleteWaypoint: vi.fn(),
    clearRoute: vi.fn(),
  })),
}))

// Import mocked functions
import {
  createNodeWaypoint,
  createCustomWaypoint,
  recalculateMixedSegments,
} from '../utils/mapHelpers'
import { useRouteStore } from '../store/useRouteStore'

const mockUseRouteStore = useRouteStore as unknown as ReturnType<typeof vi.fn>

const mockCreateNodeWaypoint = createNodeWaypoint as ReturnType<typeof vi.fn>
const mockCreateCustomWaypoint = createCustomWaypoint as ReturnType<
  typeof vi.fn
>
const mockRecalculateMixedSegments = recalculateMixedSegments as ReturnType<
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
  const mockDeleteWaypoint = vi.fn()
  const mockClearRoute = vi.fn()

  const mockSetTempRoute = vi.fn()
  const mockIsDraggingMarkerRef = {
    current: false,
  } as RefObject<boolean>

  beforeEach(() => {
    mockUseRouteStore.mockReturnValue({
      setRoute: mockSetRoute,
      deleteWaypoint: mockDeleteWaypoint,
      clearRoute: mockClearRoute,
    })
  })

  const mockRoute: Route = {
    waypoints: [
      { type: 'custom', id: 'custom-1', lat: 50, lon: 8 },
      { type: 'node', id: 'node-1', nodeId: 'node123', lat: 51, lon: 9 },
    ] as RouteWaypoint[],
    segments: [],
    totalDistance: 100,
  }

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
      id: `custom-${Date.now()}`,
      lat,
      lon,
    }))
    mockCreateNodeWaypoint.mockImplementation(
      (lat: number, lon: number, nodeId: string) => ({
        type: 'node',
        id: `node-${nodeId}`,
        nodeId,
        lat,
        lon,
      })
    )
    mockRecalculateMixedSegments.mockReturnValue({
      segments: [],
      totalDistance: 0,
    })
  })

  describe('handleMarkerDrag', () => {
    it('should recalculate route during dragging with custom waypoint', () => {
      mockRoute.waypoints[0] = {
        type: 'custom',
        id: 'custom-1',
        lat: 50,
        lon: 8,
      } as CustomWaypoint
      mockRouter.findNearestNode = vi.fn().mockReturnValue(null)

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDrag(0, mockEvent)
      })

      expect(mockCreateCustomWaypoint).toHaveBeenCalledWith(50.5, 8.5)
      expect(mockRecalculateMixedSegments).toHaveBeenCalled()
      expect(mockSetTempRoute).toHaveBeenCalled()
    })

    it('should snap custom waypoint to nearby node', () => {
      mockRoute.waypoints[0] = {
        type: 'custom',
        id: 'custom-1',
        lat: 50,
        lon: 8,
      } as CustomWaypoint
      mockRouter.findNearestNode = vi.fn().mockReturnValue({
        nodeId: 'node456',
        distance: 50,
        node: { lat: 51, lon: 9 },
      })

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDrag(0, mockEvent)
      })

      expect(mockRouter.findNearestNode).toHaveBeenCalled()
      expect(mockCreateNodeWaypoint).toHaveBeenCalledWith(51, 9, 'node456')
      expect(mockMarker.setLatLng).not.toHaveBeenCalled()
      expect(mockSetTempRoute).toHaveBeenCalled()
    })

    it('should convert node waypoint to custom when dragged far', () => {
      mockRoute.waypoints[0] = {
        type: 'node',
        id: 'node-1',
        nodeId: 'node123',
        lat: 50,
        lon: 8,
      } as NodeWaypoint
      mockRouter.findNearestNode = vi.fn().mockReturnValue(null)

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDrag(0, mockEvent)
      })

      expect(mockCreateCustomWaypoint).toHaveBeenCalledWith(50.5, 8.5)
      expect(mockMarker.setLatLng).not.toHaveBeenCalled()
      expect(mockSetTempRoute).toHaveBeenCalled()
    })

    it('should handle node waypoint snapping to different node', () => {
      mockRoute.waypoints[0] = {
        type: 'node',
        id: 'node-1',
        nodeId: 'node123',
        lat: 50,
        lon: 8,
      } as NodeWaypoint
      mockRouter.findNearestNode = vi.fn().mockReturnValue({
        nodeId: 'node789',
        distance: 30,
        node: { lat: 52, lon: 10 },
      })

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDrag(0, mockEvent)
      })

      expect(mockRouter.findNearestNode).toHaveBeenCalled()
      expect(mockCreateNodeWaypoint).toHaveBeenCalledWith(52, 10, 'node789')
      // During drag, marker position should NOT be updated (performance optimization)
      expect(mockMarker.setLatLng).not.toHaveBeenCalled()
      expect(mockSetTempRoute).toHaveBeenCalled()
    })

    it('should return early if router or route is not available', () => {
      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: null,
          route: null,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
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
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
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
      const testRoute: Route = {
        waypoints: [
          { type: 'custom', id: 'custom-1', lat: 50, lon: 8 } as CustomWaypoint,
        ] as RouteWaypoint[],
        segments: [],
        totalDistance: 0,
      }

      // Reset mocks to ensure clean state
      vi.clearAllMocks()
      mockRouter.findNearestNode = vi.fn().mockReturnValue(null)

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: testRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDragEnd(0, mockEvent)
      })

      expect(mockCreateCustomWaypoint).toHaveBeenCalledWith(50.5, 8.5)
      expect(mockRecalculateMixedSegments).toHaveBeenCalled()
      expect(mockSetRoute).toHaveBeenCalled()
      expect(mockMarker.setLatLng).toHaveBeenCalledWith([50.5, 8.5])
    })

    it('should snap custom waypoint to nearby node and update marker on drag end', () => {
      const testRoute: Route = {
        waypoints: [
          { type: 'custom', id: 'custom-1', lat: 50, lon: 8 } as CustomWaypoint,
        ] as RouteWaypoint[],
        segments: [],
        totalDistance: 0,
      }

      vi.clearAllMocks()
      mockRouter.findNearestNode = vi.fn().mockReturnValue({
        nodeId: 'node456',
        distance: 50,
        node: { lat: 51, lon: 9 },
      })

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: testRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDragEnd(0, mockEvent)
      })

      expect(mockRouter.findNearestNode).toHaveBeenCalled()
      expect(mockCreateNodeWaypoint).toHaveBeenCalledWith(51, 9, 'node456')
      expect(mockMarker.setLatLng).toHaveBeenCalledWith([51, 9]) // Marker should snap to node
      expect(mockSetRoute).toHaveBeenCalled()
    })

    it('should snap node waypoint to different node and update marker on drag end', () => {
      const testRoute: Route = {
        waypoints: [
          {
            type: 'node',
            id: 'node-1',
            nodeId: 'node123',
            lat: 50,
            lon: 8,
          } as NodeWaypoint,
        ] as RouteWaypoint[],
        segments: [],
        totalDistance: 0,
      }

      vi.clearAllMocks()
      mockRouter.findNearestNode = vi.fn().mockReturnValue({
        nodeId: 'node789',
        distance: 30,
        node: { lat: 52, lon: 10 },
      })

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: testRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDragEnd(0, mockEvent)
      })

      expect(mockRouter.findNearestNode).toHaveBeenCalled()
      expect(mockCreateNodeWaypoint).toHaveBeenCalledWith(52, 10, 'node789')
      expect(mockMarker.setLatLng).toHaveBeenCalledWith([52, 10]) // Marker should snap to new node
      expect(mockSetRoute).toHaveBeenCalled()
    })

    it('should convert node waypoint to custom and update marker on drag end', () => {
      const testRoute: Route = {
        waypoints: [
          {
            type: 'node',
            id: 'node-1',
            nodeId: 'node123',
            lat: 50,
            lon: 8,
          } as NodeWaypoint,
        ] as RouteWaypoint[],
        segments: [],
        totalDistance: 0,
      }

      vi.clearAllMocks()
      mockRouter.findNearestNode = vi.fn().mockReturnValue(null) // No nearby node

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: testRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      act(() => {
        result.current.handleMarkerDragEnd(0, mockEvent)
      })

      expect(mockCreateCustomWaypoint).toHaveBeenCalledWith(50.5, 8.5)
      expect(mockMarker.setLatLng).toHaveBeenCalledWith([50.5, 8.5]) // Marker should stay at drag position
      expect(mockSetRoute).toHaveBeenCalled()
    })

    it('should clear dragging flag after delay', () => {
      vi.useFakeTimers()

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
        })
      )

      const mockEvent = {
        target: mockMarker,
      } as LeafletEvent

      // Set dragging flag
      mockIsDraggingMarkerRef.current = true

      act(() => {
        result.current.handleMarkerDragEnd(0, mockEvent)
      })

      // Flag should still be true immediately
      expect(mockIsDraggingMarkerRef.current).toBe(true)

      // After delay, flag should be cleared
      act(() => {
        vi.advanceTimersByTime(150)
      })

      expect(mockIsDraggingMarkerRef.current).toBe(false)

      vi.useRealTimers()
    })
  })

  describe('handleMarkerDragStart', () => {
    it('should set dragging flag to true', () => {
      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
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
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
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
          router: mockRouter,
          route: mockRoute,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
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

      expect(mockRecalculateMixedSegments).toHaveBeenCalled()
      expect(mockDeleteWaypoint).toHaveBeenCalledWith(0, [], 0)
    })

    it('should clear route when all waypoints are deleted', () => {
      const routeWithOneWaypoint: Route = {
        waypoints: [
          { type: 'custom', id: 'custom-1', lat: 50, lon: 8 },
        ] as RouteWaypoint[],
        segments: [],
        totalDistance: 0,
      }

      const { result } = renderHook(() =>
        useMarkerHandlers({
          router: mockRouter,
          route: routeWithOneWaypoint,
          isDraggingMarkerRef: mockIsDraggingMarkerRef,
          setTempRoute: mockSetTempRoute,
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

      expect(mockClearRoute).toHaveBeenCalled()
    })
  })
})
