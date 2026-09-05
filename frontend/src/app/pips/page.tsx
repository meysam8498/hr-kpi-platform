'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Plus, Search, Info, CalendarDays, Target, Activity, CheckCircle2, Trash2, ClipboardList } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { employeesApi, pipsApi } from '@/lib/api'
import type { Employee, PIPData } from '@/lib/api'
import { gregorianToJalaliStr, toPersianNums } from '@/lib/jalali'
import JalaliDatePicker from '@/components/JalaliDatePicker'

export default function PIPsPage() {
  const [pips, setPips] = useState<PIPData[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [autoResult, setAutoResult] = useState<string | null>(null)

  const [form, setForm] = useState({
    employee_id: 0, title: '', description: '',
    start_date: '', end_date: '', target_score: 60,
  })

  const load = () => {
    Promise.all([pipsApi.list(), employeesApi.listAll()]).then(([p, e]) => {
      setPips(p); setEmployees(e)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const createPip = async () => {
    if (!form.employee_id || !form.title || !form.start_date || !form.end_date) return
    await pipsApi.create({ ...form, employee_id: form.employee_id })
    setForm({ employee_id: 0, title: '', description: '', start_date: '', end_date: '', target_score: 60 })
    setShowForm(false); load()
  }

  const updateStatus = async (id: number, status: string) => {
    await pipsApi.update(id, { status })
    load()
  }

  const deletePip = async (id: number) => {
    if (!confirm('آیا این طرح حذف شود؟')) return
    await pipsApi.delete(id); load()
  }

  const checkAuto = async () => {
    const result = await pipsApi.checkAuto()
    setAutoResult(result.message)
    load()
  }

  const activePips = pips.filter(p => p.status === 'active')
  const completedPips = pips.filter(p => p.status !== 'active')

  if (loading) return <AppLayout><div className="flex items-center justify-center py-32"><div className="inline-block w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'transparent' }} /></div></AppLayout>

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <TrendingUp size={21} />
            </span>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>طرح بهبود عملکرد</h1>
              <p className="page-subtitle">شناسایی و پیگیری کارمندان نیازمند بهبود عملکرد</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={checkAuto} className="premium-btn btn-outline"><Search size={14} /> بررسی خودکار</button>
            <button onClick={() => setShowForm(!showForm)} className="premium-btn btn-primary"><Plus size={15} /> طرح جدید</button>
          </div>
        </div>

        {autoResult && (
          <div className="flex items-center gap-2 p-4 rounded-xl text-sm animate-fadeIn" style={{ background: 'var(--accent-info-light)', color: 'var(--accent-info)' }}>
            <Info size={15} /> {autoResult}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 stagger-children">
          <div className="premium-card p-5 text-center">
            <div className="text-3xl font-black" style={{ color: 'var(--accent-danger)' }}>{activePips.length}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>طرح فعال</div>
          </div>
          <div className="premium-card p-5 text-center">
            <div className="text-3xl font-black" style={{ color: 'var(--accent-success)' }}>{completedPips.length}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>تکمیل/لغو شده</div>
          </div>
          <div className="premium-card p-5 text-center">
            <div className="text-3xl font-black" style={{ color: 'var(--accent-primary)' }}>{pips.length}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>کل طرح‌ها</div>
          </div>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">طرح بهبود جدید</h3>
              <div className="space-y-3">
                <select className="w-full p-3 text-sm rounded-xl" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: Number(e.target.value) })}>
                  <option value={0}>انتخاب کارمند...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.employee_code} — {e.first_name} {e.last_name}</option>)}
                </select>
                <input className="w-full p-3 text-sm rounded-xl" placeholder="عنوان طرح" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <textarea className="w-full p-3 text-sm rounded-xl" placeholder="توضیحات" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>تاریخ شروع</label>
                    <JalaliDatePicker value={form.start_date} onChange={v => setForm({ ...form, start_date: v })} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>تاریخ پایان</label>
                    <JalaliDatePicker value={form.end_date} onChange={v => setForm({ ...form, end_date: v })} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>نمره هدف</label>
                  <input type="number" min={0} max={100} className="w-full p-3 text-sm rounded-xl" value={form.target_score} onChange={e => setForm({ ...form, target_score: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={createPip} className="premium-btn btn-primary flex-1 justify-center">ذخیره</button>
                <button onClick={() => setShowForm(false)} className="premium-btn btn-ghost">لغو</button>
              </div>
            </div>
          </div>
        )}

        {/* Active PIPs */}
        <div className="premium-card overflow-hidden">
          <div className="p-5 pb-0">
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>طرح‌های فعال</h2>
          </div>
          <div className="p-4">
            {activePips.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
                <div className="text-4xl mb-3" style={{ opacity: 0.4 }}><CheckCircle2 size={44} /></div>
                <p className="font-medium">هیچ طرح بهبود فعالی وجود ندارد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activePips.map(pip => (
                  <div key={pip.id} className="p-5 rounded-xl animate-fadeIn" style={{ background: 'var(--bg-tertiary)', border: '1.5px solid var(--accent-danger)' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{pip.title}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                          {pip.employee_name} ({pip.employee_code}) — {pip.team_name}
                        </div>
                        {pip.description && (
                          <div className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'var(--bg-card)' }}>{pip.description}</div>
                        )}
                        <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="flex items-center gap-1"><CalendarDays size={13} /> {toPersianNums(gregorianToJalaliStr(pip.start_date))} — {toPersianNums(gregorianToJalaliStr(pip.end_date))}</span>
                          <span className="flex items-center gap-1"><Target size={13} /> هدف: {toPersianNums(String(pip.target_score))}</span>
                          {pip.latest_score !== null && (
                            <span style={{ color: pip.latest_score >= pip.target_score ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                              <span className="flex items-center gap-1"><Activity size={13} /> آخرین نمره: {toPersianNums(String(pip.latest_score))}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus(pip.id, 'completed')} className="premium-btn btn-success text-xs py-1 px-3"><CheckCircle2 size={13} /> تکمیل</button>
                        <button onClick={() => updateStatus(pip.id, 'cancelled')} className="premium-btn btn-ghost text-xs py-1 px-3" style={{ color: 'var(--accent-warning)' }}>لغو</button>
                        <button onClick={() => deletePip(pip.id)} className="premium-btn btn-ghost text-xs py-1 px-3" style={{ color: 'var(--accent-danger)' }} title="حذف"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Completed/Cancelled */}
        {completedPips.length > 0 && (
          <div className="premium-card overflow-hidden" style={{ opacity: 0.7 }}>
            <div className="p-5 pb-0">
              <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}><ClipboardList size={14} /> طرح‌های تکمیل/لغو شده ({toPersianNums(String(completedPips.length))})</h2>
            </div>
            <div className="p-4">
              {completedPips.map(pip => (
                <div key={pip.id} className="flex items-center gap-4 p-3 rounded-xl mb-2" style={{ background: 'var(--bg-tertiary)' }}>
                  <span className={`badge ${pip.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                    {pip.status === 'completed' ? 'تکمیل' : 'لغو شده'}
                  </span>
                  <div className="flex-1">
                    <span className="text-sm font-bold">{pip.title}</span>
                    <span className="text-xs mr-2" style={{ color: 'var(--text-tertiary)' }}>{pip.employee_name}</span>
                  </div>
                  <button onClick={() => deletePip(pip.id)} className="text-xs" title="حذف" style={{ color: 'var(--accent-danger)', display: 'inline-flex' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
