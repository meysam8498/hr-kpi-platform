'use client'

/**
 * Shared UI Primitives — used across every page for visual consistency.
 *
 * - Avatar: deterministic color-hashed initial circle
 * - ScorePill: color-coded 0–100 score badge with optional trend arrow
 * - StatusChip: one consistent status badge (فعال/آرشیو/PIP/...)
 * - EmptyState: friendly Persian empty state with icon + CTA
 * - Skeleton: shimmer loading placeholder
 * - CountUp: animated number counting (tabular-nums, Persian digits safe)
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { toPersianNums } from '@/lib/jalali'

/* ════════════════════════════════════════════════════════════════
   AVATAR — deterministic hash-colored initial circle
   ════════════════════════════════════════════════════════════════ */

const AVATAR_PALETTE = [
  'linear-gradient(135deg, #5b6abf, #7c8ae0)',
  'linear-gradient(135deg, #3dab82, #5cc9a0)',
  'linear-gradient(135deg, #e0a030, #f0c060)',
  'linear-gradient(135deg, #dc5252, #f07070)',
  'linear-gradient(135deg, #3a96d4, #60b8f0)',
  'linear-gradient(135deg, #9b6dd7, #b58ae8)',
  'linear-gradient(135deg, #d4713a, #e8a070)',
  'linear-gradient(135deg, #3a8fa0, #60b8c8)',
]

export function Avatar({
  name,
  size = 36,
  archived = false,
}: {
  name: string
  size?: number
  archived?: boolean
}) {
  // Deterministic color from name (stable across renders)
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  const bg = AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
  // First letters of first two words (Persian initials join fine)
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.charAt(0))
    .join(' ')

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: size * 0.32,
        background: archived
          ? 'var(--bg-tertiary)'
          : bg,
        color: archived ? 'var(--text-muted)' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 700,
        letterSpacing: 0,
        flexShrink: 0,
        boxShadow: archived ? 'none' : '0 2px 8px rgba(0,0,0,0.12)',
        opacity: archived ? 0.7 : 1,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  )
}

/** Row with avatar + name + subtitle — the standard "person cell". */
export function PersonCell({
  name,
  subtitle,
  archived = false,
  size = 36,
}: {
  name: string
  subtitle?: ReactNode
  archived?: boolean
  size?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Avatar name={name} size={size} archived={archived} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: archived ? 'var(--text-tertiary)' : 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textDecoration: archived ? 'line-through' : 'none',
          }}
        >
          {name}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SCORE PILL — color-coded 0–100 with optional trend arrow
   ════════════════════════════════════════════════════════════════ */

export function scoreBand(score: number | null | undefined): 'excellent' | 'good' | 'average' | 'poor' | 'none' {
  if (score == null || isNaN(score)) return 'none'
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 60) return 'average'
  return 'poor'
}

export function ScorePill({
  score,
  trend,
  size = 'md',
}: {
  score: number | null | undefined
  /** change vs previous period: +2.5, -4, 0 — renders ▲/▼/– */
  trend?: number | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const band = scoreBand(score)
  if (band === 'none') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 52, padding: '4px 10px', borderRadius: 20,
          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          fontSize: size === 'sm' ? '0.7rem' : '0.8rem', fontWeight: 700,
          border: '1px dashed var(--border-primary)',
        }}
      >
        —
      </span>
    )
  }

  const colors: Record<string, { bg: string; fg: string; bd: string }> = {
    excellent: { bg: 'var(--accent-success-subtle)', fg: 'var(--accent-success)', bd: 'var(--accent-success)' },
    good: { bg: 'var(--accent-info-subtle)', fg: 'var(--accent-info)', bd: 'var(--accent-info)' },
    average: { bg: 'var(--accent-warning-subtle)', fg: 'var(--accent-warning)', bd: 'var(--accent-warning)' },
    poor: { bg: 'var(--accent-danger-subtle)', fg: 'var(--accent-danger)', bd: 'var(--accent-danger)' },
  }
  const c = colors[band]
  const fs = size === 'sm' ? '0.68rem' : size === 'lg' ? '1.05rem' : '0.82rem'
  const trendIcon = trend == null ? null : trend > 0 ? '▲' : trend < 0 ? '▼' : '–'
  const trendColor = trend == null || trend === 0 ? 'inherit' : trend > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 5, minWidth: size === 'sm' ? 46 : 58, padding: size === 'lg' ? '6px 14px' : '4px 11px',
        borderRadius: 20, background: c.bg, color: c.fg,
        border: `1px solid ${c.bd}`, fontSize: fs, fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.4,
      }}
      title={`نمره: ${toPersianNums(score!.toFixed(1))}`}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', opacity: 0.85 }} />
      {toPersianNums(score!.toFixed(1))}
      {trendIcon && (
        <span style={{ fontSize: '0.58em', color: trendColor, opacity: 0.9 }}>{trendIcon}</span>
      )}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════
   STATUS CHIP — one consistent status badge
   ════════════════════════════════════════════════════════════════ */

