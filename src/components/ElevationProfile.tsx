import { useState, useRef, useEffect } from 'react'
import { DomEvent } from 'leaflet'
import { ElevationPoint, ElevationStats } from '../types'
import { useRouteStore } from '../store/useRouteStore'

interface ElevationProfileProps {
  elevationProfile: ElevationPoint[] | undefined
  elevationStats: ElevationStats | undefined
}

export function ElevationProfile({
  elevationProfile,
  elevationStats,
}: ElevationProfileProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [previousProfile, setPreviousProfile] = useState<
    ElevationPoint[] | null
  >(null)
  const [previousStats, setPreviousStats] = useState<ElevationStats | null>(
    null
  )

  // Update previous data when we have valid data
  useEffect(() => {
    if (elevationProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviousProfile(elevationProfile)
    }
    if (elevationStats) {
      setPreviousStats(elevationStats)
    }
  }, [elevationProfile, elevationStats])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      // Disable all map interactions on this element
      DomEvent.disableClickPropagation(container)
      DomEvent.disableScrollPropagation(container)
    }
  }, [])

  if (!isExpanded) {
    return (
      <div className="absolute bottom-4 left-4 z-[1000]">
        <button
          onClick={() => setIsExpanded(true)}
          className="px-4 py-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 text-sm font-medium"
        >
          Show Elevation Profile
        </button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg p-4 max-w-4xl"
    >
      {(() => {
        const displayProfile = elevationProfile || previousProfile
        const displayStats = elevationStats || previousStats
        return displayProfile && displayStats ? (
          <div className="flex gap-2 items-center">
            {/* Stats */}
            <div className="text-sm min-w-fit">
              <div className="stats-grid grid grid-cols-[auto_1fr] gap-x-2 gap-y-2 items-center">
                <div className="stat-label text-right text-gray-600">Gain</div>
                <div className="stat-value text-left font-bold text-green-700">
                  {displayStats.gain.toFixed(0)} m
                </div>

                <div className="stat-label text-right text-gray-600">Loss</div>
                <div className="stat-value text-left font-bold text-red-700">
                  {displayStats.loss.toFixed(0)} m
                </div>

                <div className="stat-label text-right text-gray-600">Min</div>
                <div className="stat-value text-left font-bold text-blue-700">
                  {displayStats.min.toFixed(0)} m
                </div>

                <div className="stat-label text-right text-gray-600">Max</div>
                <div className="stat-value text-left font-bold text-purple-700">
                  {displayStats.max.toFixed(0)} m
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="min-w-fit">
              <ElevationChart profile={displayProfile} stats={displayStats} />
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none self-start"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-600 py-8 text-center">
            Loading elevation data...
          </div>
        )
      })()}
    </div>
  )
}

interface ElevationChartProps {
  profile: ElevationPoint[]
  stats: ElevationStats
}

function ElevationChart({ profile, stats }: ElevationChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number>(0)
  const [svgRef, setSvgRef] = useState<SVGSVGElement | null>(null)
  const setHoveredElevationPoint = useRouteStore(
    (state) => state.setHoveredElevationPoint
  )

  if (profile.length === 0) {
    return (
      <div className="text-sm text-gray-600">No elevation data available</div>
    )
  }

  const width = 600
  const height = 120
  const padding = { top: 15, right: 20, bottom: 25, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Calculate scales
  const maxDistance = profile[profile.length - 1].distance
  const elevationRange = stats.max - stats.min
  const elevationPadding = elevationRange * 0.1 // 10% padding

  const xScale = (distance: number) =>
    padding.left + (distance / maxDistance) * chartWidth

  const yScale = (elevation: number) =>
    padding.top +
    chartHeight -
    ((elevation - stats.min + elevationPadding) /
      (elevationRange + 2 * elevationPadding)) *
      chartHeight

  // Generate path
  const pathData = profile
    .map((point, i) => {
      const x = xScale(point.distance)
      const y = yScale(point.elevation)
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
    })
    .join(' ')

  // Create area fill path
  const areaPath = `${pathData} L ${xScale(maxDistance)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`

  // Grid lines
  const numYTicks = 5
  const yTicks = Array.from({ length: numYTicks }, (_, i) => {
    const elevation = stats.min + (elevationRange / (numYTicks - 1)) * i
    return { elevation, y: yScale(elevation) }
  })

  const numXTicks = 5
  const xTicks = Array.from({ length: numXTicks }, (_, i) => {
    const distance = (maxDistance / (numXTicks - 1)) * i
    return { distance, x: xScale(distance) }
  })

  return (
    <div className="relative">
      <svg
        ref={setSvgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        onMouseMove={(e) => {
          if (svgRef) {
            const rect = svgRef.getBoundingClientRect()
            setHoverX(e.clientX - rect.left)
          }
        }}
        onMouseLeave={() => {
          setHoveredPoint(null)
          setHoveredElevationPoint(null)
        }}
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={tick.y}
              textAnchor="end"
              alignmentBaseline="middle"
              className="text-xs fill-gray-600"
            >
              {tick.elevation.toFixed(0)}m
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={`x-${i}`}
            x={tick.x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            className="text-xs fill-gray-600"
          >
            {(tick.distance / 1000).toFixed(1)}km
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="#3b82f6" fillOpacity="0.2" />

        {/* Elevation line */}
        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" />

        {/* Interactive overlay */}
        {profile.map((point, i) => {
          const x = xScale(point.distance)
          const y = yScale(point.elevation)
          const isHovered = hoveredPoint === i

          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 5 : 0}
                fill="#3b82f6"
                className="transition-all"
              />
              <rect
                x={x - 2}
                y={padding.top}
                width={4}
                height={chartHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => {
                  setHoveredPoint(i)
                  setHoveredElevationPoint(point)
                }}
              />
            </g>
          )
        })}

        {/* Hover tooltip */}
        {hoveredPoint !== null && (
          <g>
            <line
              x1={xScale(profile[hoveredPoint].distance)}
              y1={padding.top}
              x2={xScale(profile[hoveredPoint].distance)}
              y2={height - padding.bottom}
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="4"
            />
          </g>
        )}
      </svg>

      {/* Hover info box */}
      {hoveredPoint !== null && (
        <div
          className="absolute bg-white border border-gray-300 rounded px-3 py-2 shadow-lg text-xs pointer-events-none"
          style={{
            left: `${hoverX}px`,
            top: '10px',
            transform: 'translateX(-50%)',
          }}
        >
          <div>
            <strong>Distance:</strong>{' '}
            {(profile[hoveredPoint].distance / 1000).toFixed(2)} km
          </div>
          <div>
            <strong>Elevation:</strong>{' '}
            {profile[hoveredPoint].elevation.toFixed(0)} m
          </div>
        </div>
      )}
    </div>
  )
}
