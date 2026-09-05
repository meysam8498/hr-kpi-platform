'use client'

import { useEffect, useState } from 'react'
import HeadIcon from '@/components/HeadIcon'
import AppLayout from '@/components/Layout'
import { teamsApi, employeesApi, kpiApi, goalsApi } from '@/lib/api'
import type { Team, Employee, ReportingPeriod, Goal } from '@/lib/api'
import { toPersianNums } from '@/lib/jalali'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export default function ReportsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [selectedTeam, setSelectedTeam] = useState<number>(0)
  const [selectedPeriod, setSelectedPeriod] = useState<number>(0)
  const [selectedEmp, setSelectedEmp] = useState<number>(0)
  const [teamReport, setTeamReport] = useState<any>(null)
  const [empResults, setEmpResults] = useState<any[]>([])
  const [empGoals, setEmpGoals] = useState<Goal[]>([])
  const [view, setView] = useState<'team' | 'employee'>('team')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([teamsApi.list(), employeesApi.list(), kpiApi.listPeriods()]).then(([t, e, p]) => {
      setTeams(t); setEmployees(e); setPeriods(p)
      const active = p.find(x => x.is_active)
      if (active) setSelectedPeriod(active.id)
      if (t.length > 0) setSelectedTeam(t[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const loadTeamReport = async () => {
    if (!selectedTeam || !selectedPeriod) return
    try {
      await kpiApi.calculateTeam(selectedTeam, selectedPeriod)
      const report = await kpiApi.teamReport(selectedTeam, selectedPeriod)
      setTeamReport(report)
    } catch { setTeamReport(null) }
  }

  const loadEmpReport = async () => {
    if (!selectedEmp) { setEmpResults([]); setEmpGoals([]); return }
    try {
      const [r, g] = await Promise.all([
        kpiApi.employeeResults(selectedEmp),
        goalsApi.list(selectedEmp),
      ])
      setEmpResults(r as any[])
      setEmpGoals(g)
    } catch { setEmpResults([]); setEmpGoals([]) }
  }

  useEffect(() => {
    if (view === 'team') loadTeamReport(); else loadEmpReport()
  }, [view, selectedTeam, selectedPeriod, selectedEmp]) // eslint-disable-line react-hooks/exhaustive-deps

  const historyData = empResults
    .slice()
    .sort((a, b) => new Date(a.calculated_at).getTime() - new Date(b.calculated_at).getTime())
    .map(r => ({ name: r.period_name, score: r.final_score }))

  const printView = () => window.print()

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="print-area animate-fadeIn">
        <div className="page-header no-print">
          <div>
            <h1 className="page-title">گزارش‌ها</h1>
            <p className="page-subtitle">گزارش عملکرد تیمی و فردی — قابل چاپ و ذخیره به صورت PDF</p>
          </div>
          <button className="btn btn-outline" onClick={printView}>🖨 چاپ / PDF</button>
        </div>

        {/* View Toggle */}
        <div className="no-print flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', marginBottom: 16 }}>
          <button
            onClick={() => setView('team')}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
            style={{ background: view === 'team' ? 'var(--accent-primary)' : 'transparent', color: view === 'team' ? 'white' : 'var(--text-secondary)' }}
          >
            گزارش تیمی
          </button>
          <button
            onClick={() => setView('employee')}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
            style={{ background: view === 'employee' ? 'var(--accent-primary)' : 'transparent', color: view === 'employee' ? 'white' : 'var(--text-secondary)' }}
          >
            گزارش فردی
          </button>
        </div>

        {/* Filters */}
        <div className="no-print card" style={{ padding: 16, marginBottom: 20 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            {view === 'team' ? (
              <div>
                <label className="form-label">تیم</label>
                <select className="form-input" value={selectedTeam} onChange={e => setSelectedTeam(Number(e.target.value))}>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="form-label">کارمند</label>
                <select className="form-input" value={selectedEmp} onChange={e => setSelectedEmp(Number(e.target.value))}>
                  <option value={0}>انتخاب کارمند</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.employee_code} — {e.first_name} {e.last_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="form-label">دوره</label>
              <select className="form-input" value={selectedPeriod} onChange={e => setSelectedPeriod(Number(e.target.value))}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Team Report */}
        {view === 'team' && teamReport && (
          <div className="card" style={{ padding: 24 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="▣" /></span>
                گزارش تیم «{teamReport.team_name}»
              </div>
              <span className="badge badge-primary">{teamReport.period_name}</span>
            </div>
            <div className="grid grid-cols-3 gap-4" style={{ margin: '16px 0' }}>
              <div className="info-box info-box-primary" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{toPersianNums(String(teamReport.avg_score ?? 0))}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>میانگین تیم</div>
              </div>
              <div className="info-box info-box-success" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{toPersianNums(String(teamReport.member_count ?? 0))}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>تعداد اعضا</div>
              </div>
              <div className="info-box info-box-warning" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{toPersianNums(String((teamReport.members || []).length))}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>ارزیابی‌شده</div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {(teamReport.members || []).map((m: any) => (
                <div key={m.employee_id} className="flex items-center gap-3" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-tertiary)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{m.employee_name}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{m.employee_code}</div>
                  </div>
                  <div className="progress-track" style={{ flex: 2 }}>
                    <div className="progress-fill" style={{ width: `${Math.min(m.final_score, 100)}%`, background: m.final_score >= 80 ? 'var(--gradient-success)' : m.final_score >= 60 ? 'var(--gradient-primary)' : 'var(--gradient-danger)' }} />
                  </div>
                  <span className={`score-badge ${m.final_score >= 80 ? 'score-excellent' : m.final_score >= 60 ? 'score-good' : 'score-poor'}`} style={{ minWidth: 56 }}>
                    {toPersianNums(String(m.final_score))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employee Report */}
        {view === 'employee' && (
          <div className="flex flex-col gap-6">
            {selectedEmp === 0 ? (
              <div className="card empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">👤</div>
                <div className="empty-state-title">یک کارمند را انتخاب کنید</div>
              </div>
            ) : empResults.length === 0 ? (
              <div className="card empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon"><HeadIcon glyph="📋" /></div>
                <div className="empty-state-title">هنوز امتیازی برای این کارمند ثبت نشده</div>
              </div>
            ) : (
              <>
                <div className="card" style={{ padding: 24 }}>
                  <div className="card-header">
                    <div className="card-header-title">
                      <span className="card-header-icon"><HeadIcon glyph="◐" /></span>
                      روند نمرات در طول زمان
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 220, marginTop: 12 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 11) + '…' : v)} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                        <Tooltip
                          formatter={(v) => [toPersianNums(String(v)), 'نمره نهایی']}
                          contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, fontSize: 12, direction: 'rtl' }}
                        />
                        <Line type="monotone" dataKey="score" stroke="var(--accent-primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {empGoals.length > 0 && (
                  <div className="card" style={{ padding: 24 }}>
                    <div className="card-header">
                      <div className="card-header-title">
                        <span className="card-header-icon"><HeadIcon glyph="◎" /></span>
                        تحقق اهداف
                      </div>
                      <span className="badge badge-success">
                        میانگین {toPersianNums(String(Math.round(empGoals.reduce((s, g) => s + g.achievement_pct, 0) / empGoals.length * 10) / 10))}٪
                      </span>
                    </div>
                    <div className="flex flex-col gap-3" style={{ marginTop: 14 }}>
                      {empGoals.map(g => (
                        <div key={g.id}>
                          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {g.title} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({g.period_name})</span>
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              {toPersianNums(String(g.current_value))} از {toPersianNums(String(g.target_value))} {g.unit || ''} — {toPersianNums(String(g.achievement_pct))}٪
                            </span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${Math.min(g.achievement_pct, 100)}%`, background: g.achievement_pct >= 100 ? 'var(--gradient-success)' : 'var(--gradient-primary)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card" style={{ padding: 24 }}>
                  <div className="card-header">
                    <div className="card-header-title">
                      <span className="card-header-icon"><HeadIcon glyph="📋" /></span>
                      جزئیات دوره‌ها
                    </div>
                  </div>
                  <div className="flex flex-col gap-3" style={{ marginTop: 14 }}>
                    {empResults.slice().sort((a, b) => new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime()).map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg-tertiary)' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.period_name}</div>
                          {r.breakdown && (() => {
                            const bd = r.breakdown as Record<string, any>
                            const blend = bd.blend as Record<string, any> | undefined
                            return (
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                {blend ? (
                                  <>
                                    نمره مدیر: {toPersianNums(String(blend.base_score))} · {' '}
                                    {blend.peer_count > 0 ? `ارزیابی ۳۶۰: ${toPersianNums(String(blend.peer_score))}` : 'بدون ارزیابی ۳۶۰'} · {' '}
                                    {blend.goal_count > 0 ? `اهداف: ${toPersianNums(String(blend.goal_achievement))}٪` : 'بدون هدف'}
                                  </>
                                ) : (
                                  (bd.criteria || []).slice(0, 4).map((c: any) => `${c.criterion_name}: ${toPersianNums(String(Math.round(c.score * 10) / 10))}`).join(' · ')
                                )}
                              </div>
                            )
                          })()}
                        </div>
                        <span className={`score-badge ${r.final_score >= 80 ? 'score-excellent' : r.final_score >= 60 ? 'score-good' : 'score-poor'}`}>
                          {toPersianNums(String(r.final_score))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}