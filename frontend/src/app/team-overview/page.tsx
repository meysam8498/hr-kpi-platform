'use client'

/**
 * نمای کلی تیم‌ها — management view comparing KPI averages for every
 * team the signed-in user may manage (admin/HR: all teams; manager:
 * their primary + tick-granted teams). Employees never see this page.
 */
import { useEffect, useState } from 'react'
import HeadIcon from '@/components/HeadIcon'
import AppLayout from '@/components/Layout'
import { dashboardApi, kpiApi } from '@/lib/api'
import type { TeamOverviewPayload, TeamOverviewRow, ReportingPeriod } from '@/lib/api'
import { toPersianNums } from '@/lib/jalali'
import { useAuth } from '@/lib/auth-context'
import { ScorePill } from '@/components/ui'

function fa(n: number | string | null): string {
  if (n === null) return '—'
  return toPersianNums(String(n))
}

export default function TeamOverviewPage() {
  const { user } = useAuth()
  const [data, setData] = useState<TeamOverviewPayload | null>(null)
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [periodId, setPeriodId] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    kpiApi.listPeriods().then((ps) => {
      setPeriods(ps)
      const active = ps.find((p) => (p as { is_active?: boolean }).is_active)
      if (active) setPeriodId(active.id)
    }).catch(() => { /* periods optional */ })
  }, [])

  useEffect(() => {
    setLoading(true)
    dashboardApi.teamOverview(periodId)
      .then(setData)
      .catch(() => setError('خطا در دریافت نمای تیم‌ها'))
      .finally(() => setLoading(false))
  }, [periodId])

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    </AppLayout>
  )

  if (error || !data) return (
    <AppLayout>
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: 'var(--accent-danger)', opacity: 0.5 }}><HeadIcon glyph="⚠" size={40} /></div>
        <div className="empty-state-title">{error || 'داده‌ای یافت نشد'}</div>
      </div>
    </AppLayout>
  )

  const teams = data.teams ?? []
  const scored = teams.filter((t: TeamOverviewRow) => t.average !== null)
  const best = scored.length ? scored.reduce((a, b) => (b.average! > a.average! ? b : a)) : null
  const totalMembers = teams.reduce((s, t) => s + t.member_count, 0)
  const totalScored = teams.reduce((s, t) => s + t.scored_count, 0)

  return (
    <AppLayout>
      <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap" style={{ gap: 12, marginBottom: 18 }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <div className="page-icon" style={{
              width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'var(--accent-primary-bg, rgba(91,106,191,0.12))',
              color: 'var(--accent-primary, #5b6abf)',
            }}>
              <HeadIcon glyph="📊" size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>نمای کلی تیم‌ها</h1>
              <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '2px 0 0' }}>
                مقایسه میانگین KPI تیم‌های شما — دوره: {data.period ? data.period.name : '—'}
                {user && user.role !== 'employee' ? '' : ''}
              </p>
            </div>
          </div>
          <select
            className="input"
            value={periodId ?? ''}
            onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : undefined)}
            style={{ width: 'auto', minWidth: 180, fontSize: '0.85rem' }}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 10, marginBottom: 18 }}>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>تعداد تیم‌ها</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fa(teams.length)}</div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>کارمندان</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fa(totalMembers)}</div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>نمره‌گرفته</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fa(totalScored)}</div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>بهترین تیم</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>
              {best ? `${best.team_name} (${fa(best.average!.toFixed(1))})` : '—'}
            </div>
          </div>
        </div>

        {/* Team cards */}
        {teams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><HeadIcon glyph="🏢" size={40} /></div>
            <div className="empty-state-title">تیمی در محدوده دسترسی شما نیست</div>
            <div className="empty-state-desc">برای دریافت دسترسی تیم، با مدیر سیستم تماس بگیرید.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
            {teams.map((t) => (
              <div key={t.team_id} className="card" style={{ padding: 16 }}>
                <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 10 }}>
                  <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--surface-2, rgba(127,127,127,0.12))',
                    }}>
                      <HeadIcon glyph="🏢" size={17} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.team_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>
                        {fa(t.member_count)} نفر · نمره‌گرفته: {fa(t.scored_count)}
                      </div>
                    </div>
                  </div>
                  <ScorePill score={t.average} />
                </div>

                {/* average bar */}
                <div style={{
                  height: 8, borderRadius: 6, background: 'var(--surface-2, rgba(127,127,127,0.15))',
                  overflow: 'hidden', marginBottom: 10,
                }}>
                  <div style={{
                    height: '100%', borderRadius: 6,
                    width: `${t.average !== null ? Math.max(4, (t.average / 100) * 100) : 0}%`,
                    background:
                      t.average === null ? 'transparent'
                        : t.average >= 80 ? 'var(--accent-success)'
                          : t.average >= 70 ? 'var(--accent-info)'
                            : t.average >= 60 ? 'var(--accent-warning)'
                              : 'var(--accent-danger)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                <div className="grid grid-cols-3" style={{ gap: 8, fontSize: '0.75rem' }}>
                  <div>
                    <div style={{ opacity: 0.6, marginBottom: 2 }}>برترین</div>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.top ? `${t.top.name} — ${fa(t.top.score.toFixed(1))}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.6, marginBottom: 2 }}>پایین‌ترین</div>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.lowest ? `${t.lowest.name} — ${fa(t.lowest.score.toFixed(1))}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.6, marginBottom: 2 }}>زیر ۶۰</div>
                    <div style={{ fontWeight: 600, color: t.below_60 > 0 ? 'var(--accent-danger)' : undefined }}>
                      {fa(t.below_60)} نفر
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
