'use client'

/**
 * Sparkline — tiny inline SVG line chart for trend display in tables/cards.
 * No chart library; pure SVG. Accepts 2+ points; renders nothing otherwise.
 */
export default function Sparkline({
  points,
  width = 72,
  height = 22,
  color = 'var(--accent-primary)',
}: {
  points: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (!points || points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const pad = 2

  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return [x, y] as const
  })

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]

  return (
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden="true">
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} />
    </svg>
  )
}
