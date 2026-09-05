'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/Layout'
import { auditApi } from '@/lib/api'
import type { AuditLogItem } from '@/lib/api'
import { jalaliDisplay, toPersianNums } from '@/lib/jalali'

const ACTION_LABEL: Record<string, string> = {
  create: 'ایجاد', update: 'ویرایش', delete: 'حذف', archive: 'بایگانی',
  transfer: 'انتقال', score: 'امتیازدهی', config: 'پیکربندی', import: 'ورود گروهی',
}
const ACTION_COLOR: Record<string, string> = {
  create: 'var(--accent-success)', update: 'var(--accent-info)', delete: 'var(--accent-danger)',
  archive: 'var(--accent-warning)', transfer: 'var(--accent-warning)', score: 'var(--accent-primary)',
  config: 'var(--accent-info)', import: 'var(--accent-success)',
}

const ENTITY_LABEL: Record<string, string> = {
  employee: 'کارمند', team: 'تیم', criterion: 'معیار KPI',
  team_config: 'تنظیمات تیم', period: 'دوره', entry: 'نمره',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    auditApi.list(entityFilter || undefined)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [entityFilter])

  const entities = Array.from(new Set(['', ...logs.map(l => l.entity_type)]))

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="page-header">
          <div>
            <h1 className="page-title">گزارش فعالیت‌ها</h1>
            <p className="page-subtitle">تاریخچه کامل تغییرات — چه کسی، چه چیزی، چه زمانی (برای انطباق منابع انسانی)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 16 }}>
          {entities.map(e => (
            <button
              key={e}
              onClick={() => setEntityFilter(entityFilter === e ? '' : e)}
              className="tab"
              style={{
                background: entityFilter === e ? 'var(--accent-primary)' : 'transparent',
                color: entityFilter === e ? 'white' : 'var(--text-secondary)',
              }}
            >
              {e ? ENTITY_LABEL[e] || e : 'همه'}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 8 }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ padding: 40 }}>
              <div className="spinner" style={{ width: 26, height: 26 }} />
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-icon">📜</div>
              <div className="empty-state-title">رکوردی ثبت نشده است</div>
              <div className="empty-state-desc">تغییرات کارمندان، نمرات و پیکربندی‌ها اینجا ثبت می‌شود</div>
            </div>
          ) : (
            logs.map(log => (
              <div
                key={log.id}
                className="flex items-center gap-3"
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-secondary)' }}
              >
                <span
                  className="badge"
                  style={{ background: 'var(--bg-tertiary)', color: ACTION_COLOR[log.action] || 'var(--text-secondary)', minWidth: 64, justifyContent: 'center' }}
                >
                  {ACTION_LABEL[log.action] || log.action}
                </span>
                <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                  {ENTITY_LABEL[log.entity_type] || log.entity_type}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>{log.description}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {jalaliDisplay(log.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  )
}