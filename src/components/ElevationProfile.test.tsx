import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ElevationProfile } from './ElevationProfile'
import {
  createMockElevationProfile,
  createMockElevationStats,
  resetRouteStore,
} from '../test/componentUtils'
import { useRouteStore } from '../store/useRouteStore'

describe('ElevationProfile', () => {
  const mockElevationProfile = createMockElevationProfile(10)
  // Calculate stats that match the profile data
  const elevations = mockElevationProfile.map((p) => p.elevation)
  const mockElevationStats = createMockElevationStats({
    min: Math.min(...elevations),
    max: Math.max(...elevations),
    gain: 250,
    loss: 150,
  })

  beforeEach(() => {
    resetRouteStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetRouteStore()
  })

  describe('Rendering', () => {
    it('should render the component with title when expanded', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      expect(screen.getByText('Elevation Profile')).toBeInTheDocument()
    })

    it('should render collapse button when expanded', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      expect(screen.getByText('×')).toBeInTheDocument()
    })

    it('should render show button when collapsed', async () => {
      const user = userEvent.setup()
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )

      // Click collapse button
      const collapseButton = screen.getByText('×')
      await user.click(collapseButton)

      // Check for show button
      expect(screen.getByText('Show Elevation Profile')).toBeInTheDocument()
      expect(screen.queryByText('Elevation Profile')).not.toBeInTheDocument()
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('should collapse when close button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )

      const collapseButton = screen.getByText('×')
      await user.click(collapseButton)

      expect(screen.queryByText('Elevation Profile')).not.toBeInTheDocument()
      expect(screen.getByText('Show Elevation Profile')).toBeInTheDocument()
    })

    it('should expand when show button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )

      // Collapse first
      const collapseButton = screen.getByText('×')
      await user.click(collapseButton)

      // Then expand
      const showButton = screen.getByText('Show Elevation Profile')
      await user.click(showButton)

      expect(screen.getByText('Elevation Profile')).toBeInTheDocument()
      expect(
        screen.queryByText('Show Elevation Profile')
      ).not.toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading message when isLoading is true', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
          isLoading={true}
        />
      )
      expect(screen.getByText('Loading elevation data...')).toBeInTheDocument()
    })

    it('should not show loading message when isLoading is false', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
          isLoading={false}
        />
      )
      expect(
        screen.queryByText('Loading elevation data...')
      ).not.toBeInTheDocument()
    })

    it('should not render stats or chart when loading', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
          isLoading={true}
        />
      )
      expect(screen.queryByText('Elevation Gain')).not.toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  describe('Elevation Stats', () => {
    it('should display elevation gain', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      expect(screen.getByText('Elevation Gain')).toBeInTheDocument()
      expect(screen.getByText('250 m')).toBeInTheDocument()
    })

    it('should display elevation loss', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      expect(screen.getByText('Elevation Loss')).toBeInTheDocument()
      expect(screen.getByText('150 m')).toBeInTheDocument()
    })

    it('should display min elevation', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      expect(screen.getByText('Min Elevation')).toBeInTheDocument()
      expect(screen.getByText('100 m')).toBeInTheDocument()
    })

    it('should display max elevation', () => {
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      expect(screen.getByText('Max Elevation')).toBeInTheDocument()
      expect(
        screen.getByText(`${Math.round(mockElevationStats.max)} m`)
      ).toBeInTheDocument()
    })

    it('should format stats with proper rounding', () => {
      const stats = createMockElevationStats({
        gain: 123.456,
        loss: 78.901,
        min: 99.876,
        max: 299.123,
      })
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={stats}
        />
      )
      expect(screen.getByText('123 m')).toBeInTheDocument()
      expect(screen.getByText('79 m')).toBeInTheDocument()
      expect(screen.getByText('100 m')).toBeInTheDocument()
      expect(screen.getByText('299 m')).toBeInTheDocument()
    })
  })

  describe('Elevation Chart', () => {
    it('should render SVG chart when data is available', () => {
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('should show message when no elevation data', () => {
      render(
        <ElevationProfile
          elevationProfile={[]}
          elevationStats={mockElevationStats}
        />
      )
      expect(
        screen.getByText('No elevation data available')
      ).toBeInTheDocument()
    })

    it('should render elevation path in SVG', () => {
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      const paths = container.querySelectorAll('path')
      expect(paths.length).toBeGreaterThan(0)
    })

    it('should render grid lines', () => {
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      const lines = container.querySelectorAll('line')
      expect(lines.length).toBeGreaterThan(0)
    })

    it('should render axis labels', () => {
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      const texts = container.querySelectorAll('text')
      expect(texts.length).toBeGreaterThan(0)
    })

    it('should render interactive circles for each point', () => {
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      const circles = container.querySelectorAll('circle')
      expect(circles.length).toBe(mockElevationProfile.length)
    })

    it('should render interactive rectangles for hover detection', () => {
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )
      const rects = container.querySelectorAll('rect')
      expect(rects.length).toBe(mockElevationProfile.length)
    })
  })

  describe('Mouse Interactions', () => {
    it('should show tooltip on hover', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )

      // Hover over first interactive rectangle
      const rects = container.querySelectorAll('rect')
      await user.hover(rects[0])

      // Check for tooltip
      expect(screen.getByText('Distance:')).toBeInTheDocument()
      expect(screen.getByText('Elevation:')).toBeInTheDocument()
    })

    it('should update store when hovering over a point', async () => {
      const user = userEvent.setup()
      const store = useRouteStore.getState()
      const setHoveredSpy = vi.spyOn(store, 'setHoveredElevationPoint')

      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )

      // Hover over first interactive rectangle
      const rects = container.querySelectorAll('rect')
      await user.hover(rects[0])

      expect(setHoveredSpy).toHaveBeenCalledWith(mockElevationProfile[0])
    })

    it('should clear hovered point on mouse leave', async () => {
      const user = userEvent.setup()
      const store = useRouteStore.getState()
      const setHoveredSpy = vi.spyOn(store, 'setHoveredElevationPoint')

      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )

      const svg = container.querySelector('svg')!

      // Hover then leave
      await user.hover(svg)
      await user.unhover(svg)

      expect(setHoveredSpy).toHaveBeenCalledWith(null)
    })

    it('should show hover line when hovering', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )

      const rects = container.querySelectorAll('rect')
      await user.hover(rects[0])

      // Check for dashed hover line (strokeDasharray="4")
      const lines = container.querySelectorAll('line[stroke-dasharray="4"]')
      expect(lines.length).toBeGreaterThan(0)
    })

    it('should display correct values in tooltip', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={mockElevationStats}
        />
      )

      const rects = container.querySelectorAll('rect')
      await user.hover(rects[0])

      // First point should have distance 0 and its elevation
      const firstPoint = mockElevationProfile[0]
      expect(
        screen.getByText(`${(firstPoint.distance / 1000).toFixed(2)} km`)
      ).toBeInTheDocument()
      // Use getAllByText since elevation value might appear in stats too
      const elevationTexts = screen.getAllByText(
        `${firstPoint.elevation.toFixed(0)} m`
      )
      expect(elevationTexts.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle single elevation point', () => {
      // Single point with some distance to avoid division by zero
      const singlePoint = [
        {
          distance: 100,
          elevation: 200,
          lat: 50.0,
          lon: 10.0,
        },
      ]
      const singleStats = createMockElevationStats({
        min: 200,
        max: 200,
      })
      // Suppress console warnings for this edge case test
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const { container } = render(
        <ElevationProfile
          elevationProfile={singlePoint}
          elevationStats={singleStats}
        />
      )
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()

      consoleWarn.mockRestore()
      consoleError.mockRestore()
    })

    it('should handle very large elevation values', () => {
      const largeStats = createMockElevationStats({
        gain: 5000,
        loss: 3000,
        min: 0,
        max: 8000,
      })
      render(
        <ElevationProfile
          elevationProfile={mockElevationProfile}
          elevationStats={largeStats}
        />
      )
      expect(screen.getByText('5000 m')).toBeInTheDocument()
      expect(screen.getByText('8000 m')).toBeInTheDocument()
    })

    it('should handle zero elevation range with multiple points', () => {
      // Create profile with varying distance but same elevation
      const flatProfile = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
        { distance: 1000, elevation: 100, lat: 50.001, lon: 10.001 },
        { distance: 2000, elevation: 100, lat: 50.002, lon: 10.002 },
      ]
      const flatStats = createMockElevationStats({
        gain: 0,
        loss: 0,
        min: 100,
        max: 100,
      })
      // Suppress console warnings for this edge case test
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      render(
        <ElevationProfile
          elevationProfile={flatProfile}
          elevationStats={flatStats}
        />
      )
      // Use getAllByText since multiple stats will show "100 m"
      const elevationTexts = screen.getAllByText('100 m')
      expect(elevationTexts.length).toBeGreaterThan(0)

      consoleWarn.mockRestore()
      consoleError.mockRestore()
    })
  })
})
