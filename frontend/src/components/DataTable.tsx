'use client'

/**
 * DataTable — sortable sticky-header table with hover-revealed actions
 * and a mobile card layout fallback.
 *
 * Usage:
 *   <DataTable
 *     columns={[{ key: 'name', label: 'نام', sortValue: r => r.name }]}
 *     rows={rows}
 *     rowKey={r => r.id}
 *     renderCell={(r, key) => ...}
 *     renderActions={r => <button .../>}
 *     mobileCard={r => <div>...</div>}
 *   />
 *
 * - Click a header to sort (asc → desc → off); sortValue defaults to the cell text.
 * - The header stays pinned while the table body scrolls.
 * - Actions column appears on row hover on desktop (always visible on touch).
 * - Below 768px, rows render as cards via `mobileCard` (falls back to the table).
 */
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export interface DataTableColumn<T> {
  key: string
  label: string
  sortValue?: (row: T) => string | number
  width?: number | string
  align?: 'start' | 'center' | 'end'
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  renderCell,
  renderActions,
  mobileCard,
  emptyState,
  stickyOffset = 0,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  renderCell: (row: T, key: string) => ReactNode
  renderActions?: (row: T) => ReactNode
  /** Optional custom card for mobile; when omitted the table is used at all sizes. */
  mobileCard?: (row: T) => ReactNode
  emptyState?: ReactNode
  stickyOffset?: number
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find(c => c.key === sortKey)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      let cmp: number
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'fa')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir, columns])

  const toggleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortKey(null); setSortDir('asc') }
  }

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  const SortIcon = ({ col }: { col: DataTableColumn<T> }) => {
    if (!col.sortValue) return null
    if (sortKey !== col.key) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
    return sortDir === 'asc'
      ? <ArrowUp size={12} style={{ color: 'var(--accent-primary)' }} />
      : <ArrowDown size={12} style={{ color: 'var(--accent-primary)' }} />
  }

  const table = (
    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
      <table className="table" style={{ minWidth: 560 }}>
        <thead style={{ position: 'sticky', top: stickyOffset, zIndex: 5, background: 'var(--bg-secondary)' }}>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={col.sortValue ? () => toggleSort(col.key) : undefined}
                style={{
                  width: col.width,
                  textAlign: col.align ?? 'right',
                  cursor: col.sortValue ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.label}
                  <SortIcon col={col} />
                </span>
              </th>
            ))}
            {renderActions && <th style={{ textAlign: 'center', width: 110 }}>عملیات</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={rowKey(row)} className="data-row">
              {columns.map(col => (
                <td key={col.key} style={{ textAlign: col.align ?? 'right' }}>
                  {renderCell(row, col.key)}
                </td>
              ))}
              {renderActions && (
                <td className="row-actions-cell" style={{ textAlign: 'center' }}>
                  <div className="flex items-center gap-1" style={{ justifyContent: 'center' }}>
                    {renderActions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (!mobileCard) return table

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">{table}</div>
      {/* Mobile cards */}
      <div className="md:hidden mobile-cards-wrap">
        {sorted.map(row => (
          <div
            key={rowKey(row)}
            className="mobile-data-card"
            style={{
              padding: 14, borderRadius: 14,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            {mobileCard(row)}
          </div>
        ))}
      </div>
    </>
  )
}
