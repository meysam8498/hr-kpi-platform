'use client'

/**
 * SearchBox — reusable instant search input.
 * Used on every list page (employees, teams, users) so a few keystrokes
 * find any record by code, name, position, or any other field.
 */
import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function SearchBox({
  value,
  onChange,
  placeholder = 'جستجو…',
  width = 260,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number | string
}) {
  const [local, setLocal] = useState(value)

  // Keep local typing snappy; propagate to parent after a tiny debounce
  useEffect(() => {
    const t = setTimeout(() => onChange(local), 150)
    return () => clearTimeout(t)
  }, [local]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when parent resets the value
  useEffect(() => { setLocal(value) }, [value])

  return (
    <div className="relative" style={{ width }}>
      <Search size={14} className="absolute" style={{ top: '50%', right: 10, transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
      <input
        value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder={placeholder}
        className="input-field"
        style={{ paddingRight: 32, paddingLeft: local ? 30 : 12, fontSize: '0.78rem' }}
      />
      {local && (
        <button
          onClick={() => { setLocal(''); onChange('') }}
          className="absolute"
          style={{ top: '50%', left: 8, transform: 'translateY(-50%)', color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }}
          title="پاک کردن"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

/**
 * Universal match helper — searches across multiple fields of a record.
 * Normalizes Persian/Arabic characters (ي→ی, ك→ک) and folds Persian
 * digits to Latin so «۱۲۳» matches "123".
 */
export function matchesQuery(fields: (string | number | null | undefined)[], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ه').replace(/ة/g, 'ه')
      .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const nq = norm(q)
  return fields.some(f => {
    if (f === null || f === undefined) return false
    return norm(String(f)).includes(nq)
  })
}
