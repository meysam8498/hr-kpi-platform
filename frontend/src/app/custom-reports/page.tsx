'use client'

import { useEffect, useState } from 'react'
import { Search, Building2, Users, CalendarDays, ListChecks, Filter, BarChart3, Download } from 'lucide-react'
import AppLayout from '@/components/Layout'
import JalaliDatePicker from '@/components/JalaliDatePicker'
import { teamsApi, employeesApi, kpiApi, customReportApi, authApi } from '@/lib/api'
import type { Team, Employee, ReportingPeriod, KPICriterion } from '@/lib/api'

export default function CustomReportsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [criteria, setCriteria] = useState<KPICriterion[]>([])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [filters, setFilters] = useState({
    team_id: undefined as number | undefined,
    employee_ids: [] as number[],
    period_ids: [] as number[],
    criteria_ids: [] as number[],
    min_score: undefined as number | undefined,
    max_score: undefined as number | undefined,
    date_from: '' as string,
    date_to: '' as string,
  })
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  useEffect(() => {
    Promise.all([
      teamsApi.list(), employeesApi.list(), kpiApi.listPeriods(), kpiApi.listCriteria(),
    ]).then(([t, e, p, c]) => {
      setTeams(t); setEmployees(e); setPeriods(p); setCriteria(c)
    }).finally(() => setLoading(false))
  }, [])

  const filteredEmployees = filters.team_id
    ? employees.filter(e => e.team_id === filters.team_id)
    : employees

  const toggleArrayFilter = (key: 'employee_ids' | 'period_ids' | 'criteria_ids', id: number) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter(x => x !== id) : [...prev[key], id],
    }))
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const result = await customReportApi.generate({
        ...filters,
        employee_ids: filters.employee_ids.length > 0 ? filters.employee_ids : undefined,
        period_ids: filters.period_ids.length > 0 ? filters.period_ids : undefined,
        criteria_ids: filters.criteria_ids.length > 0 ? filters.criteria_ids : undefined,
      })
      setReport(result)
    } catch {
      setReport(null)
    } finally {
      setGenerating(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      team_id: undefined, employee_ids: [], period_ids: [],
      criteria_ids: [], min_score: undefined, max_score: undefined,
      date_from: '', date_to: '',
    })
    setReport(null)
  }

  const exportExcel = async () => {
    setExporting(true)
    setExportMsg('')
    try {
      await authApi.downloadFile(
        customReportApi.exportUrl,
        'POST',
        {
          team_id: filters.team_id,
          employee_ids: filters.employee_ids.length > 0 ? filters.employee_ids : undefined,
          period_ids: filters.period_ids.length > 0 ? filters.period_ids : undefined,
          criteria_ids: filters.criteria_ids.length > 0 ? filters.criteria_ids : undefined,
          min_score: filters.min_score,
          max_score: filters.max_score,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
        },
        'custom-report.xlsx',
      )
      setExportMsg('خروجی اکسل دانلود شد')
    } catch (e) {
      setExportMsg((e as Error).message || 'خطا در خروجی اکسل')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <AppLayout><div className="flex items-center justify-center py-32"><div className="inline-block w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'transparent' }} /></div></AppLayout>

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <Search size={21} />
          </span>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>گزارش سفارشی</h1>
            <p className="page-subtitle">فیلتر دلخواه انتخاب کنید و گزارش اختصاصی بگیرید</p>
          </div>
        </div>

        {/* Filters */}
        <div className="premium-card p-6 space-y-5">
          {/* Team Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><Building2 size={15} /> تیم</label>
            <select className="w-full p-3 text-sm rounded-xl" value={filters.team_id || 0} onChange={e => setFilters({ ...filters, team_id: e.target.value ? Number(e.target.value) : undefined })}>
              <option value={0}>همه تیم‌ها</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Employees */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><Users size={15} /> کارمندان</label>
            <div className="flex flex-wrap gap-2">
              {filteredEmployees.map(emp => (
                <button key={emp.id} onClick={() => toggleArrayFilter('employee_ids', emp.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background: filters.employee_ids.includes(emp.id) ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: filters.employee_ids.includes(emp.id) ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${filters.employee_ids.includes(emp.id) ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                  }}>
                  {emp.first_name} {emp.last_name}
                </button>
              ))}
            </div>
            {filters.employee_ids.length > 0 && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{filters.employee_ids.length} نفر انتخاب شده</div>
            )}
          </div>

          {/* Periods */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><CalendarDays size={15} /> دوره‌ها</label>
            <div className="flex flex-wrap gap-2">
              {periods.map(p => (
                <button key={p.id} onClick={() => toggleArrayFilter('period_ids', p.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background: filters.period_ids.includes(p.id) ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: filters.period_ids.includes(p.id) ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${filters.period_ids.includes(p.id) ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                  }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Criteria */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><ListChecks size={15} /> معیارها</label>
            <div className="flex flex-wrap gap-2">
              {criteria.map(c => (
                <button key={c.id} onClick={() => toggleArrayFilter('criteria_ids', c.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background: filters.criteria_ids.includes(c.id) ? 'var(--accent-info)' : 'var(--bg-tertiary)',
                    color: filters.criteria_ids.includes(c.id) ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${filters.criteria_ids.includes(c.id) ? 'var(--accent-info)' : 'var(--border-primary)'}`,
                  }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range (Jalali) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}><CalendarDays size={15} /> بازه تاریخ شروع دوره (شمسی)</label>
            <div className="grid grid-cols-2 gap-4">
              <JalaliDatePicker value={filters.date_from} onChange={v => setFilters(prev => ({ ...prev, date_from: v }))} placeholder="از تاریخ — ۱۴۰۴/۰۱/۰۱" />
              <JalaliDatePicker value={filters.date_to} onChange={v => setFilters(prev => ({ ...prev, date_to: v }))} placeholder="تا تاریخ — ۱۴۰۵/۱۲/۲۹" />
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>دوره‌هایی که تاریخ شروعشان در این بازه است گزارش می‌شوند</div>
          </div>

          {/* Score Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>حداقل نمره</label>
              <input type="number" min={0} max={100} className="w-full p-3 text-sm rounded-xl" placeholder="0" value={filters.min_score ?? ''} onChange={e => setFilters({ ...filters, min_score: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>حداکثر نمره</label>
              <input type="number" min={0} max={100} className="w-full p-3 text-sm rounded-xl" placeholder="100" value={filters.max_score ?? ''} onChange={e => setFilters({ ...filters, max_score: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={generate} disabled={generating} className="premium-btn btn-primary flex-1 justify-center">
              {generating ? 'در حال تولید...' : (<><Filter size={15} /> تولید گزارش</>)}
            </button>
            <button onClick={exportExcel} disabled={exporting || !report} className="premium-btn btn-ghost justify-center" title="خروجی اکسل از گزارش فعلی">
              {exporting ? 'در حال تهیه...' : (<><Download size={15} /> خروجی اکسل</>)}
            </button>
            <button onClick={clearFilters} className="premium-btn btn-ghost">پاک کردن فیلترها</button>
          </div>
          {exportMsg && <div className="text-xs font-bold" style={{ color: 'var(--accent-success)' }}>{exportMsg}</div>}
        </div>

        {/* Report Results */}
        {report && (
          <div className="premium-card p-6 animate-slideUp">
            <h2 className="flex items-center gap-2 font-bold text-lg mb-5" style={{ color: 'var(--text-primary)' }}><span className="card-header-icon"><BarChart3 size={14} /></span> نتیجه گزارش</h2>

            {/* Summary */}
            {report.summary && (
              <div className="grid grid-cols-4 gap-4 mb-6 stagger-children">
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--accent-primary-light)' }}>
                  <div className="text-2xl font-black" style={{ color: 'var(--accent-primary)' }}>{report.summary.total_employees}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>کارمند</div>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--accent-success-light)' }}>
                  <div className="text-2xl font-black" style={{ color: 'var(--accent-success)' }}>{report.summary.avg_score}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>میانگین</div>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--accent-info-light)' }}>
                  <div className="text-2xl font-black" style={{ color: 'var(--accent-info)' }}>{report.summary.total_records}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>رکورد</div>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--accent-warning-light)' }}>
                  <div className="text-2xl font-black" style={{ color: 'var(--accent-warning)' }}>{report.summary.min_score} — {report.summary.max_score}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>بازه نمرات</div>
                </div>
              </div>
            )}

            {/* Employee Details */}
            <div className="space-y-4">
              {(report.employees || []).map((emp: any) => (
                <div key={emp.employee_id} className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-bold text-sm">{emp.employee_name}</span>
                      <span className="badge badge-primary mr-2">{emp.team_name}</span>
                    </div>
                  </div>
                  {emp.periods.map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-4 p-3 rounded-lg mb-2" style={{ background: 'var(--bg-card)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>{p.period_name}</span>
                      <div className="flex-1">
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-primary)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(p.final_score || 0, 100)}%`,
                            background: (p.final_score || 0) >= 70 ? 'var(--accent-success)' : (p.final_score || 0) >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)',
                          }} />
                        </div>
                      </div>
                      <span className="font-black text-sm" style={{
                        color: (p.final_score || 0) >= 70 ? 'var(--accent-success)' : (p.final_score || 0) >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)',
                      }}>
                        {p.final_score ?? '-'}
                      </span>
                      {p.self_evaluation && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-info-light)', color: 'var(--accent-info)' }}>
                          خودارزیابی: {p.self_evaluation.self_score}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