type ChipKind = 'active' | 'archived' | 'pip' | 'away' | 'done' | 'warning' | 'neutral'

const CHIP_STYLES: Record<ChipKind, { bg: string; fg: string; dot: string }> = {
  active: { bg: 'var(--accent-success-subtle)', fg: 'var(--accent-success)', dot: 'var(--accent-success)' },
  archived: { bg: 'var(--bg-tertiary)', fg: 'var(--text-tertiary)', dot: 'var(--text-muted)' },
  pip: { bg: 'var(--accent-warning-subtle)', fg: 'var(--accent-warning)', dot: 'var(--accent-warning)' },
  away: { bg: 'var(--accent-info-subtle)', fg: 'var(--accent-info)', dot: 'var(--accent-info)' },
  done: { bg: 'var(--accent-success-subtle)', fg: 'var(--accent-success)', dot: 'var(--accent-success)' },
  warning: { bg: 'var(--accent-danger-subtle)', fg: 'var(--accent-danger)', dot: 'var(--accent-danger)' },
  neutral: { bg: 'var(--accent-primary-subtle)', fg: 'var(--accent-primary)', dot: 'var(--accent-primary)' },
}

export function StatusChip({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  const s = CHIP_STYLES[kind]
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 20,
        background: s.bg, color: s.fg,
        fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%', background: s.dot,
          animation: kind === 'active' ? 'pulse 2s ease-in-out infinite' : undefined,
        }}
      />
      {children}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════
   EMPTY STATE — friendly guidance (Checklist.design: helpful feedback)
   ════════════════════════════════════════════════════════════════ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div
        style={{
          width: 64, height: 64, margin: '0 auto 14px', borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-primary-subtle)', color: 'var(--accent-primary)',
        }}
      >
        <Icon size={30} strokeWidth={1.8} />
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SKELETON — shimmer loading placeholders
   ════════════════════════════════════════════════════════════════ */

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | string
  height?: number | string
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

/** Table-shaped skeleton block (header + N rows). */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, padding: '8px 12px' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={i === 0 ? 120 : 70} height={12} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderTop: '1px solid var(--border-secondary)' }}>
          <Skeleton width={36} height={36} radius={12} />
          <Skeleton width={110} height={13} />
          <div style={{ flex: 1 }} />
          <Skeleton width={64} height={22} radius={11} />
          <Skeleton width={48} height={13} />
        </div>
      ))}
    </div>
  )
}

/** Card-grid skeleton (n cards). */
export function CardsSkeleton({ count = 4, height = 96 }: { count?: number; height?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width="100%" height={height} radius={16} />
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   COUNT UP — animated number (dashboard delight)
   ════════════════════════════════════════════════════════════════ */

export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  suffix,
}: {
  value: number
  duration?: number
  decimals?: number
  suffix?: string
}) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    prevRef.current = value
    const start = performance.now()

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {toPersianNums(display.toFixed(decimals))}
      {suffix}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════
   BULK ACTIONS BAR — floating selection action bar
   ════════════════════════════════════════════════════════════════ */

export function BulkBar({
  selectedCount,
  children,
  onClear,
}: {
  selectedCount: number
  children: ReactNode
  onClear: () => void
}) {
  if (selectedCount === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: '50%',
        transform: 'translateX(50%)',
        zIndex: 45,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 18px',
        borderRadius: 14,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-xl)',
        animation: 'slideUp 0.25s ease-out',
        maxWidth: 'calc(100vw - 32px)',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 26, height: 26, padding: '0 8px', borderRadius: 13,
          background: 'var(--gradient-primary)', color: '#fff',
          fontSize: '0.75rem', fontWeight: 700,
        }}
      >
        {toPersianNums(String(selectedCount))}
      </span>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
        مورد انتخاب شده
      </span>
      <span style={{ width: 1, height: 20, background: 'var(--border-primary)' }} />
      {children}
      <button
        onClick={onClear}
        className="btn btn-ghost btn-sm"
        style={{ minHeight: 30 }}
      >
        لغو انتخاب
      </button>
    </div>
  )
}
