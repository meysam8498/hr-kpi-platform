'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, Info, AlertTriangle, CheckCircle2, Clock, CheckCheck, Inbox } from 'lucide-react'
import { notificationsApi } from '@/lib/api'
import type { NotificationItem } from '@/lib/api'
import { toPersianNums } from '@/lib/jalali'

const TYPE_ICON: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  deadline: Clock,
}

const TYPE_COLOR: Record<string, string> = {
  info: 'var(--accent-info)',
  warning: 'var(--accent-warning)',
  success: 'var(--accent-success)',
  deadline: 'var(--accent-danger)',
}

export default function NotificationBell({ variant = 'desktop', anchorOffset = 232 }: { variant?: 'desktop' | 'mobile'; anchorOffset?: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(() => {
    notificationsApi.unreadCount().then(r => setUnread(r.count)).catch(() => {})
  }, [])

  useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, 30000)
    return () => clearInterval(t)
  }, [refreshCount])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      notificationsApi.list().then(setItems).catch(() => {})
    }
  }

  const markAll = async () => {
    await notificationsApi.markAllRead()
    setUnread(0)
    setItems(prev => prev.map(i => ({ ...i, is_read: true })))
  }

  const openItem = async (item: NotificationItem) => {
    if (!item.is_read) {
      await notificationsApi.markRead(item.id)
      setUnread(u => Math.max(0, u - 1))
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, is_read: true } : i)))
    }
    if (item.link) {
      setOpen(false)
      router.push(item.link)
    }
  }

  const isDarkSurface = variant === 'desktop'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label="اعلان‌ها" title="اعلان‌ها"
        style={{
          width: 38, height: 38, borderRadius: 10,
          border: isDarkSurface ? '1px solid rgba(255,255,255,0.10)' : '1px solid var(--border-primary)',
          background: open
            ? (isDarkSurface ? 'rgba(255,255,255,0.08)' : 'var(--accent-primary-subtle)')
            : (isDarkSurface ? 'rgba(255,255,255,0.03)' : 'var(--bg-tertiary)'),
          color: open
            ? (isDarkSurface ? '#fff' : 'var(--accent-primary)')
            : (isDarkSurface ? 'var(--text-sidebar)' : 'var(--text-secondary)'),
          cursor: 'pointer', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
      >
        <Bell size={17} strokeWidth={1.9} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: -4, left: -4,
              minWidth: 17, height: 17, borderRadius: 9,
              background: 'var(--accent-danger)',
              color: 'white', fontSize: '0.58rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 1px 4px rgba(220,82,82,0.4)',
            }}
          >
            {toPersianNums(String(unread > 99 ? '۹۹+' : unread))}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            ...(variant === 'mobile'
              ? { top: 66, left: 12, right: 12 }
              : { bottom: 12, right: anchorOffset, width: 360, maxWidth: 'calc(100vw - 56px)' }),
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-xl)',
            zIndex: 100,
            overflow: 'hidden',
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)' }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>اعلان‌ها</span>
            {unread > 0 && (
              <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>
                {toPersianNums(String(unread))} خوانده‌نشده
              </span>
            )}
            <button
              onClick={markAll}
              className="flex items-center gap-1"
              style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <CheckCheck size={13} />
              خواندن همه
            </button>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                <div style={{ marginBottom: 8, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'center' }}>
                  <BellOff size={26} strokeWidth={1.6} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>اعلانی وجود ندارد</div>
              </div>
            ) : (
              items.slice(0, 20).map(item => {
                const TypeIcon = TYPE_ICON[item.type] || Info
                return (
                  <button
                    key={item.id}
                    onClick={() => openItem(item)}
                    style={{
                      display: 'flex', gap: 10, width: '100%', textAlign: 'right',
                      padding: '12px 18px',
                      background: item.is_read ? 'transparent' : 'var(--accent-primary-subtle)',
                      border: 'none', borderBottom: '1px solid var(--border-secondary)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'background-color 0.12s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = item.is_read ? 'transparent' : 'var(--accent-primary-subtle)' }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 30, height: 30, borderRadius: 9,
                        background: `color-mix(in srgb, ${TYPE_COLOR[item.type] || 'var(--accent-info)'} 12%, transparent)`,
                        color: TYPE_COLOR[item.type] || 'var(--accent-info)',
                      }}
                    >
                      <TypeIcon size={15} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.message}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
