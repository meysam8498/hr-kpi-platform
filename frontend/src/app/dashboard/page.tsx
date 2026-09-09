'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, IdCard, Users, Search, BellRing, CheckCircle2, ClipboardPen, Star, ArrowLeft, Megaphone, ClipboardCheck, Target } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { teamsApi, employeesApi, kpiApi, notificationsApi, dashboardApi } from '@/lib/api'
import type { Team, Employee, ReportingPeriod, MyTasksPayload, MyTask } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { gregorianToJalaliStr, toPersianNums } from '@/lib/jalali'
import { Avatar, CountUp, EmptyState, TableSkeleton, CardsSkeleton } from '@/components/ui'
import DataTable from '@/components/DataTable'
import Sparkline from '@/components/Sparkline'

const TASK_ICON: Record<MyTask['kind'], typeof ClipboardPen> = {
  self_eval: ClipboardPen,
  peer_review: Users,
  scoring: Star,
}

export default function DashboardPage() {
  const { user: me } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [activePeriod, setActivePeriod] = useState<ReportingPeriod | null>(null)
  const [companyAvg, setCompanyAvg] = useState(0)
  const [loading, setLoading] = useState(true)
  const [remindState, setRemindState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [remindMsg, setRemindMsg] = useState('')
  const [teamTrends, setTeamTrends] = useState<Record<number, number[]>>({})
  const [showAllEmployees, setShowAllEmployees] = useState(false)
  const [myTasks, setMyTasks] = useState<MyTasksPayload | null>(null)
  const PREVIEW_COUNT = 8

  useEffect(() => {
    dashboardApi.myTasks().then(setMyTasks).catch(() => setMyTasks(null))
  }, [])

  const sendReminder = async () => {
    if (!activePeriod || remindState === 'busy') return
    setRemindState('busy')
    try {
      const r = await notificationsApi.remindManagers(activePeriod.id)
      setRemindMsg(r.message)
      setRemindState(r.created > 0 ? 'done' : 'idle')
    } catch {
      setRemindMsg('خطا در ارسال یادآوری')
      setRemindState('idle')
    }
  }

  useEffect(() => {
    Promise.all([
      teamsApi.list(),
      employeesApi.list(),
      kpiApi.listPeriods(),
    ]).then(([t, e, p]) => {
      setTeams(t)
      setEmployees(e)
      setPeriods(p)
      const active = p.find(x => x.is_active && !x.is_archived) || p.find(x => !x.is_archived)
      setActivePeriod(active || null)
      if (active) {
        kpiApi.calculateCompany(active.id)
          .then((r: any) => setCompanyAvg(r.company_avg || 0))
          .catch(() => {})
      }
      // Per-team trend sparklines (last 5 non-archived periods)
      kpiApi.listPeriods().then(async ps => {
        const usable = ps.filter(p => !p.is_archived).slice(-5)
        const trends: Record<number, number[]> = {}
        await Promise.all(usable.map(async period => {
          await Promise.all(teams.map(async team => {
            try {
              const res = await kpiApi.calculateTeam(team.id, period.id) as any
              const scores = (res?.results || []).map((r: any) => Number(r.final_score ?? 0))
              if (scores.length) {
                const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length
                ;(trends[team.id] ||= []).push(Math.round(avg * 10) / 10)
              }
            } catch {}
          }))
        }))
        setTeamTrends(trends)
      }).catch(() => {})
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const changePeriod = async (periodId: number) => {
    const p = periods.find(x => x.id === periodId)
    if (p) {
      setActivePeriod(p)
      try {
        const r = await kpiApi.calculateCompany(p.id) as any
        setCompanyAvg(r.company_avg || 0)
      } catch {}
    }
  }

  const activePeriods = periods.filter(p => !p.is_archived)

  // Greeting by time of day
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'صبح بخیر' : hour < 17 ? 'ظهر بخیر' : 'عصر بخیر'

  return (
    <AppLayout>
      <div>
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">داشبورد شرکت</h1>
            <p className="page-subtitle">نمای کلی عملکرد تیم‌ها و کارمندان</p>
          </div>
        </div>

        {/* Hero band — aurora + clock */}
        <div className="hero-band">
          <div className="hero-texture" />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div className="hero-greeting">
                {greeting} 👋
              </div>
              <div className="hero-sub">
                امروز آماده‌ای عملکرد تیم‌ها را بررسی کنیم؟
              </div>
              {(activePeriod || remindMsg) && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  {activePeriod && (
                    <div
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 14px', borderRadius: 20,
                        background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)',
                        fontSize: '0.72rem', whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#50c990', animation: 'pulse 2s ease-in-out infinite' }} />
                      دوره فعال: <strong>{activePeriod.name}</strong>
                    </div>
                  )}
                  {activePeriod && remindState !== 'done' && (
                    <button
                      onClick={sendReminder}
                      disabled={remindState === 'busy'}
                      title="اعلانی در پنل ثبت می‌شود که تیم‌های بدون امتیاز را نام می‌برد"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                        padding: '6px 14px', borderRadius: 20,
                        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', fontSize: '0.72rem', cursor: 'pointer',
                        opacity: remindState === 'busy' ? 0.6 : 1,
                      }}
                    >
                      <BellRing size={13} />
                      {remindState === 'busy' ? 'در حال ارسال...' : 'یادآوری به مدیران تیم‌های بدون امتیاز'}
                    </button>
                  )}
                  {remindState === 'done' && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(80,201,144,0.18)', border: '1px solid rgba(80,201,144,0.35)', color: '#fff', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      <CheckCircle2 size={13} /> {remindMsg}
                    </div>
                  )}
                  {remindMsg && remindState !== 'done' && (
                    <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>{remindMsg}</div>
                  )}
                </div>
              )}
            </div>

            <ClockChip />
          </div>
        </div>

        {/* ─── My Tasks / Own Report (role-aware, everyone sees this) ─── */}
        {myTasks && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ marginTop: 24 }}>
            {/* Tasks column */}
            <div className="lg:col-span-2 card" style={{ padding: 20 }}>
              <div className="card-header">
                <div className="card-header-title">
                  <span className="card-header-icon"><ClipboardCheck size={14} /></span>
                  کارهای من
                  {myTasks.period && (
                    <span className="badge badge-info" style={{ marginRight: 8 }}>
                      دوره: {myTasks.period.name}
                    </span>
                  )}
                </div>
              </div>
              {myTasks.tasks.length === 0 ? (
                <div>
                  <div className="flex items-center gap-3" style={{ padding: '10px 0' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(80,201,144,0.14)', color: 'var(--accent-success)',
                    }}>
                      <CheckCircle2 size={19} />
                    </span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        همه کارهای این دوره انجام شده 🎉
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {myTasks.period
                          ? `فعالیت شما در دوره «${myTasks.period.name}» در خلاصه کنار دیده می‌شود.`
                          : 'در حال حاضر دوره فعالی وجود ندارد.'}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{
                      marginTop: 8, padding: '10px 14px', borderRadius: 10,
                      background: 'var(--surface-2)', border: '1px dashed var(--border-primary)',
                      fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.9,
                    }}
                  >
                    <Megaphone size={14} style={{ flexShrink: 0, color: 'var(--accent-info)' }} />
                    {myTasks.hr_notice}
                  </div>
                </div>
              ) : (
                <div className="stagger-children">
                  {myTasks.tasks.map(t => {
                    const Icon = TASK_ICON[t.kind] || ClipboardPen
                    return (
                      <Link
                        key={t.kind + t.title}
                        href={t.href}
                        className="flex items-center gap-3"
                        style={{
                          padding: '12px 14px', borderRadius: 12, marginBottom: 6,
                          border: '1px solid var(--border-primary)', background: 'var(--surface-2)',
                          transition: 'transform 0.15s ease, border-color 0.15s ease',
                        }}
                      >
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          background: 'var(--gradient-primary)', color: '#fff',
                        }}>
                          <Icon size={18} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {t.title}
                            {t.names.length > 0 && (
                              <span style={{ fontWeight: 400, fontSize: '0.7rem', color: 'var(--text-tertiary)', marginRight: 8 }}>
                                {t.names.slice(0, 3).join('، ')}{t.names.length > 3 ? ' و…' : ''}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {t.description}
                          </div>
                        </div>
                        <span className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                          انجام <ArrowLeft size={12} />
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Own-period summary column */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header">
                <div className="card-header-title">
                  <span className="card-header-icon"><Target size={14} /></span>
                  خلاصه دوره شما
                </div>
              </div>
              {myTasks.own_report ? (
                <div className="space-y-2.5" style={{ marginTop: 6 }}>
                  <div className="flex items-center justify-between" style={{ fontSize: '0.76rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>خودارزیابی</span>
                    {myTasks.own_report.self_eval.submitted ? (
                      <span className="badge badge-success">ثبت شد · {toPersianNums(String(Math.round(myTasks.own_report.self_eval.self_score ?? 0)))}</span>
                    ) : (
                      <span className="badge badge-warning">ثبت نشده</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between" style={{ fontSize: '0.76rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>ارزیابی ۳۶۰ ثبت‌شده</span>
                    <span className="badge badge-primary">{toPersianNums(String(myTasks.own_report.peer_reviews_given))}</span>
                  </div>
                  <div className="flex items-center justify-between" style={{ fontSize: '0.76rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>اهداف فعال</span>
                    <span className="badge badge-info">{toPersianNums(String(myTasks.own_report.active_goals))}</span>
                  </div>
                  {myTasks.own_report.peer_reviewees.length > 0 && (
                    <div style={{
                      fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.9,
                      padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', marginTop: 4,
                    }}>
                      به این همکاران نمره داده‌اید: {myTasks.own_report.peer_reviewees.join('، ')}
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={ClipboardCheck}
                  title="پرونده کارمندی ندارید"
                  description="حساب شما به پرونده کارمندی متصل نیست؛ فقط وظایف مدیریتی‌تان اینجا دیده می‌شود."
                />
              )}
            </div>
          </div>
        )}

        {/* Period Selector */}
        {activePeriods.length > 1 && (
          <div className="card" style={{ padding: '12px 16px', marginBottom: 24 }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                دوره:
              </span>
              <div className="flex gap-1.5">
                {activePeriods.map(p => (
                  <button
                    key={p.id}
                    onClick={() => changePeriod(p.id)}
                    className="tab"
                    style={{
                      background: activePeriod?.id === p.id ? 'var(--accent-primary)' : 'transparent',
                      color: activePeriod?.id === p.id ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        {loading ? (
          <CardsSkeleton count={4} height={110} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children" style={{ marginBottom: 24 }}>
            <div className="stat-card" style={{ background: 'var(--gradient-primary)' }}>
              <div className="stat-card-label">کارمندان فعال</div>
              <div className="stat-card-value">
                <CountUp value={employees.length} />
              </div>
            </div>
            <div className="stat-card" style={{ background: 'var(--gradient-success)' }}>
              <div className="stat-card-label">میانگین شرکت</div>
              <div className="stat-card-value">
                <CountUp value={companyAvg} decimals={1} />
                <span className="stat-card-suffix">/ ۱۰۰</span>
              </div>
            </div>
            <div className="stat-card" style={{ background: 'var(--gradient-info)' }}>
              <div className="stat-card-label">تیم‌ها</div>
              <div className="stat-card-value">
                <CountUp value={teams.length} />
              </div>
            </div>
            <div className="stat-card" style={{ background: 'var(--gradient-warning)' }}>
              <div className="stat-card-label">دوره فعال</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.4, marginTop: 4 }}>
                {activePeriod?.name || '—'}
              </div>
            </div>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List — 1 col */}
          <div className="lg:col-span-1 card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><Building2 size={14} /></span>
                تیم‌ها
              </div>
              <Link href="/teams" className="btn btn-ghost btn-sm">مشاهده همه</Link>
            </div>
            {loading ? (
              <TableSkeleton rows={4} cols={2} />
            ) : teams.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="هنوز تیمی ساخته نشده"
                description="اولین تیم خود را بسازید تا کارمندان را سازماندهی کنید."
                action={<Link href="/teams" className="btn btn-primary btn-sm">ساخت تیم</Link>}
              />
            ) : (
              <div className="stagger-children">
                {teams.map(team => (
                  <div
                    key={team.id}
                    className="flex items-center gap-3"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      marginBottom: 4,
                      transition: 'background-color 0.15s ease',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        background: 'linear-gradient(135deg, var(--accent-primary-subtle), rgba(var(--accent-primary-rgb), 0.16))',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      <Building2 size={16} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {team.name}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                        {toPersianNums(String(team.member_count))} عضو
                      </div>
                    </div>
                    {(teamTrends[team.id]?.length ?? 0) >= 2 && (
                      <div title="روند میانگین تیم در دوره‌های اخیر">
                        <Sparkline points={teamTrends[team.id]} width={64} height={20} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Employee Table — 2 cols */}
          <div className="lg:col-span-2 card" style={{ padding: 20 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><IdCard size={14} /></span>
                لیست کارمندان
              </div>
              <Link href="/employees" className="btn btn-ghost btn-sm">مشاهده همه</Link>
              {employees.length > PREVIEW_COUNT && (
                <button
                  onClick={() => setShowAllEmployees(v => !v)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.7rem' }}
                >
                  {showAllEmployees
                    ? `نمایش کمتر`
                    : `نمایش همه (${toPersianNums(String(employees.length))})`}
                </button>
              )}
            </div>
            {loading ? (
              <TableSkeleton rows={6} cols={5} />
            ) : employees.length === 0 ? (
              <EmptyState
                icon={IdCard}
                title="کارمندی ثبت نشده"
                description="برای شروع، کارمندان را اضافه کنید یا از اکسل وارد کنید."
                action={<Link href="/employees" className="btn btn-primary btn-sm">افزودن کارمند</Link>}
              />
            ) : (
              <DataTable
                columns={[
                  { key: 'code', label: 'کد', sortValue: e => e.employee_code, width: 90 },
                  { key: 'name', label: 'نام', sortValue: e => `${e.first_name} ${e.last_name}` },
                  { key: 'position', label: 'سمت', sortValue: e => e.position },
                  { key: 'team', label: 'تیم', sortValue: e => e.team_name || '' },
                  { key: 'hire', label: 'تاریخ استخدام', sortValue: e => e.hire_date },
                ]}
                rows={showAllEmployees ? employees : employees.slice(0, PREVIEW_COUNT)}
                rowKey={e => e.id}
                renderCell={(emp, key) => {
                  const fullName = `${emp.first_name} ${emp.last_name}`
                  if (key === 'code') return (
                    <span className="badge badge-info" style={{ fontFamily: "'Vazirmatn', monospace", fontSize: '0.65rem' }}>
                      {emp.employee_code}
                    </span>
                  )
                  if (key === 'name') return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={fullName} size={32} />
                      <span style={{ fontWeight: 600 }}>{fullName}</span>
                    </div>
                  )
                  if (key === 'position') return <span style={{ color: 'var(--text-secondary)' }}>{emp.position}</span>
                  if (key === 'team') return <span className="badge badge-primary">{emp.team_name || '—'}</span>
                  return <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{toPersianNums(gregorianToJalaliStr(emp.hire_date))}</span>
                }}
                mobileCard={emp => (
                  <div className="flex items-center gap-3">
                    <Avatar name={`${emp.first_name} ${emp.last_name}`} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{emp.first_name} {emp.last_name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                        {emp.position} — {emp.team_name || 'بدون تیم'}
                      </div>
                    </div>
                    <span className="badge badge-info" style={{ fontFamily: "'Vazirmatn', monospace", fontSize: '0.62rem' }}>{emp.employee_code}</span>
                  </div>
                )}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
/* ─── Live Jalali clock chip for the hero ─── */
const PERSIAN_DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']
const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

import { nowJalali, toEnglishNums } from '@/lib/jalali'

function ClockChip() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!now) return <div style={{ width: 130, height: 76 }} />

  const jalali = nowJalali()
  const parts = jalali.split('  🕐  ')
  const dateParts = (parts[0] || '').split('-')
  const y = parseInt(toEnglishNums(dateParts[0]))
  const m = parseInt(toEnglishNums(dateParts[1]))
  const d = parseInt(toEnglishNums(dateParts[2]))
  const monthName = PERSIAN_MONTHS[(m || 1) - 1] || ''
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="hero-clock">
      <div className="hero-clock-time">
        {toPersianNums(pad(now.getHours()))}:{toPersianNums(pad(now.getMinutes()))}
        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>:{toPersianNums(pad(now.getSeconds()))}</span>
      </div>
      <div className="hero-clock-date">
        {PERSIAN_DAYS[now.getDay()]} — {toPersianNums(String(d))} {monthName} {toPersianNums(String(y))}
      </div>
    </div>
  )
}
