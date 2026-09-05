'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, IdCard, Users } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { teamsApi, employeesApi, kpiApi } from '@/lib/api'
import type { Team, Employee, ReportingPeriod } from '@/lib/api'
import { gregorianToJalaliStr, toPersianNums } from '@/lib/jalali'

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [activePeriod, setActivePeriod] = useState<ReportingPeriod | null>(null)
  const [companyAvg, setCompanyAvg] = useState(0)
  const [loading, setLoading] = useState(true)

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

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    </AppLayout>
  )

  const activePeriods = periods.filter(p => !p.is_archived)

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">داشبورد شرکت</h1>
          <p className="page-subtitle">نمای کلی عملکرد تیم‌ها و کارمندان</p>
        </div>

        {/* Period Selector */}
        {activePeriods.length > 0 && (
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children" style={{ marginBottom: 24 }}>
          <div className="stat-card" style={{ background: 'var(--gradient-primary)' }}>
            <div className="stat-card-label">کارمندان فعال</div>
            <div className="stat-card-value">{toPersianNums(String(employees.length))}</div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-success)' }}>
            <div className="stat-card-label">میانگین شرکت</div>
            <div className="stat-card-value">
              {toPersianNums(companyAvg.toFixed(1))}
              <span className="stat-card-suffix">/ ۱۰۰</span>
            </div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-info)' }}>
            <div className="stat-card-label">تیم‌ها</div>
            <div className="stat-card-value">{toPersianNums(String(teams.length))}</div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-warning)' }}>
            <div className="stat-card-label">دوره فعال</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.4, marginTop: 4 }}>
              {activePeriod?.name || '—'}
            </div>
          </div>
        </div>

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
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <span
                          className="badge badge-info"
                          style={{ fontFamily: "'Vazirmatn', monospace", fontSize: '0.65rem' }}
                        >
                          {emp.employee_code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{emp.position}</td>
                      <td>
                        <span className="badge badge-primary">{emp.team_name || '—'}</span>
                      </td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                        {toPersianNums(gregorianToJalaliStr(emp.hire_date))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
