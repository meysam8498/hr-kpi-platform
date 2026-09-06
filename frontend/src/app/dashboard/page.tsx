'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, IdCard, Users, Search, BellRing, CheckCircle2 } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { teamsApi, employeesApi, kpiApi, notificationsApi } from '@/lib/api'
import type { Team, Employee, ReportingPeriod } from '@/lib/api'
import { gregorianToJalaliStr, toPersianNums } from '@/lib/jalali'
import { Avatar, CountUp, EmptyState, TableSkeleton, CardsSkeleton } from '@/components/ui'

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [activePeriod, setActivePeriod] = useState<ReportingPeriod | null>(null)
  const [companyAvg, setCompanyAvg] = useState(0)
  const [loading, setLoading] = useState(true)
  const [remindState, setRemindState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [remindMsg, setRemindMsg] = useState('')

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
              {activePeriod && (
                <div
                  style={{
                    marginTop: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 14px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    fontSize: '0.72rem',
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
                    marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
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
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(80,201,144,0.18)', border: '1px solid rgba(80,201,144,0.35)', color: '#fff', fontSize: '0.72rem' }}>
                  <CheckCircle2 size={13} /> {remindMsg}
                </div>
              )}
              {remindMsg && remindState !== 'done' && (
                <div style={{ marginTop: 8, fontSize: '0.68rem', opacity: 0.85 }}>{remindMsg}</div>
              )}
            </div>

            <ClockChip />
          </div>
        </div>

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
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>کد</th>
                      <th>نام</th>
                      <th>سمت</th>
                      <th>تیم</th>
                      <th>تاریخ استخدام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const fullName = `${emp.first_name} ${emp.last_name}`
                      return (
                        <tr key={emp.id}>
                          <td>
                            <span
                              className="badge badge-info"
                              style={{ fontFamily: "'Vazirmatn', monospace", fontSize: '0.65rem' }}
                            >
                              {emp.employee_code}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={fullName} size={32} />
                              <span style={{ fontWeight: 600 }}>{fullName}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{emp.position}</td>
                          <td>
                            <span className="badge badge-primary">{emp.team_name || '—'}</span>
                          </td>
                          <td style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                            {toPersianNums(gregorianToJalaliStr(emp.hire_date))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
