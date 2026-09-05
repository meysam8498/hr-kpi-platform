'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, Info, AlertTriangle, CheckCircle2, Clock, Trash2 } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { notificationsApi } from '@/lib/api'
import type { NotificationItem } from '@/lib/api'
import { jalaliDisplay, toPersianNums } from '@/lib/jalali'

const TYPE_ICON: Record<string, any> = { info: Info, warning: AlertTriangle, success: CheckCircle2, deadline: Clock }
const TYPE_COLOR: Record<string, string> = {
  info: 'var(--accent-info)', warning: 'var(--accent-warning)',
  success: 'var(--accent-success)', deadline: 'var(--accent-danger)',
}

export default function NotificationsPage() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUnread, setShowUnread] = useState(false)

  const load = (unread = false) => {
    setLoading(true)
    notificationsApi.list(unread)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(showUnread) }, [showUnread]) // eslint-disable-line react-hooks/exhaustive-deps

  const markAll = async () => {
    await notificationsApi.markAllRead()
    load(showUnread)
  }

  const markOne = async (item: NotificationItem) => {
    if (!item.is_read) {
      await notificationsApi.markRead(item.id)
      load(showUnread)
    }
    if (item.link) router.push(item.link)
  }

  const remove = async (id: number) => {
    await notificationsApi.delete(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const checkDeadlines = async () => {
    await notificationsApi.checkDeadlines()
    load(showUnread)
  }

  const unreadCount = items.filter(i => !i.is_read).length

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="page-header">
          <div>
            <h1 className="page-title">اعلان‌ها</h1>
            <p className="page-subtitle">یادآوری دوره‌ها، هشدارها و رویدادهای سیستم</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-outline" onClick={checkDeadlines}><Clock size={14} /> بررسی مهلت‌ها</button>
            <button className="btn btn-primary" onClick={markAll} disabled={unreadCount === 0}>خواندن همه</button>
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          {[false, true].map(u => (
            <button
              key={String(u)}
              onClick={() => setShowUnread(u)}
              className="tab"
              style={{
                background: showUnread === u ? 'var(--accent-primary)' : 'transparent',
                color: showUnread === u ? 'white' : 'var(--text-secondary)',
              }}
            >
              {u ? `خوانده‌نشده (${toPersianNums(String(unreadCount))})` : 'همه'}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 8 }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ padding: 40 }}>
              <div className="spinner" style={{ width: 26, height: 26 }} />
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-icon" style={{ color: 'var(--text-tertiary)', opacity: 0.4 }}><BellOff size={40} strokeWidth={1.3} /></div>
              <div className="empty-state-title">اعلانی وجود ندارد</div>
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-3"
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: item.is_read ? 'transparent' : 'var(--accent-primary-subtle)',
                  borderBottom: '1px solid var(--border-secondary)',
                  cursor: item.link ? 'pointer' : 'default',
                }}
                onClick={() => item.link && markOne(item)}
              >
                <span
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 32, height: 32, borderRadius: 10, marginTop: 0,
                    background: `color-mix(in srgb, ${TYPE_COLOR[item.type] || 'var(--accent-info)'} 12%, transparent)`,
                    color: TYPE_COLOR[item.type] || 'var(--accent-info)',
                  }}
                >
                  {(() => { const T = TYPE_ICON[item.type]; return T ? <T size={15} /> : <Info size={15} /> })()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</span>
                    {!item.is_read && <span className="badge badge-danger" style={{ fontSize: '0.55rem' }}>جدید</span>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 3 }}>{item.message}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: 5 }}>
                    {jalaliDisplay(item.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!item.is_read && (
                    <button className="btn-icon" title="خوانده شود" onClick={e => { e.stopPropagation(); markOne(item) }}><CheckCircle2 size={14} /></button>
                  )}
                  <button className="btn-icon btn-icon-danger" title="حذف" onClick={e => { e.stopPropagation(); remove(item.id) }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  )
}