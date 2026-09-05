'use client'

import { useEffect, useState } from 'react'
import HeadIcon from '@/components/HeadIcon'
import AppLayout from '@/components/Layout'
import { goalsApi, employeesApi, kpiApi, teamsApi } from '@/lib/api'
import type { Goal, Employee, ReportingPeriod, Team } from '@/lib/api'
import { toPersianNums } from '@/lib/jalali'

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [teamId, setTeamId] = useState<number | ''>('')
  const [periodId, setPeriodId] = useState<number | ''>('')

  // Form state
  const [fEmp, setFEmp] = useState<number | ''>('')
  const [fPeriod, setFPeriod] = useState<number | ''>('')
  const [fTitle, setFTitle] = useState('')
  const [fTarget, setFTarget] = useState('')
  const [fUnit, setFUnit] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      teamsApi.list(), kpiApi.listPeriods(), employeesApi.listAll(),
    ]).then(([t, p, e]) => {
      setTeams(t)
      setPeriods(p.filter(per => !per.is_archived))
      setEmployees(e.filter(emp => !emp.is_archived))
      const active = p.find(per => per.is_active && !per.is_archived)
      if (active) {
        setPeriodId(active.id)
        setFPeriod(active.id)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    goalsApi.list(undefined, periodId === '' ? undefined : Number(periodId))
      .then(setGoals)
      .catch(() => setGoals([]))
  }, [periodId])

  const filteredEmployees = teamId === '' ? employees : employees.filter(e => e.team_id === teamId)

  const addGoal = async () => {
    if (!fEmp || !fPeriod || !fTitle || !fTarget) {
      setFormMsg({ type: 'err', text: 'کارمند، دوره، عنوان و مقدار هدف الزامی است' })
      return
    }
    try {
      await goalsApi.create({
        employee_id: Number(fEmp), period_id: Number(fPeriod),
        title: fTitle, target_value: Number(fTarget),
        unit: fUnit || undefined, description: fDesc || undefined,
      })
      setFormMsg({ type: 'ok', text: 'هدف ثبت شد' })
      setFTitle(''); setFTarget(''); setFUnit(''); setFDesc('')
      setGoals(await goalsApi.list(undefined, Number(fPeriod)))
    } catch (e: any) {
      setFormMsg({ type: 'err', text: e.detail || e.message || 'خطا در ثبت هدف' })
    }
  }

  const updateProgress = async (g: Goal, current: number) => {
    await goalsApi.update(g.id, { current_value: current })
    setGoals(prev => prev.map(x => x.id === g.id
      ? { ...x, current_value: current, achievement_pct: g.target_value > 0 ? Math.round(current / g.target_value * 1000) / 10 : 0, status: current >= g.target_value ? 'completed' : x.status }
      : x))
  }

  const removeGoal = async (id: number) => {
    await goalsApi.delete(id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const statusBadge = (g: Goal) => {
    if (g.status === 'completed') return <span className="badge badge-success">تکمیل</span>
    if (g.status === 'missed') return <span className="badge badge-danger">تحقق‌نیافته</span>
    return <span className="badge badge-primary">در جریان</span>
  }

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="page-header">
          <div>
            <h1 className="page-title">اهداف عملکردی</h1>
            <p className="page-subtitle">اهداف کمی برای هر کارمند در هر دوره — درصد تحقق کنار نمره KPI نمایش داده می‌شود</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="card" style={{ padding: 20, alignSelf: 'start' }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><HeadIcon glyph="◎" /></span>
                تعریف هدف جدید
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
                <label className="form-label">دوره</label>
                <select className="form-input" value={fPeriod} onChange={e => setFPeriod(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">انتخاب کنید</option>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">عنوان هدف</label>
                <input className="form-input" value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="مثلاً: افزایش رضایت مشتری" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="form-label">مقدار هدف</label>
                  <input className="form-input" type="number" value={fTarget} onChange={e => setFTarget(e.target.value)} placeholder="مثلاً ۱۰۰" />
                </div>
                <div>
                  <label className="form-label">واحد</label>
                  <input className="form-input" value={fUnit} onChange={e => setFUnit(e.target.value)} placeholder="درصد، عدد، تومان…" />
                </div>
              </div>
              <div>
                <label className="form-label">توضیحات (اختیاری)</label>
                <textarea className="form-input" rows={2} value={fDesc} onChange={e => setFDesc(e.target.value)} />
              </div>
              {formMsg && (
                <div className={formMsg.type === 'ok' ? 'info-box info-box-success' : 'info-box info-box-danger'}>
                  {formMsg.text}
                </div>
              )}
              <button className="btn btn-primary" onClick={addGoal}>ثبت هدف</button>
            </div>
          </div>

          {/* Goals list */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>دوره:</span>
              <div className="flex gap-1.5 flex-wrap">
                {periods.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodId(p.id)}
                    className="tab"
                    style={{
                      background: periodId === p.id ? 'var(--accent-primary)' : 'transparent',
                      color: periodId === p.id ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center" style={{ padding: 40 }}>
                <div className="spinner" style={{ width: 26, height: 26 }} />
              </div>
            ) : goals.length === 0 ? (
              <div className="card empty-state" style={{ padding: 32 }}>
                <div className="empty-state-icon">🎯</div>
                <div className="empty-state-title">هنوز هدفی ثبت نشده</div>
                <div className="empty-state-desc">با فرم کنار صفحه برای کارمندان هدف تعریف کنید</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {goals.map(g => (
                  <div key={g.id} className="card" style={{ padding: 16 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div style={{ minWidth: 0 }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{g.title}</span>
                          {statusBadge(g)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 3 }}>
                          {g.employee_name} · {g.period_name}
                          {g.description && <span style={{ display: 'block', marginTop: 2 }}>{g.description}</span>}
                        </div>
                      </div>
                      <button className="btn-icon btn-icon-danger" onClick={() => removeGoal(g.id)} title="حذف">✕</button>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          پیشرفت: {toPersianNums(String(g.current_value))} از {toPersianNums(String(g.target_value))} {g.unit || ''}
                        </span>
                        <span className={`score-badge ${g.achievement_pct >= 100 ? 'score-excellent' : g.achievement_pct >= 60 ? 'score-good' : 'score-average'}`}>
                          {toPersianNums(String(g.achievement_pct))}٪
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(Math.max(g.achievement_pct, g.current_value > 0 ? 3 : 0), 100)}%`,
                            background: g.achievement_pct >= 100 ? 'var(--gradient-success)' : 'var(--gradient-primary)',
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
                        <input
                          className="form-input"
                          type="number"
                          style={{ width: 110, padding: '6px 10px' }}
                          defaultValue={g.current_value}
                          onBlur={e => {
                            const v = Number(e.target.value)
                            if (!isNaN(v) && v !== g.current_value) updateProgress(g, v)
                          }}
                          placeholder="پیشرفت"
                        />
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>به‌روزرسانی پیشرفت (بعد از تایپ، کلیک بیرون)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}