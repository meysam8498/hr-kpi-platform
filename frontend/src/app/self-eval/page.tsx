'use client'

import { useEffect, useState } from 'react'
import { UserCheck, ClipboardPen, UserRound, CalendarDays, AlertTriangle, CheckCircle2, ThumbsUp, RefreshCw } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { employeesApi, kpiApi, selfEvalApi } from '@/lib/api'
import type { Employee, ReportingPeriod, KPIResult, SelfEvaluation } from '@/lib/api'

export default function SelfEvalPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [selfEvals, setSelfEvals] = useState<SelfEvaluation[]>([])
  const [kpiResults, setKpiResults] = useState<KPIResult[]>([])
  const [selectedEmp, setSelectedEmp] = useState<number>(0)
  const [selectedPeriod, setSelectedPeriod] = useState<number>(0)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    self_score: 70,
    strengths: '',
    improvements: '',
  })

  useEffect(() => {
    Promise.all([employeesApi.list(), kpiApi.listPeriods(), selfEvalApi.list()]).then(([e, p, se]) => {
      setEmployees(e); setPeriods(p); setSelfEvals(se)
      const active = p.find(x => x.is_active)
      if (active) setSelectedPeriod(active.id)
      if (e.length > 0) setSelectedEmp(e[0].id)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedEmp) {
      kpiApi.employeeResults(selectedEmp).then(setKpiResults).catch(() => setKpiResults([]))
    }
  }, [selectedEmp])

  const handleSubmit = async () => {
    if (!selectedEmp || !selectedPeriod) return
    setSaving(true)
    try {
      await selfEvalApi.create({
        employee_id: selectedEmp,
        period_id: selectedPeriod,
        self_score: form.self_score,
        strengths: form.strengths || undefined,
        improvements: form.improvements || undefined,
      })
      setShowForm(false)
      setForm({ self_score: 70, strengths: '', improvements: '' })
      const se = await selfEvalApi.list()
      setSelfEvals(se)
    } catch (err: any) {
      alert(err.message || 'خطا')
    } finally {
      setSaving(false)
    }
  }

  const currentEmpEval = selfEvals.find(
    se => se.employee_id === selectedEmp && se.period_id === selectedPeriod
  )
  const currentEmpResult = kpiResults.find(r => r.period_id === selectedPeriod)
  const emp = employees.find(e => e.id === selectedEmp)

  if (loading) return <AppLayout><div className="flex items-center justify-center py-32"><div className="inline-block w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'transparent' }} /></div></AppLayout>

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <UserCheck size={21} />
          </span>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>خودارزیابی</h1>
            <p className="page-subtitle">مقایسه نمره خودارزیابی با نمره مدیر — خودآگاهی کلید رشد است</p>
          </div>
        </div>

        {/* Selectors */}
        <div className="premium-card p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><UserRound size={15} /> انتخاب کارمند</label>
              <select className="w-full p-3 text-sm rounded-xl" value={selectedEmp} onChange={e => { setSelectedEmp(Number(e.target.value)); setShowForm(false) }}>
                {employees.map(e => <option key={e.id} value={e.id}>{e.employee_code} — {e.first_name} {e.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><CalendarDays size={15} /> انتخاب دوره</label>
              <select className="w-full p-3 text-sm rounded-xl" value={selectedPeriod} onChange={e => { setSelectedPeriod(Number(e.target.value)); setShowForm(false) }}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name} {p.is_active ? '(فعال)' : ''}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Comparison Card */}
        {selectedEmp > 0 && selectedPeriod > 0 && (
          <div className="premium-card p-6 animate-slideUp">
            <h2 className="font-bold text-lg mb-5" style={{ color: 'var(--text-primary)' }}>
              <span className="card-header-icon"><ClipboardPen size={14} /></span> مقایسه نمره مدیر و خودارزیابی — {emp?.first_name} {emp?.last_name}
            </h2>

            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Manager Score */}
              <div className="p-5 rounded-xl text-center" style={{ background: 'var(--accent-primary-light)', border: '1.5px solid var(--accent-primary)' }}>
                <div className="text-xs font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>نمره مدیر</div>
                <div className="text-5xl font-black" style={{ color: 'var(--accent-primary)' }}>
                  {currentEmpResult?.final_score ?? '-'}
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  {currentEmpResult ? 'محاسبه‌شده بر اساس معیارها' : 'هنوز ثبت نشده'}
                </div>
              </div>

              {/* Self Score */}
              <div className="p-5 rounded-xl text-center" style={{ background: 'var(--accent-info-light)', border: '1.5px solid var(--accent-info)' }}>
                <div className="text-xs font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>نمره خودارزیابی</div>
                <div className="text-5xl font-black" style={{ color: 'var(--accent-info)' }}>
                  {currentEmpEval?.self_score ?? '-'}
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  {currentEmpEval ? 'خودارزیابی کارمند' : 'هنوز ثبت نشده'}
                </div>
              </div>
            </div>

            {/* Gap Analysis */}
            {currentEmpResult && currentEmpEval && (
              <div className="p-4 rounded-xl mb-5" style={{
                background: Math.abs(currentEmpResult.final_score - currentEmpEval.self_score) > 15 ? 'var(--accent-warning-light)' : 'var(--accent-success-light)',
                border: `1.5px solid ${Math.abs(currentEmpResult.final_score - currentEmpEval.self_score) > 15 ? 'var(--accent-warning)' : 'var(--accent-success)'}`,
              }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl" style={{ color: Math.abs(currentEmpResult.final_score - currentEmpEval.self_score) > 15 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                    {Math.abs(currentEmpResult.final_score - currentEmpEval.self_score) > 15 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                  </span>
                  <div>
                    <div className="font-bold text-sm">
                      اختلاف: {Math.abs(currentEmpResult.final_score - currentEmpEval.self_score).toFixed(1)} نمره
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {currentEmpEval.self_score > currentEmpResult.final_score
                        ? 'کارمند بیشتر از عملکرد واقعی خود ارزیابی کرده — نیاز به بازخورد دارد'
                        : 'کارمند کمتر از عملکرد واقعی خود ارزیابی کرده — نیاز به تقویت اعتماد به نفس'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Strengths & Improvements */}
            {currentEmpEval && (
              <div className="grid grid-cols-2 gap-4 mb-5">
                {currentEmpEval.strengths && (
                  <div className="p-4 rounded-xl" style={{ background: 'var(--accent-success-light)' }}>
                    <div className="flex items-center gap-1.5 font-bold text-xs mb-2" style={{ color: 'var(--accent-success)' }}><ThumbsUp size={13} /> نقاط قوت</div>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{currentEmpEval.strengths}</p>
                  </div>
                )}
                {currentEmpEval.improvements && (
                  <div className="p-4 rounded-xl" style={{ background: 'var(--accent-warning-light)' }}>
                    <div className="flex items-center gap-1.5 font-bold text-xs mb-2" style={{ color: 'var(--accent-warning)' }}><RefreshCw size={13} /> زمینه‌های بهبود</div>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{currentEmpEval.improvements}</p>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            {selectedEmp > 0 && selectedPeriod > 0 && (
              <div>
                {currentEmpEval ? (
                  <div className="p-3 rounded-xl text-sm text-center" style={{ background: 'var(--accent-success-light)', color: 'var(--accent-success)' }}>
                    <CheckCircle2 size={15} /> خودارزیابی برای این دوره ثبت شده
                  </div>
                ) : (
                  <button onClick={() => setShowForm(true)} className="premium-btn btn-primary w-full justify-center">
                    <ClipboardPen size={15} /> ثبت خودارزیابی جدید
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Self-Eval Form Modal */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">فرم خودارزیابی</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>نمره عملکرد خودتان (۰ تا ۱۰۰)</label>
                  <input type="range" min={0} max={100} value={form.self_score}
                    onChange={e => setForm({ ...form, self_score: Number(e.target.value) })}
                    className="w-full" />
                  <div className="text-center text-3xl font-black mt-2" style={{
                    color: form.self_score >= 70 ? 'var(--accent-success)' : form.self_score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)',
                  }}>
                    {form.self_score}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><ThumbsUp size={15} /> نقاط قوت شما</label>
                  <textarea className="w-full p-3 text-sm rounded-xl" rows={3} placeholder="چه کارهایی خوب انجام دادید؟"
                    value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><RefreshCw size={15} /> زمینه‌های بهبود</label>
                  <textarea className="w-full p-3 text-sm rounded-xl" rows={3} placeholder="در چه بخش‌هایی می‌توانید بهتر شوید؟"
                    value={form.improvements} onChange={e => setForm({ ...form, improvements: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={handleSubmit} disabled={saving} className="premium-btn btn-primary flex-1 justify-center">
                  {saving ? 'در حال ذخیره...' : 'ذخیره خودارزیابی'}
                </button>
                <button onClick={() => setShowForm(false)} className="premium-btn btn-ghost">لغو</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
