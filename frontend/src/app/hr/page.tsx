'use client'

import { useEffect, useState } from 'react'
import HeadIcon from '@/components/HeadIcon'
import AppLayout from '@/components/Layout'
import { hrApi } from '@/lib/api'
import type { HRAnalytics } from '@/lib/api'
import { toPersianNums } from '@/lib/jalali'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts'

const BANDS = [
  { key: 'excellent', label: 'عالی (۸۰+)', color: 'var(--accent-success)' },
  { key: 'good', label: 'خوب (۷۰-۷۹)', color: 'var(--accent-info)' },
  { key: 'average', label: 'متوسط (۶۰-۶۹)', color: 'var(--accent-warning)' },
  { key: 'poor', label: 'ضعیف (زیر ۶۰)', color: 'var(--accent-danger)' },
] as const

function scoreClass(score: number): string {
  if (score >= 80) return 'score-excellent'
  if (score >= 70) return 'score-good'
  if (score >= 60) return 'score-average'
  return 'score-poor'
}

function pct(n: number): string {
  return toPersianNums(String(Math.round(n * 100)))
}

export default function HRAnalyticsPage() {
  const [data, setData] = useState<HRAnalytics | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    hrApi.analytics(selectedPeriodId ?? undefined)
      .then(setData)
      .catch(() => setError('خطا در دریافت داده‌های تحلیل'))
      .finally(() => setLoading(false))
  }, [selectedPeriodId])

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

  const w = data.workforce
  const sp = data.selected_period
  const imp = data.improvement
  const periods = data.periods.filter(p => !p.is_archived)
  const activePeriod = periods.find(p => p.is_active) || periods[0]

  const maxTeamAvg = sp && sp.team_ranking.length > 0
    ? Math.max(...sp.team_ranking.map(t => t.avg), 1)
    : 1

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">داشبورد منابع انسانی</h1>
            <p className="page-subtitle">
              تحلیل نیروی انسانی بر اساس شاخص‌های کلیدی عملکرد (نرخ ترک خدمت، توزیع نمرات، رتبه‌بندی تیم‌ها)
            </p>
          </div>
        </div>

        {/* Period Selector */}
        {periods.length > 0 && (
          <div className="card" style={{ padding: '12px 16px', marginBottom: 24 }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                دوره تحلیل:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {periods.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriodId(p.id)}
                    className="tab"
                    style={{
                      background: (selectedPeriodId ?? activePeriod?.id) === p.id ? 'var(--accent-primary)' : 'transparent',
                      color: (selectedPeriodId ?? activePeriod?.id) === p.id ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Workforce Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children" style={{ marginBottom: 24 }}>
          <div className="stat-card" style={{ background: 'var(--gradient-primary)' }}>
            <div className="stat-card-label">کارکنان فعال</div>
            <div className="stat-card-value">
              {toPersianNums(String(w.active_count))}
              <span className="stat-card-suffix">نفر</span>
            </div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-danger)' }}>
            <div className="stat-card-label">نرخ ترک خدمت</div>
            <div className="stat-card-value">
              {toPersianNums(pct(w.attrition_rate))}٪
            </div>
            <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: 4 }}>
              {toPersianNums(String(w.archived_count))} نفر خارج‌شده از {toPersianNums(String(w.total_count))}
            </div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-info)' }}>
            <div className="stat-card-label">استخدام جدید (۱ سال)</div>
            <div className="stat-card-value">
              {toPersianNums(String(w.new_hires))}
            </div>
            <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: 4 }}>
              {toPersianNums(String(w.experienced))} نفر با سابقه بیشتر
            </div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-success)' }}>
            <div className="stat-card-label">میانگین دوره</div>
            <div className="stat-card-value">
              {sp ? toPersianNums(String(sp.avg_score)) : '—'}
              <span className="stat-card-suffix">/ ۱۰۰</span>
            </div>
          </div>
        </div>

        {/* Improvement Banner */}
        {imp && (
          <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  مقایسه با دوره قبل ({imp.previous_period_name})
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}>
                  {imp.delta > 0
                    ? <span style={{ color: 'var(--accent-success)' }}>▲ رشد {toPersianNums(String(imp.delta))} نمره نسبت به دوره قبل</span>
                    : imp.delta < 0
                      ? <span style={{ color: 'var(--accent-danger)' }}>▼ افت {toPersianNums(String(Math.abs(imp.delta)))} نمره نسبت به دوره قبل</span>
                      : <span>بدون تغییر نسبت به دوره قبل</span>}
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
                <div className="badge badge-success">▲ بهبود {toPersianNums(String(imp.improved))} نفر</div>
                <div className="badge badge-danger">▼ افت {toPersianNums(String(imp.declined))} نفر</div>
                <div className="badge badge-primary">＝ ثابت {toPersianNums(String(imp.stable))} نفر</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Distribution */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="◔" /></span>
                توزیع نمرات عملکرد
              </div>
              {sp && <span className="badge badge-primary">{sp.name}</span>}
            </div>
            {sp && sp.scored_count > 0 ? (
              <div className="stagger-children">
                {BANDS.map(band => {
                  const count = sp.bands[band.key]
                  const share = sp.scored_count > 0 ? count / sp.scored_count : 0
                  return (
                    <div key={band.key} style={{ marginBottom: 14 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {band.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {toPersianNums(String(count))} نفر ({toPersianNums(pct(share))}٪)
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.max(share * 100, count > 0 ? 4 : 0)}%`, background: band.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">هنوز نمره‌ای ثبت نشده</div>
                <div className="empty-state-desc">برای این دوره ابتدا امتیازدهی انجام دهید</div>
              </div>
            )}
          </div>

          {/* Team Ranking */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="▣" /></span>
                رتبه‌بندی تیم‌ها
              </div>
            </div>
            {sp && sp.team_ranking.length > 0 ? (
              <div className="stagger-children">
                {sp.team_ranking.map((team, idx) => (
                  <div key={team.team_id} style={{ marginBottom: 14 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="flex items-center gap-2">
                        <span
                          className="badge"
                          style={{
                            background: idx === 0 ? 'var(--accent-success-subtle)' : 'var(--bg-tertiary)',
                            color: idx === 0 ? 'var(--accent-success)' : 'var(--text-secondary)',
                            minWidth: 26,
                            justifyContent: 'center',
                          }}
                        >
                          {toPersianNums(String(idx + 1))}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {team.team_name}
                        </span>
                      </span>
                      <span className="score-badge" style={{ minWidth: 56 }}>
                        {toPersianNums(String(team.avg))}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(team.avg / maxTeamAvg) * 100}%`,
                          background: idx === 0 ? 'var(--gradient-success)' : 'var(--gradient-primary)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {toPersianNums(String(team.count))} نفر ارزیابی‌شده
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🏆</div>
                <div className="empty-state-title">داده‌ای برای رتبه‌بندی نیست</div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ marginTop: 24 }}>
          {/* Trend */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="◐" /></span>
                روند میانگین عملکرد دوره‌ها
              </div>
            </div>
            {data.trend.length > 0 ? (
              <div style={{ width: '100%', height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 9) + '…' : v)} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <Tooltip
                      formatter={(v) => [toPersianNums(String(v)), 'میانگین نمره']}
                      contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, fontSize: 12, direction: 'rtl' }}
                    />
                    <Line type="monotone" dataKey="avg" stroke="var(--accent-primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📈</div>
                <div className="empty-state-title">روندی برای نمایش نیست</div>
              </div>
            )}
          </div>

          {/* Improvement vs previous */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="◉" /></span>
                بهبود عملکرد کارکنان
              </div>
            </div>
            {imp ? (
              <div className="stagger-children">
                <div className="flex items-center gap-4" style={{ marginBottom: 16 }}>
                  <div className="flex-1">
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      درصد بهبودیافته‌ها
                    </div>
                    <div className="flex items-end gap-2">
                      <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-success)', lineHeight: 1 }}>
                        {toPersianNums(String(imp.improved_pct))}٪
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 1, height: 48, background: 'var(--border-secondary)' }} />
                  <div className="flex-1">
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      میانگین دوره قبل ({imp.previous_period_name})
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {toPersianNums(String(imp.previous_avg))}
                    </div>
                  </div>
                </div>
                <div className="progress-track" style={{ height: 10, marginBottom: 20 }}>
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(imp.improved_pct, 100)}%`, background: 'var(--gradient-success)' }}
                  />
                </div>
                <div className="flex gap-3 flex-wrap">
                  <div className="info-box info-box-success" style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{toPersianNums(String(imp.improved))}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>بهبود یافته</div>
                  </div>
                  <div className="info-box info-box-danger" style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{toPersianNums(String(imp.declined))}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>افت کرده</div>
                  </div>
                  <div className="info-box info-box-primary" style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{toPersianNums(String(imp.stable))}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>بدون تغییر</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">برای مقایسه به دو دوره نیاز است</div>
              </div>
            )}
          </div>
        </div>

        {/* Tier-2: Absences + Goals + Self-Gap + Decline Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ marginTop: 24 }}>
          {/* Absences */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="◷" /></span>
                غیبت‌ها (سال جاری)
              </div>
              <span className="badge badge-warning">نرخ {toPersianNums(String(Math.round(data.absences.absence_rate * 1000) / 10))}٪</span>
            </div>
            {data.absences.per_team.length > 0 ? (
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.absences.per_team} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                    <XAxis dataKey="team_name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                    <Tooltip
                      formatter={(v) => [toPersianNums(String(v)) + ' روز', 'غیبت']}
                      contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, fontSize: 12, direction: 'rtl' }}
                    />
                    <Bar dataKey="absence_days" radius={[6, 6, 0, 0]}>
                      {data.absences.per_team.map((_, i) => (
                        <Cell key={i} fill="var(--accent-warning)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-title">غیبتی ثبت نشده — از صفحه «غیبت‌ها» ثبت کنید</div>
              </div>
            )}
          </div>

          {/* Goals achievement */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="◎" /></span>
                تحقق اهداف (دوره)
              </div>
            </div>
            {data.goals_achievement ? (
              <div className="stagger-children">
                <div className="flex items-center gap-4" style={{ marginBottom: 16 }}>
                  <div className="flex-1">
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>میانگین تحقق اهداف</div>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)', lineHeight: 1 }}>
                      {toPersianNums(String(data.goals_achievement.avg_achievement))}٪
                    </span>
                  </div>
                  <div style={{ width: 1, height: 44, background: 'var(--border-secondary)' }} />
                  <div className="flex-1">
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>نرخ تکمیل</div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-success)', lineHeight: 1 }}>
                      {toPersianNums(String(data.goals_achievement.completion_rate))}٪
                    </span>
                  </div>
                </div>
                <div className="progress-track" style={{ height: 10, marginBottom: 16 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(data.goals_achievement.avg_achievement, 100)}%`, background: 'var(--gradient-primary)' }} />
                </div>
                <div className="flex gap-3">
                  <div className="info-box info-box-success" style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{toPersianNums(String(data.goals_achievement.completed))}</div>
                    <div style={{ fontSize: '0.62rem', opacity: 0.85 }}>تکمیل‌شده</div>
                  </div>
                  <div className="info-box info-box-primary" style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{toPersianNums(String(data.goals_achievement.total_goals))}</div>
                    <div style={{ fontSize: '0.62rem', opacity: 0.85 }}>کل اهداف</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">🎯</div>
                <div className="empty-state-title">برای این دوره هدفی تعریف نشده</div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ marginTop: 24 }}>
          {/* Self-eval vs manager gap */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="◉" /></span>
                فاصله خودارزیابی و نمره مدیر
              </div>
              {data.self_gap && (
                <span className={`badge ${data.self_gap.avg_gap > 5 ? 'badge-warning' : data.self_gap.avg_gap < -5 ? 'badge-danger' : 'badge-success'}`}>
                  میانگین فاصله {toPersianNums(String(data.self_gap.avg_gap))}
                </span>
              )}
            </div>
            {data.self_gap && data.self_gap.count > 0 ? (
              <>
                {data.self_gap.per_employee.length > 0 && (
                  <div style={{ width: '100%', height: 170 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.self_gap.per_employee} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                        <XAxis dataKey="employee_name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                        <Tooltip
                          formatter={(v, name) => [toPersianNums(String(v)), name === 'self_score' ? 'خودارزیابی' : 'نمره مدیر']}
                          contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, fontSize: 12, direction: 'rtl' }}
                        />
                        <Legend formatter={() => ''} wrapperStyle={{ display: 'none' }} />
                        <Bar dataKey="manager_score" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="self_score" fill="var(--accent-success)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                  {toPersianNums(String(data.self_gap.count))} نفر خودارزیابی ثبت کرده‌اند — فاصله مثبت یعنی خودارزیابی بالاتر از نمره مدیر است.
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">🪞</div>
                <div className="empty-state-title">خودارزیابی‌ای برای این دوره ثبت نشده</div>
              </div>
            )}
          </div>

          {/* Decline alerts */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="⚠" /></span>
                هشدار افت عملکرد متوالی
              </div>
              <span className="badge badge-danger">{toPersianNums(String(data.decline_alerts.length))} مورد</span>
            </div>
            {data.decline_alerts.length > 0 ? (
              <div className="stagger-children">
                {data.decline_alerts.map((d, i) => (
                  <div key={d.employee_id} className="flex items-center gap-3" style={{ padding: '10px 4px', borderBottom: '1px solid var(--border-secondary)' }}>
                    <span className="badge badge-danger" style={{ minWidth: 26, justifyContent: 'center' }}>{toPersianNums(String(i + 1))}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.employee_name}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>
                        {d.employee_code} · {d.team_name} · {' '}
                        {d.scores.map((s, j) => <span key={j} style={{ fontWeight: 700, color: j === d.scores.length - 1 ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>{toPersianNums(String(s))}{j < d.scores.length - 1 ? ' ← ' : ''}</span>)}
                      </div>
                    </div>
                    <span className={`score-badge ${d.latest_score >= 60 ? 'score-average' : 'score-poor'}`}>{toPersianNums(String(d.latest_score))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">هیچ افت متوالی شناسایی نشد</div>
                <div className="empty-state-desc">کارمندانی که در ۳ دوره متوالی نمره کمتری گرفته‌اند اینجا نمایش داده می‌شوند</div>
              </div>
            )}
          </div>
        </div>

        {/* Top & Bottom Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ marginTop: 24 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="🏅" /></span>
                برترین‌های دوره
              </div>
            </div>
            {sp && sp.top.length > 0 ? (
              <div className="stagger-children">
                {sp.top.map((p, i) => (
                  <div key={p.employee_id} className="flex items-center gap-3" style={{ padding: '8px 4px', borderBottom: '1px solid var(--border-secondary)' }}>
                    <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', minWidth: 26, justifyContent: 'center' }}>
                      {toPersianNums(String(i + 1))}
                    </span>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.employee_name}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{p.employee_code} · {p.team_name}</div>
                    </div>
                    <span className={`score-badge ${scoreClass(p.score)}`}>{toPersianNums(String(p.score))}</span>
                  </div>
                ))}
              </div>
            ) : (                <div className="empty-state">
                <div className="empty-state-icon" style={{ color: 'var(--accent-primary)', opacity: 0.4 }}><HeadIcon glyph="🏅" size={40} /></div>
                <div className="empty-state-title">داده‌ای نیست</div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="⚠" /></span>
                نیازمند بهبود
              </div>
            </div>
            {sp && sp.bottom.length > 0 ? (
              <div className="stagger-children">
                {sp.bottom.map((p, i) => (
                  <div key={p.employee_id} className="flex items-center gap-3" style={{ padding: '8px 4px', borderBottom: '1px solid var(--border-secondary)' }}>
                    <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', minWidth: 26, justifyContent: 'center' }}>
                      {toPersianNums(String(i + 1))}
                    </span>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.employee_name}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{p.employee_code} · {p.team_name}</div>
                    </div>
                    <span className={`score-badge ${scoreClass(p.score)}`}>{toPersianNums(String(p.score))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">✨</div>
                <div className="empty-state-title">همه عملکرد خوبی دارند</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}