import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Controls } from './Controls'
import {
  resetRouteStore,
  resetMapDataStore,
  createMockRoute,
  mockRouteStore,
} from '../test/componentUtils'
import * as gpxExport from '../services/gpxExport'
import { useMapDataStore } from '../store/mapDataStore'

// Mock the GPX export service
vi.mock('../services/gpxExport', () => ({
  exportRouteAsGPX: vi.fn(),
}))

describe('Controls', () => {
  const defaultProps = {
    onLoadData: vi.fn(),
    onClearRoute: vi.fn(),
    isDataLoaded: false,
    zoom: 13,
    mapBounds: {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    },
    isLoading: false,
  }

  beforeEach(async () => {
    await act(async () => {
      resetRouteStore()
      resetMapDataStore()
      vi.clearAllMocks()
    })
  })

  afterEach(async () => {
    await act(async () => {
      resetRouteStore()
      resetMapDataStore()
    })
  })

  describe('Rendering', () => {
    it('should render the component with title', () => {
      render(<Controls {...defaultProps} />)
      expect(screen.getByText('Route Planner')).toBeInTheDocument()
    })

    it('should render all three buttons', () => {
      render(<Controls {...defaultProps} />)
      expect(screen.getByText('Load Hiking Paths')).toBeInTheDocument()
      expect(screen.getByText('Export GPX')).toBeInTheDocument()
      expect(screen.getByText('Clear Route')).toBeInTheDocument()
    })

    it('should render instructions text', () => {
      render(<Controls {...defaultProps} />)
      expect(
        screen.getByText(/Zoom in enough, then click on the map/i)
      ).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading message when isLoading is true', () => {
      render(<Controls {...defaultProps} isLoading={true} />)
      expect(screen.getByText('Loading hiking paths...')).toBeInTheDocument()
    })

    it('should not show loading message when isLoading is false', () => {
      render(<Controls {...defaultProps} isLoading={false} />)
      expect(
        screen.queryByText('Loading hiking paths...')
      ).not.toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should show error message when error exists', () => {
      mockRouteStore({ error: 'Failed to load data' })
      render(<Controls {...defaultProps} />)
      expect(screen.getByText('Failed to load data')).toBeInTheDocument()
    })

    it('should not show error message when no error', () => {
      mockRouteStore({ error: null })
      render(<Controls {...defaultProps} />)
      expect(screen.queryByText('Failed to load data')).not.toBeInTheDocument()
    })
  })

  describe('Route Information', () => {
    it('should display route distance and waypoints when route exists', () => {
      const mockRoute = createMockRoute()
      mockRouteStore({ route: mockRoute })
      render(<Controls {...defaultProps} />)

      expect(screen.getByText(/Distance:/)).toBeInTheDocument()
      expect(screen.getByText(/0.31 km/)).toBeInTheDocument()
      expect(screen.getByText(/Waypoints:/)).toBeInTheDocument()
      expect(screen.getByText(/2/)).toBeInTheDocument()
    })

    it('should not display route info when no route', () => {
      mockRouteStore({ route: null })
      render(<Controls {...defaultProps} />)

      expect(screen.queryByText(/Distance:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Waypoints:/)).not.toBeInTheDocument()
    })
  })

  describe('Zoom Level Warnings', () => {
    it('should show zoom warning when zoom is below MIN_ZOOM', () => {
      render(<Controls {...defaultProps} zoom={12} />)
      expect(
        screen.getByText(/Please zoom in more to load hiking paths/)
      ).toBeInTheDocument()
    })

    it('should not show zoom warning when zoom is at or above MIN_ZOOM', () => {
      render(<Controls {...defaultProps} zoom={13} />)
      expect(
        screen.queryByText(/Please zoom in more to load hiking paths/)
      ).not.toBeInTheDocument()
    })
  })

  describe('Data Loaded Indicator', () => {
    it('should show checkmark when data is loaded', () => {
      render(<Controls {...defaultProps} isDataLoaded={true} />)
      expect(screen.getByText('✓ Hiking paths loaded')).toBeInTheDocument()
    })

    it('should not show checkmark when data is not loaded', () => {
      render(<Controls {...defaultProps} isDataLoaded={false} />)
      expect(
        screen.queryByText('✓ Hiking paths loaded')
      ).not.toBeInTheDocument()
    })
  })

  describe('Load Data Button', () => {
    it('should be enabled when zoom is sufficient and current view not loaded', () => {
      render(<Controls {...defaultProps} zoom={13} isDataLoaded={false} />)
      const button = screen.getByText('Load Hiking Paths')
      expect(button).not.toBeDisabled()
    })

    it('should be disabled when zoom is too low', () => {
      render(<Controls {...defaultProps} zoom={12} isDataLoaded={false} />)
      const button = screen.getByText('Load Hiking Paths')
      expect(button).toBeDisabled()
    })

    it('should be disabled when loading', () => {
      render(
        <Controls
          {...defaultProps}
          zoom={13}
          isDataLoaded={false}
          isLoading={true}
        />
      )
      const button = screen.getByText('Load Hiking Paths')
      expect(button).toBeDisabled()
    })

    it('should be disabled when current view is already loaded', () => {
      // Set the map data store to indicate current view is loaded
      useMapDataStore.setState({ isCurrentViewLoaded: true })

      render(<Controls {...defaultProps} zoom={13} isDataLoaded={true} />)
      const button = screen.getByText('Load Hiking Paths')
      expect(button).toBeDisabled()
    })

    it('should call onLoadData when clicked', async () => {
      const user = userEvent.setup()
      render(<Controls {...defaultProps} zoom={13} isDataLoaded={false} />)
      const button = screen.getByText('Load Hiking Paths')
      await user.click(button)
      expect(defaultProps.onLoadData).toHaveBeenCalledTimes(1)
    })

    it('should show confirmation dialog when reloading would clear route', async () => {
      const user = userEvent.setup()
      const mockRoute = createMockRoute({
        waypoints: [
          { type: 'custom', lat: 50.0, lon: 10.0 },
          { type: 'custom', lat: 51.0, lon: 11.0 }, // Outside the current bounds
        ],
      })
      mockRouteStore({ route: mockRoute })

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<Controls {...defaultProps} zoom={13} isDataLoaded={true} />)
      const button = screen.getByText('Load Hiking Paths')
      await user.click(button)

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Reloading hiking paths will clear your current route'
        )
      )
      expect(defaultProps.onLoadData).toHaveBeenCalledTimes(1)

      confirmSpy.mockRestore()
    })

    it('should not call onLoadData when user cancels confirmation', async () => {
      const user = userEvent.setup()
      const mockRoute = createMockRoute({
        waypoints: [
          { type: 'custom', lat: 50.0, lon: 10.0 },
          { type: 'custom', lat: 51.0, lon: 11.0 }, // Outside the current bounds
        ],
      })
      mockRouteStore({ route: mockRoute })

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<Controls {...defaultProps} zoom={13} isDataLoaded={true} />)
      const button = screen.getByText('Load Hiking Paths')
      await user.click(button)

      expect(confirmSpy).toHaveBeenCalled()
      expect(defaultProps.onLoadData).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })
  })

  describe('Export GPX Button', () => {
    it('should be enabled when route has at least 2 waypoints', () => {
      const mockRoute = createMockRoute({
        waypoints: [
          { type: 'custom', lat: 50.0, lon: 10.0 },
          { type: 'custom', lat: 50.001, lon: 10.001 },
        ],
      })
      mockRouteStore({ route: mockRoute })
      render(<Controls {...defaultProps} />)
      const button = screen.getByText('Export GPX')
      expect(button).not.toBeDisabled()
    })

    it('should be disabled when no route exists', () => {
      mockRouteStore({ route: null })
      render(<Controls {...defaultProps} />)
      const button = screen.getByText('Export GPX')
      expect(button).toBeDisabled()
    })

    it('should be disabled when route has less than 2 waypoints', () => {
      const mockRoute = createMockRoute({
        waypoints: [{ type: 'custom', lat: 50.0, lon: 10.0 }],
      })
      mockRouteStore({ route: mockRoute })
      render(<Controls {...defaultProps} />)
      const button = screen.getByText('Export GPX')
      expect(button).toBeDisabled()
    })

    it('should call exportRouteAsGPX when clicked', async () => {
      const user = userEvent.setup()
      const mockRoute = createMockRoute()
      mockRouteStore({ route: mockRoute })

      render(<Controls {...defaultProps} />)
      const button = screen.getByText('Export GPX')
      await user.click(button)

      expect(gpxExport.exportRouteAsGPX).toHaveBeenCalledWith(mockRoute)
    })

    it('should handle export errors gracefully', async () => {
      const user = userEvent.setup()
      const mockRoute = createMockRoute()
      mockRouteStore({ route: mockRoute })

      vi.mocked(gpxExport.exportRouteAsGPX).mockRejectedValue(
        new Error('Export failed')
      )

      render(<Controls {...defaultProps} />)
      const button = screen.getByText('Export GPX')
      await user.click(button)

      // Error is handled silently, user is notified through failed download
      expect(gpxExport.exportRouteAsGPX).toHaveBeenCalled()
    })
  })

  describe('Clear Route Button', () => {
    it('should be enabled when route exists', () => {
      const mockRoute = createMockRoute()
      mockRouteStore({ route: mockRoute })
      render(<Controls {...defaultProps} />)
      const button = screen.getByText('Clear Route')
      expect(button).not.toBeDisabled()
    })

    it('should be disabled when no route exists', () => {
      mockRouteStore({ route: null })
      render(<Controls {...defaultProps} />)
      const button = screen.getByText('Clear Route')
      expect(button).toBeDisabled()
    })

    it('should call onClearRoute when clicked', async () => {
      const user = userEvent.setup()
      const mockRoute = createMockRoute()
      mockRouteStore({ route: mockRoute })

      render(<Controls {...defaultProps} />)
      const button = screen.getByText('Clear Route')
      await user.click(button)

      expect(defaultProps.onClearRoute).toHaveBeenCalledTimes(1)
    })
  })
})
