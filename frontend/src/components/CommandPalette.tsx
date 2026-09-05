'use client'

/**
 * Command Palette (Ctrl+K) — quick-jump to pages + live employee search.
 * Laws of UX: Hick's Law (searchable menu), Fitts's Law (full-width targets).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Search, IdCard } from 'lucide-react'
import { NAV_GROUPS } from '@/components/nav-config'
import { employeesApi, type Employee } from '@/lib/api'
import { Avatar } from '@/components/ui'

interface NavTarget {
  href: string
  label: string
  icon: LucideIcon
  group: string
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [employees, setEmployees] = useState<Employee[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Flatten nav targets once
  const navTargets = useMemo<NavTarget[]>(
    () =>
      NAV_GROUPS.flatMap(g =>
        g.items.map(i => ({ href: i.href, label: i.label, icon: i.icon, group: g.label }))
      ),
    []
  )

  // Load employees once when opened (small org — one fetch is fine)
  useEffect(() => {
    if (open && employees.length === 0) {
      employeesApi.listAll().then(setEmployees).catch(() => {})
    }
  }, [open, employees.length])

  // Focus + reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const normalizedQuery = query.trim()

  const filteredNav = useMemo(() => {
    if (!normalizedQuery) return navTargets.slice(0, 8)
    const q = normalizedQuery.toLowerCase()
    return navTargets.filter(t => t.label.toLowerCase().includes(q)).slice(0, 6)
  }, [navTargets, normalizedQuery])

  const filteredEmployees = useMemo(() => {
    if (!normalizedQuery) return []
    const q = normalizedQuery.toLowerCase()
    return employees
      .filter(
        e =>
          !e.is_archived &&
          (`${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
            e.employee_code.toLowerCase().includes(q))
      )
      .slice(0, 6)
  }, [employees, normalizedQuery])

  const flatResults = useMemo(
    () => [
      ...filteredNav.map(t => ({ kind: 'nav' as const, target: t })),
      ...filteredEmployees.map(e => ({ kind: 'employee' as const, employee: e })),
    ],
    [filteredNav, filteredEmployees]
  )

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const sel = flatResults[activeIdx]
        if (!sel) return
        onClose()
        if (sel.kind === 'nav') router.push(sel.target.href)
        else router.push(`/reports?employee_id=${sel.employee.id}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, flatResults, activeIdx, onClose, router])

  // Scroll active item into view
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  let renderIdx = -1

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk-panel" onClick={e => e.stopPropagation()}>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute', top: '50%', right: 20, transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="جستجو در منوها و کارمندان…"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setActiveIdx(0)
            }}
            style={{ paddingRight: 44 }}
          />
        </div>

        <div className="cmdk-list" ref={listRef}>
          {flatResults.length === 0 && (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
              نتیجه‌ای یافت نشد
            </div>
          )}

          {filteredNav.length > 0 && (
            <div className="cmdk-group-label">صفحات</div>
          )}
          {filteredNav.map(t => {
            renderIdx++
            const idx = renderIdx
            const Icon = t.icon
            const active = idx === activeIdx
            return (
              <div
                key={`nav-${t.href}`}
                className="cmdk-item"
                data-active={active}
                onClick={() => {
                  onClose()
                  router.push(t.href)
                }}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <Icon size={16} style={{ flexShrink: 0, opacity: 0.8 }} />
                <span>{t.label}</span>
                <span className="cmdk-kbd">{t.group}</span>
              </div>
            )
          })}

          {filteredEmployees.length > 0 && (
            <div className="cmdk-group-label">کارمندان</div>
          )}
          {filteredEmployees.map(e => {
            renderIdx++
            const idx = renderIdx
            const active = idx === activeIdx
            return (
              <div
                key={`emp-${e.id}`}
                className="cmdk-item"
                data-active={active}
                onClick={() => {
                  onClose()
                  router.push(`/reports?employee_id=${e.id}`)
                }}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <Avatar name={`${e.first_name} ${e.last_name}`} size={26} />
                <span>
                  {e.first_name} {e.last_name}
                </span>
                <span className="cmdk-kbd">{e.team_name || 'بدون تیم'}</span>
              </div>
            )
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '8px 16px',
            borderTop: '1px solid var(--border-secondary)',
            fontSize: '0.62rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>↑↓ حرکت</span>
          <span>↵ انتخاب</span>
          <span>Esc بستن</span>
          <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IdCard size={11} /> جستجوی کارمند → گزارش فردی
          </span>
        </div>
      </div>
    </div>
  )
}
