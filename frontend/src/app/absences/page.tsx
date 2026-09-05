'use client'

import { useEffect, useState } from 'react'
import { CalendarX, Building2, ClipboardList } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { absencesApi, employeesApi, teamsApi } from '@/lib/api'
import type { Absence, AbsenceSummary, Employee, Team } from '@/lib/api'
import { jalaliDisplay, jalaliToGregorianStr, toPersianNums } from '@/lib/jalali'

export default function AbsencesPage() {
  const [records, setRecords] = useState<Absence[]>([])
  const [summary, setSummary] = useState<AbsenceSummary | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [teamId, setTeamId] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)

  const [fEmp, setFEmp] = useState<number | ''>('')
  const [fDate, setFDate] = useState('')
  const [fReason, setFReason] = useState('')
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      absencesApi.list(), absencesApi.summary(),
      teamsApi.list(), employeesApi.listAll(),
    ]).then(([r, s, t, e]) => {
      setRecords(r)
      setSummary(s)
      setTeams(t)
      setEmployees(e.filter(emp => !emp.is_archived))
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEmployees = teamId === '' ? employees : employees.filter(e => e.team_id === teamId)

  const addAbsence = async () => {
    if (!fEmp || !fDate) {
      setFormMsg({ type: 'err', text: 'کارمند و تاریخ الزامی است' })
      return
    }
    try {
      await absencesApi.create({
        employee_id: Number(fEmp),
        absence_date: jalaliToGregorianStr(fDate),
        reason: fReason || undefined,
      })
      setFormMsg({ type: 'ok', text: 'غیبت ثبت شد' })
      setFDate(''); setFReason('')
      load()
    } catch (e: any) {
      setFormMsg({ type: 'err', text: e.detail || e.message || 'خطا در ثبت غیبت' })
    }
  }

  const remove = async (id: number) => {
    await absencesApi.delete(id)
    load()
  }

  const maxTeamDays = summary && summary.per_team.length > 0 ? Math.max(...summary.per_team.map(t => t.absence_days), 1) : 1

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="page-header">
          <div>
            <h1 className="page-title">غیبت‌ها</h1>
            <p className="page-subtitle">ثبت روزهای غیبت کارمندان — ورودی شاخص نرخ غیبت در داشبورد منابع انسانی</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 24 }}>
          <div className="stat-card" style={{ background: 'var(--gradient-danger)' }}>
            <div className="stat-card-label">مجموع روزهای غیبت</div>
            <div className="stat-card-value">{toPersianNums(String(summary?.total_absence_days ?? 0))}<span className="stat-card-suffix">روز</span></div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-warning)' }}>
            <div className="stat-card-label">نرخ غیبت (سال جاری)</div>
            <div className="stat-card-value">{toPersianNums(String(summary ? Math.round(summary.absence_rate * 1000) / 10 : 0))}٪</div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-info)' }}>
            <div className="stat-card-label">روزهای کاری محاسبه‌شده</div>
            <div className="stat-card-value">{toPersianNums(String(summary?.workdays ?? 0))}</div>
          </div>
          <div className="stat-card" style={{ background: 'var(--gradient-primary)' }}>
            <div className="stat-card-label">رکوردهای ثبت‌شده</div>
            <div className="stat-card-value">{toPersianNums(String(records.length))}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="card" style={{ padding: 20, alignSelf: 'start' }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><CalendarX size={14} /></span>
                ثبت غیبت
              </div>
            </div>
            <div className="flex flex-col gap-3" style={{ marginTop: 14 }}>
              <div>
                <label className="form-label">تیم</label>
                <select className="form-input" value={teamId} onChange={e => setTeamId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">همه تیم‌ها</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">کارمند</label>
                <select className="form-input" value={fEmp} onChange={e => setFEmp(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">انتخاب کنید</option>
                  {filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">تاریخ غیبت (شمسی)</label>
                <input className="form-input" value={fDate} onChange={e => setFDate(e.target.value)} placeholder="۱۴۰۴-۰۶-۱۵" />
              </div>
              <div>
                <label className="form-label">دلیل (اختیاری)</label>
                <input className="form-input" value={fReason} onChange={e => setFReason(e.target.value)} placeholder="مرخصی، بیماری، مأموریت…" />
              </div>
              {formMsg && (
                <div className={formMsg.type === 'ok' ? 'info-box info-box-success' : 'info-box info-box-danger'}>
                  {formMsg.text}
                </div>
              )}
              <button className="btn btn-primary" onClick={addAbsence}>ثبت غیبت</button>
            </div>
          </div>

          {/* Records + team breakdown */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Team breakdown */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-header">
                <div className="card-header-title">
                  <span className="card-header-icon"><Building2 size={14} /></span>
                  غیبت به تفکیک تیم
                </div>
              </div>
              {summary && summary.per_team.length > 0 ? (
                <div className="stagger-children">
                  {summary.per_team.map(t => (
                    <div key={t.team_id} style={{ marginBottom: 12 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.team_name}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {toPersianNums(String(t.absence_days))} روز
                        </span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${(t.absence_days / maxTeamDays) * 100}%`, background: 'var(--gradient-danger)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 16 }}>
                  <div className="empty-state-icon">📅</div>
                  <div className="empty-state-title">غیبتی ثبت نشده</div>
                </div>
              )}
            </div>

            {/* Records */}
            <div className="card" style={{ padding: 8 }}>
              <div className="card-header" style={{ padding: '8px 12px' }}>
                <div className="card-header-title">
                  <span className="card-header-icon"><ClipboardList size={14} /></span>
                  رکوردهای غیبت
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center" style={{ padding: 30 }}>
                  <div className="spinner" style={{ width: 24, height: 24 }} />
                </div>
              ) : records.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="empty-state-title">رکوردی نیست</div>
                </div>
              ) : (
                records.slice(0, 40).map(r => (
                  <div key={r.id} className="flex items-center gap-3" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-secondary)' }}>
                    <span className="badge" style={{ background: 'var(--accent-danger-subtle)', color: 'var(--accent-danger)' }}>غیبت</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.employee_name}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{r.employee_code} · {r.team_name}{r.reason ? ` · ${r.reason}` : ''}</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{jalaliDisplay(r.absence_date)}</span>
                    <button className="btn-icon btn-icon-danger" onClick={() => remove(r.id)}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}