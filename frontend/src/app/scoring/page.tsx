'use client'

import { useEffect, useState } from 'react'
import { Star, Sparkles } from 'lucide-react'
import { IdCard as IdCardIcon, Settings as SettingsIcon } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { teamsApi, employeesApi, kpiApi } from '@/lib/api'
import type { Team, Employee, ReportingPeriod, KPICriterion, TeamKPIConfig, KPIEntry } from '@/lib/api'
import { Avatar, EmptyState, TableSkeleton, ScorePill } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { matchesQuery } from '@/components/SearchBox'
import { toPersianNums } from '@/lib/jalali'

export default function ScoringPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [criteria, setCriteria] = useState<KPICriterion[]>([])
  const [teamConfigs, setTeamConfigs] = useState<TeamKPIConfig[]>([])
  const [existingEntries, setExistingEntries] = useState<KPIEntry[]>([])

  const [selectedTeam, setSelectedTeam] = useState<number>(0)
  const [selectedPeriod, setSelectedPeriod] = useState<number>(0)
  const [selectedEmp, setSelectedEmp] = useState<number>(0)
  const [empSearch, setEmpSearch] = useState('')

  const [scores, setScores] = useState<Record<number, number>>({})
  const [comments, setComments] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [kpiResult, setKpiResult] = useState<any>(null)
  const toast = useToast()

  useEffect(() => {
    Promise.all([
      teamsApi.list(),
      employeesApi.list(),
      kpiApi.listPeriods(),
      kpiApi.listCriteria(),
    ]).then(([t, e, p, c]) => {
      setTeams(t); setEmployees(e); setPeriods(p); setCriteria(c)
      const active = p.find(x => x.is_active)
      if (active) setSelectedPeriod(active.id)
      if (t.length > 0) setSelectedTeam(t[0].id)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedTeam) {
      kpiApi.teamConfig(selectedTeam).then(setTeamConfigs)
    }
  }, [selectedTeam])

  useEffect(() => {
    if (selectedEmp && selectedPeriod) {
      kpiApi.listEntries(selectedEmp, selectedPeriod).then(setExistingEntries)
      setKpiResult(null)
    }
  }, [selectedEmp, selectedPeriod])

  useEffect(() => {
    if (existingEntries.length > 0) {
      const prefilled: Record<number, number> = {}
      const prefilledComments: Record<number, string> = {}
      existingEntries.forEach(e => {
        prefilled[e.criterion_id] = e.score
        if (e.comment) prefilledComments[e.criterion_id] = e.comment
      })
      setScores(prefilled)
      setComments(prefilledComments)
    } else {
      setScores({})
      setComments({})
    }
  }, [existingEntries])

  const teamEmployees = employees.filter(e => e.team_id === selectedTeam && !e.is_archived)

  const teamCriteriaDetails = teamConfigs.map(tc => {
    const crit = criteria.find(c => c.id === tc.criterion_id)
    return { ...tc, crit }
  }).filter(tc => tc.crit)

  const totalWeight = teamCriteriaDetails.reduce((sum, c) => sum + c.weight, 0)
  const filledCount = teamCriteriaDetails.filter(tc => scores[tc.criterion_id] !== undefined).length
  const previewScore = teamCriteriaDetails.reduce((sum, tc) => {
    const score = scores[tc.criterion_id] || 0
    return sum + (score * tc.weight / (totalWeight || 100))
  }, 0)

  const handleScoreChange = (criterionId: number, value: string) => {
    const num = value === '' ? undefined : parseFloat(value)
    if (num !== undefined && (num < 0 || num > 100)) return
    setScores(prev => {
      const next = { ...prev }
      if (num === undefined) delete next[criterionId]
      else next[criterionId] = num
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedEmp || !selectedPeriod) return
    setSaving(true)
    try {
      const scoreItems = teamCriteriaDetails.map(tc => ({
        criterion_id: tc.criterion_id,
        score: scores[tc.criterion_id] || 0,
        comment: comments[tc.criterion_id] || undefined,
      })).filter(item => scores[item.criterion_id] !== undefined)

      if (scoreItems.length === 0) {
        toast.warning('حداقل یک نمره وارد کنید')
        return
      }

      await kpiApi.batchScore(selectedEmp, selectedPeriod, scoreItems)

      try {
        const calcResult = await kpiApi.calculateEmployee(selectedEmp, selectedPeriod)
        setKpiResult(calcResult)
      } catch {}

      const emp = employees.find(e => e.id === selectedEmp)
      toast.success(`${scoreItems.length} نمره برای ${emp?.first_name} ${emp?.last_name} ثبت شد`)

      const entries = await kpiApi.listEntries(selectedEmp, selectedPeriod)
      setExistingEntries(entries)
    } catch (err: any) {
      const msg = typeof err.message === 'string' ? err.message : JSON.stringify(err)
      toast.error(msg || 'خطا در ذخیره نمرات')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setScores({}); setComments({}); setKpiResult(null)
  }

  const handleEmployeeChange = (empId: number) => {
    setSelectedEmp(empId); setKpiResult(null)
  }

  if (loading) return (
    <AppLayout>
      <div className="animate-fadeIn" style={{ padding: '8px 0' }}>
        <TableSkeleton rows={5} cols={3} />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        {/* Page Header */}
        <div className="flex items-center justify-between page-header">
          <div className="flex items-center gap-3">
            <span className="card-header-icon" style={{ width: 40, height: 40, borderRadius: 12 }}>
              <Star size={19} />
            </span>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>امتیازدهی دستی</h1>
              <p className="page-subtitle">ثبت مستقیم نمرات KPI برای هر کارمند — بدون نیاز به اکسل</p>
            </div>
          </div>
        </div>

        {/* Selectors */}
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>انتخاب تیم</label>
              <select value={selectedTeam} onChange={e => {
                setSelectedTeam(Number(e.target.value))
                setSelectedEmp(0)
                resetForm()
              }}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>انتخاب دوره</label>
              <select value={selectedPeriod} onChange={e => {
                setSelectedPeriod(Number(e.target.value))
                resetForm()
              }}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name} {p.is_active ? '(فعال)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>انتخاب کارمند</label>
              <input
                placeholder="جستجو: کد یا نام…"
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                style={{ marginBottom: 6, fontSize: '0.78rem' }}
              />
              <select value={selectedEmp} onChange={e => handleEmployeeChange(Number(e.target.value))}>
                <option value={0}>انتخاب کارمند...</option>
                {teamEmployees.filter(emp => matchesQuery([
                  emp.employee_code, emp.first_name, emp.last_name, emp.position,
                ], empSearch)).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.employee_code} — {emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Scoring Form */}
        {selectedEmp > 0 && selectedPeriod > 0 && teamCriteriaDetails.length > 0 && (
          <div className="card animate-slideUp" style={{ padding: 24 }}>
            {/* Form Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  فرم امتیازدهی
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {employees.find(e => e.id === selectedEmp)?.first_name} {employees.find(e => e.id === selectedEmp)?.last_name}
                  {' — '}
                  {periods.find(p => p.id === selectedPeriod)?.name}
                </p>
              </div>
              <div
                className="flex items-center gap-2"
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: 'var(--accent-primary-subtle)',
                  border: '1px solid rgba(var(--accent-primary-rgb), 0.2)',
                }}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>تکمیل:</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {toPersianNums(String(filledCount))}/{toPersianNums(String(teamCriteriaDetails.length))}
                </span>
              </div>
            </div>

            {/* Weight Progress */}
            <div style={{ marginBottom: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>مجموع وزن‌ها</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: totalWeight === 100 ? 'var(--accent-success)' : 'var(--accent-warning)',
                }}>
                  {toPersianNums(String(totalWeight))}%
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(totalWeight, 100)}%`,
                    background: totalWeight === 100 ? 'var(--accent-success)' : 'var(--accent-warning)',
                  }}
                />
              </div>
            </div>

            {/* Score Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {teamCriteriaDetails.map((tc, idx) => {
                const score = scores[tc.criterion_id]
                const hasScore = score !== undefined
                return (
                  <div
                    key={tc.criterion_id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      background: hasScore ? 'var(--accent-primary-subtle)' : 'var(--bg-tertiary)',
                      border: `1.5px solid ${hasScore ? 'var(--accent-primary)' : 'var(--border-secondary)'}`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                            {toPersianNums(String(idx + 1))}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {tc.criterion_name}
                          </span>
                          <span
                            className={`badge ${tc.criterion_category === 'common' ? 'badge-primary' : 'badge-info'}`}
                          >
                            {tc.criterion_category === 'common' ? 'مشترک' : 'تخصصی'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                          وزن: {toPersianNums(String(tc.weight))}%
                        </div>
                      </div>

                      {/* Score Input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={score ?? ''}
                          onChange={e => handleScoreChange(tc.criterion_id, e.target.value)}
                          placeholder="0-100"
                          style={{
                            width: 72,
                            textAlign: 'center',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            padding: '8px 4px',
                          }}
                        />
                        {hasScore && (
                          <ScorePill score={score} size="sm" />
                        )}
                      </div>
                    </div>

                    {/* Comment */}
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="text"
                        value={comments[tc.criterion_id] || ''}
                        onChange={e => setComments(prev => ({ ...prev, [tc.criterion_id]: e.target.value }))}
                        placeholder="نظر اختیاری..."
                        style={{
                          fontSize: '0.75rem',
                          padding: '6px 10px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-secondary)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Preview Score */}
            {filledCount > 0 && (
              <div
                className="flex items-center justify-between"
                style={{
                  marginTop: 20,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'var(--accent-primary-subtle)',
                  border: '1.5px solid rgba(var(--accent-primary-rgb), 0.2)',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>پیش‌نمایش نمره نهایی</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {toPersianNums(previewScore.toFixed(1))}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button
                onClick={handleSave}
                disabled={saving || filledCount === 0}
                className="btn btn-primary btn-lg flex-1 justify-center"
              >
                {saving ? 'در حال ذخیره...' : 'ذخیره نمرات و محاسبه KPI'}
              </button>
              <button onClick={resetForm} className="btn btn-ghost">پاک کردن</button>
            </div>

            {/* Result Message — now via toasts */}

            {/* KPI Result */}
            {kpiResult && (
              <div
                className="animate-slideUp"
                style={{
                  marginTop: 20,
                  padding: 20,
                  borderRadius: 12,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                  <span className="card-header-icon"><Sparkles size={14} /></span>
                  نتیجه محاسبه KPI
                </h3>
                <div className="flex items-center gap-6" style={{ marginBottom: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>نمره نهایی</div>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: 800,
                      color: kpiResult.final_score >= 70 ? 'var(--accent-success)' : kpiResult.final_score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)',
                    }}>
                      {toPersianNums(kpiResult.final_score.toFixed(1))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="progress-track" style={{ height: 10, borderRadius: 5 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(kpiResult.final_score, 100)}%`,
                          borderRadius: 5,
                          background: kpiResult.final_score >= 70 ? 'var(--accent-success)' : kpiResult.final_score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {kpiResult.breakdown?.criteria && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {kpiResult.breakdown.criteria.map((c: any) => (
                      <div key={c.criterion_id} className="flex items-center gap-3" style={{ fontSize: '0.8rem' }}>
                        <span className="flex-1" style={{ color: 'var(--text-secondary)' }}>{c.criterion_name}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>وزن: {c.weight}%</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{toPersianNums(String(c.score))}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>({toPersianNums(String(c.weighted_contribution))})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty States */}
        {selectedEmp === 0 && selectedTeam > 0 && (
          <div className="card" style={{ padding: 20 }}>
            <EmptyState
              icon={IdCardIcon}
              title="یک کارمند انتخاب کنید"
              description="فرم امتیازدهی بر اساس معیارهای تنظیم‌شده تیم نمایش داده می‌شود"
            />
          </div>
        )}

        {selectedTeam > 0 && selectedEmp > 0 && teamCriteriaDetails.length === 0 && (
          <div className="card" style={{ padding: 20 }}>
            <EmptyState
              icon={SettingsIcon}
              title="هیچ معیار KPI تنظیم نشده"
              description="ابتدا از بخش «تنظیمات KPI» معیارها و وزن‌ها را تعیین کنید"
              action={<a href="/admin/config" className="btn btn-primary btn-sm">رفتن به تنظیمات</a>}
            />
          </div>
        )}

        {/* Help Box */}
        <div className="info-box info-box-primary" style={{ marginTop: 20 }}>
          <strong>راهنمای امتیازدهی:</strong>
          <ol style={{ marginTop: 8, paddingRight: 16, listStyle: 'decimal' }}>
            <li>تیم و دوره مورد نظر را انتخاب کنید</li>
            <li>کارمند مورد نظر را از لیست انتخاب کنید</li>
            <li>نمره هر معیار را در بازه ۰ تا ۱۰۰ وارد کنید</li>
            <li>در صورت تمایل نظر اختیاری بنویسید</li>
            <li>پس از ذخیره، نمره نهایی KPI خودکار محاسبه می‌شود</li>
          </ol>
        </div>
      </div>
    </AppLayout>
  )
}

