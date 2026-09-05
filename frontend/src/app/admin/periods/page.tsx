'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, CalendarDays, Package, Plus, Info, X, Pencil, Play, Archive, RotateCcw, Trash2 } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { kpiApi, teamsApi } from '@/lib/api'
import type { ReportingPeriod, Team } from '@/lib/api'
import { gregorianToJalaliStr, toPersianNums } from '@/lib/jalali'
import { jalaliToGregorianStr } from '@/lib/jalali'
import JalaliDatePicker from '@/components/JalaliDatePicker'

type ViewMode = 'active' | 'archived'

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('active')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [periodType, setPeriodType] = useState('quarterly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [archiveResult, setArchiveResult] = useState<string | null>(null)

  // Archive detail view
  const [selectedPeriod, setSelectedPeriod] = useState<ReportingPeriod | null>(null)
  const [periodReport, setPeriodReport] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Edit modal
  const [editPeriod, setEditPeriod] = useState<ReportingPeriod | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')

  const load = () => {
    Promise.all([kpiApi.listPeriods(), teamsApi.list()]).then(([p, t]) => {
      setPeriods(p); setTeams(t)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name || !startDate || !endDate) return
    await kpiApi.createPeriod({ name, period_type: periodType, start_date: jalaliToGregorianStr(startDate), end_date: jalaliToGregorianStr(endDate) })
    setName(''); setStartDate(''); setEndDate(''); setShowForm(false); load()
  }

  const handleAutoArchive = async () => {
    try {
      const result = await kpiApi.autoArchive()
      setArchiveResult(result.message)
      load()
      setTimeout(() => setArchiveResult(null), 5000)
    } catch {
      setArchiveResult('خطا در آرشیو خودکار')
      setTimeout(() => setArchiveResult(null), 5000)
    }
  }

  const activatePeriod = async (id: number) => {
    await kpiApi.changeActivePeriod(id)
    load()
  }

  const openPeriodDetail = async (period: ReportingPeriod) => {
    setSelectedPeriod(period)
    setReportLoading(true)
    try {
      // Load company report for this period
      const report = await kpiApi.calculateCompany(period.id) as any
      setPeriodReport(report)
    } catch {
      setPeriodReport(null)
    }
    setReportLoading(false)
  }

  const openEditPeriod = (period: ReportingPeriod) => {
    setEditPeriod(period)
    setEditName(period.name)
    setEditType(period.period_type)
  }

  const saveEditPeriod = async () => {
    if (!editPeriod) return
    try {
      await fetch(`http://localhost:8000/api/kpi/periods/${editPeriod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, period_type: editType }),
      })
      setEditPeriod(null)
      load()
    } catch {}
  }

  const reactivatePeriod = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/kpi/periods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: false }),
      })
      load()
      if (selectedPeriod?.id === id) setSelectedPeriod(null)
    } catch {}
  }

  const typeLabels: Record<string, string> = { monthly: 'ماهانه', quarterly: 'فصلی', semi_annual: 'شش‌ماهه', annual: 'سالانه' }

  const activePeriods = periods.filter(p => !p.is_archived)
  const archivedPeriods = periods.filter(p => p.is_archived)
  const displayedPeriods = viewMode === 'active' ? activePeriods : archivedPeriods

  if (loading) return <AppLayout><div className="flex items-center justify-center py-32"><div className="inline-block w-12 h-12 border-[3px] border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'transparent' }} /></div></AppLayout>

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <CalendarClock size={21} />
            </span>
            <div>
              <h1 className="page-title gradient-text" style={{ margin: 0 }}>دوره‌های زمانی</h1>
              <p className="page-subtitle">
                ایجاد و مدیریت دوره‌های ارزیابی — دوره‌ها پس از ۳ ماه از تاریخ پایان به‌صورت خودکار آرشیو می‌شوند
              </p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleAutoArchive} className="premium-btn btn-outline"><Archive size={14} /> آرشیو خودکار</button>
            <button onClick={() => setShowForm(!showForm)} className="premium-btn btn-primary"><Plus size={15} /> دوره جدید</button>
          </div>
        </div>

        {archiveResult && (
          <div className="flex items-center gap-2 p-4 rounded-xl text-sm animate-fadeIn" style={{ background: 'var(--accent-info-light)', color: 'var(--accent-info)' }}>
            <Info size={15} /> {archiveResult}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
          <button onClick={() => { setViewMode('active'); setSelectedPeriod(null) }}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
            style={{ background: viewMode === 'active' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'active' ? 'white' : 'var(--text-secondary)' }}>
            <CalendarDays size={14} /> فعال ({toPersianNums(String(activePeriods.length))})
          </button>
          <button onClick={() => setViewMode('archived')}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
            style={{ background: viewMode === 'archived' ? 'var(--accent-warning)' : 'transparent', color: viewMode === 'archived' ? 'white' : 'var(--text-secondary)' }}>
            <Archive size={14} /> آرشیو ({toPersianNums(String(archivedPeriods.length))})
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">دوره جدید</h3>
              <div className="space-y-3">
                <input className="w-full p-3 text-sm rounded-xl" placeholder="نام دوره (مثلاً فصل اول ۱۴۰۴)" value={name} onChange={e => setName(e.target.value)} />
                <select className="w-full p-3 text-sm rounded-xl" value={periodType} onChange={e => setPeriodType(e.target.value)}>
                  <option value="monthly">ماهانه</option>
                  <option value="quarterly">فصلی</option>
                  <option value="semi_annual">شش‌ماهه</option>
                  <option value="annual">سالانه</option>
                </select>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>تاریخ شروع</label>
                  <JalaliDatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>تاریخ پایان</label>
                  <JalaliDatePicker value={endDate} onChange={setEndDate} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={create} className="premium-btn btn-primary flex-1 justify-center">ذخیره</button>
                <button onClick={() => setShowForm(false)} className="premium-btn btn-ghost">لغو</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editPeriod && (
          <div className="modal-overlay" onClick={() => setEditPeriod(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">ویرایش دوره</h3>
              <div className="space-y-3">
                <input className="w-full p-3 text-sm rounded-xl" placeholder="نام دوره" value={editName} onChange={e => setEditName(e.target.value)} />
                <select className="w-full p-3 text-sm rounded-xl" value={editType} onChange={e => setEditType(e.target.value)}>
                  <option value="monthly">ماهانه</option>
                  <option value="quarterly">فصلی</option>
                  <option value="semi_annual">شش‌ماهه</option>
                  <option value="annual">سالانه</option>
                </select>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={saveEditPeriod} className="premium-btn btn-primary flex-1 justify-center">ذخیره</button>
                <button onClick={() => setEditPeriod(null)} className="premium-btn btn-ghost">لغو</button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Periods Table */}
          <div className={`${selectedPeriod ? 'lg:col-span-1' : 'lg:col-span-3'} premium-card overflow-hidden transition-all duration-300`}>
            <div className="p-4">
              {displayedPeriods.length === 0 ? (
                <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>
                  <div className="text-5xl mb-3" style={{ opacity: 0.4 }}>{viewMode === 'archived' ? <Package size={48} /> : <CalendarDays size={48} />}</div>
                  <p className="font-medium">{viewMode === 'archived' ? 'هیچ دوره آرشیو شده‌ای وجود ندارد' : 'هیچ دوره‌ای وجود ندارد'}</p>
                </div>
              ) : (
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>نام دوره</th>
                      {!selectedPeriod && <th>نوع</th>}
                      <th>تاریخ شروع</th>
                      <th>تاریخ پایان</th>
                      <th>وضعیت</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPeriods.map(p => (
                      <tr key={p.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => viewMode === 'archived' && openPeriodDetail(p)}>
                        <td className="font-bold">{p.name}</td>
                        {!selectedPeriod && <td style={{ color: 'var(--text-secondary)' }}>{typeLabels[p.period_type] || p.period_type}</td>}
                        <td style={{ color: 'var(--text-tertiary)' }} className="text-xs">{toPersianNums(gregorianToJalaliStr(p.start_date))}</td>
                        <td style={{ color: 'var(--text-tertiary)' }} className="text-xs">{toPersianNums(gregorianToJalaliStr(p.end_date))}</td>
                        <td>
                          {p.is_archived ? (
                            <span className="badge badge-warning">آرشیو</span>
                          ) : p.is_active ? (
                            <span className="badge badge-success">فعال</span>
                          ) : (
                            <span className="badge badge-danger">بسته</span>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button onClick={() => openEditPeriod(p)}
                              className="premium-btn btn-ghost text-xs py-1 px-2" title="ویرایش"><Pencil size={13} /></button>
                            {p.is_archived && (
                              <button onClick={() => reactivatePeriod(p.id)}
                                className="premium-btn btn-ghost text-xs py-1 px-2" title="فعال‌سازی مجدد"
                                style={{ color: 'var(--accent-success)' }}><RotateCcw size={13} /></button>
                            )}
                            {!p.is_archived && !p.is_active && (
                              <button onClick={() => activatePeriod(p.id)}
                                className="premium-btn btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                                style={{ color: 'var(--accent-success)' }}><Play size={12} /> فعال</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Archive Detail Panel */}
          {selectedPeriod && (
            <div className="lg:col-span-2 space-y-5 animate-slideUp">
              {/* Period Info Card */}
              <div className="premium-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-black gradient-text">{selectedPeriod.name}</h2>
                    <div className="flex gap-4 mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span>{typeLabels[selectedPeriod.period_type]}</span>
                      <span className="flex items-center gap-1"><CalendarDays size={13} /> {toPersianNums(gregorianToJalaliStr(selectedPeriod.start_date))} — {toPersianNums(gregorianToJalaliStr(selectedPeriod.end_date))}</span>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedPeriod(null); setPeriodReport(null) }}
                    className="premium-btn btn-ghost text-sm"><X size={13} /> بستن</button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 stagger-children">
                  <div className="p-3 rounded-xl text-center" style={{ background: 'var(--accent-primary-light)' }}>
                    <div className="text-xl font-black" style={{ color: 'var(--accent-primary)' }}>
                      {periodReport?.total_employees || 0}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>کارمند</div>
                  </div>
                  <div className="p-3 rounded-xl text-center" style={{ background: 'var(--accent-success-light)' }}>
                    <div className="text-xl font-black" style={{ color: 'var(--accent-success)' }}>
                      {periodReport?.company_avg?.toFixed(1) || '۰'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>میانگین شرکت</div>
                  </div>
                  <div className="p-3 rounded-xl text-center" style={{ background: 'var(--accent-info-light)' }}>
                    <div className="text-xl font-black" style={{ color: 'var(--accent-info)' }}>
                      {periodReport?.teams?.length || 0}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>تیم</div>
                  </div>
                </div>
              </div>

              {/* Team Reports */}
              {reportLoading ? (
                <div className="premium-card p-8 text-center">
                  <div className="inline-block w-8 h-8 border-[3px] border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'transparent' }} />
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>در حال بارگذاری گزارش...</p>
                </div>
              ) : periodReport?.teams ? (
                <div className="space-y-4 stagger-children">
                  {periodReport.teams.map((team: any) => (
                    <div key={team.team_id} className="premium-card p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{team.team_name}</h3>
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{team.member_count} عضو</span>
                        </div>
                        <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--accent-primary-light)' }}>
                          <div className="text-xl font-black" style={{ color: 'var(--accent-primary)' }}>{team.avg_score.toFixed(1)}</div>
                          <div className="text-[0.6rem]" style={{ color: 'var(--text-tertiary)' }}>میانگین</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {team.members.map((m: any) => (
                          <div key={m.employee_id} className="flex items-center gap-3 p-3 rounded-xl"
                            style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm">{m.employee_name}</div>
                              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{m.employee_code}</div>
                            </div>
                            <div className="flex-1">
                              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border-primary)' }}>
                                <div className="h-full rounded-full progress-animated"
                                  style={{
                                    width: `${Math.min(m.final_score, 100)}%`,
                                    background: m.final_score >= 70 ? 'var(--accent-success)' : m.final_score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)',
                                  }} />
                              </div>
                            </div>
                            <span className="score-badge"
                              style={{
                                background: m.final_score >= 70 ? 'var(--accent-success-light)' : m.final_score >= 50 ? 'var(--accent-warning-light)' : 'var(--accent-danger-light)',
                                color: m.final_score >= 70 ? 'var(--accent-success)' : m.final_score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)',
                              }}>
                              {m.final_score.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="premium-card p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  <div className="text-4xl mb-3">📊</div>
                  <p>هنوز امتیازی در این دوره ثبت نشده</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
