'use client'

import { useEffect, useState } from 'react'
import HeadIcon from '@/components/HeadIcon'
import AppLayout from '@/components/Layout'
import { teamsApi, employeesApi, kpiApi, goalsApi } from '@/lib/api'
import type { Team, Employee, ReportingPeriod, Goal } from '@/lib/api'
import { toPersianNums } from '@/lib/jalali'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, RadialBarChart, RadialBar, PolarAngleAxis, RadarChart, PolarGrid, PolarRadiusAxis, Radar } from 'recharts'
import { Printer, UserRound, ClipboardList, PieChart, ListChecks } from 'lucide-react'
import { ScorePill, EmptyState, Avatar, TableSkeleton } from '@/components/ui'

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

  // Latest period's per-criterion scores for the radar chart
  const latestBreakdownCriteria: { name: string; score: number }[] = (() => {
    if (empResults.length === 0) return []
    const latest = empResults
      .slice()
      .sort((a, b) => new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime())[0]
    const bd = latest?.breakdown as Record<string, any> | null | undefined
    const list = (bd?.criteria || []) as any[]
    return list.map((c) => ({
      name: String(c.criterion_name || '').slice(0, 18),
      score: Number(c.score) || 0,
    }))
  })()

  const printView = () => window.print()

  if (loading) return (
    <AppLayout>
      <div className="animate-fadeIn" style={{ padding: '8px 0' }}>
        <TableSkeleton rows={7} cols={4} />
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
          <button className="btn btn-outline" onClick={printView}><Printer size={15} /> چاپ / PDF</button>
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
                  <Avatar name={m.employee_name} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{m.employee_name}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{m.employee_code}</div>
                  </div>
                  <div className="progress-track" style={{ flex: 2 }}>
                    <div className="progress-fill" style={{ width: `${Math.min(m.final_score, 100)}%`, background: m.final_score >= 80 ? 'var(--gradient-success)' : m.final_score >= 60 ? 'var(--gradient-primary)' : 'var(--gradient-danger)' }} />
                  </div>
                  <ScorePill score={m.final_score} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employee Report */}
        {view === 'employee' && (
          <div className="flex flex-col gap-6">
            {selectedEmp === 0 ? (
              <div className="card">
                <EmptyState
                  icon={UserRound}
                  title="یک کارمند را انتخاب کنید"
                  description="گزارش فردی شامل روند نمرات، رادار معیارها و اهداف نمایش داده می‌شود"
                />
              </div>
            ) : empResults.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={ClipboardList}
                  title="هنوز امتیازی برای این کارمند ثبت نشده"
                  description="از صفحه امتیازدهی می‌توانید نمرات این کارمند را وارد کنید"
                />
              </div>
            ) : (
              <>
                {/* Latest score gauge + trend side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>آخرین نمره نهایی</div>
                    <div style={{ width: 170, height: 170 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          innerRadius="68%"
                          outerRadius="100%"
                          data={[{ name: 'score', value: historyData[historyData.length - 1]?.score ?? 0, fill: 'var(--accent-primary)' }]}
                          startAngle={90}
                          endAngle={-270}
                        >
                          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                          <RadialBar background={{ fill: 'var(--bg-tertiary)' }} dataKey="value" cornerRadius={12} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: -118, marginBottom: 74, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {toPersianNums((historyData[historyData.length - 1]?.score ?? 0).toFixed(1))}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>از ۱۰۰</div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 card" style={{ padding: 24 }}>
                  <div className="card-header">
                    <div className="card-header-title">
                      <span className="card-header-icon"><PieChart size={14} /></span>
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
                          formatter={(v) => [toPersianNums(Number(v).toFixed(1)), 'نمره نهایی']}
                          contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, fontSize: 12, direction: 'rtl' }}
                        />
                        <Line type="monotone" dataKey="score" stroke="var(--accent-primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  </div>
                </div>

                {/* Criteria radar — strengths/weaknesses profile */}
                {latestBreakdownCriteria.length >= 3 && (
                  <div className="card" style={{ padding: 24 }}>
                    <div className="card-header">
                      <div className="card-header-title">
                        <span className="card-header-icon"><ListChecks size={14} /></span>
                        پروفایل معیارها (رادار)
                      </div>
                    </div>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={latestBreakdownCriteria} outerRadius="72%">
                          <PolarGrid stroke="var(--border-secondary)" />
                          <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar dataKey="score" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.25} strokeWidth={2} />
                          <Tooltip
                            formatter={(v) => [toPersianNums(Number(v).toFixed(1)), 'نمره']}
                            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, fontSize: 12, direction: 'rtl' }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

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
                      <span className="card-header-icon"><ListChecks size={14} /></span>
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
                        <ScorePill score={r.final_score} />
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