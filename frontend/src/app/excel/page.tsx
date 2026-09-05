'use client'

import { useEffect, useState, useRef } from 'react'
import { FileSpreadsheet, FileDown, FileUp, Download, Upload, Loader2, Info, XCircle, CheckCircle2, Clock } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { teamsApi, kpiApi } from '@/lib/api'
import type { Team, ReportingPeriod } from '@/lib/api'

export default function ExcelPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [selectedTeam, setSelectedTeam] = useState<number>(0)
  const [selectedPeriod, setSelectedPeriod] = useState<number>(0)
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null)
  const [importing, setImporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([teamsApi.list(), kpiApi.listPeriods()]).then(([t, p]) => {
      setTeams(t); setPeriods(p)
      const active = p.find(x => x.is_active)
      if (active) setSelectedPeriod(active.id)
      if (t.length > 0) setSelectedTeam(t[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const handleExport = () => {
    if (!selectedTeam || !selectedPeriod) return
    window.open(kpiApi.exportExcel(selectedTeam, selectedPeriod), '_blank')
  }

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || !selectedTeam || !selectedPeriod) return
    setImporting(true); setImportResult(null)
    try {
      const result = await kpiApi.importExcel(selectedTeam, selectedPeriod, file)
      setImportResult(result)
    } catch { setImportResult({ error: 'خطا در آپلود فایل' }) }
    finally { setImporting(false) }
  }

  if (loading) return <AppLayout><div className="flex items-center justify-center py-32"><div className="inline-block w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'transparent' }} /></div></AppLayout>

  const teamName = teams.find(t => t.id === selectedTeam)?.name || ''
  const periodName = periods.find(p => p.id === selectedPeriod)?.name || ''

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <FileSpreadsheet size={21} />
          </span>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>خروجی و ورودی اکسل</h1>
            <p className="page-subtitle">دانلود فرم امتیازدهی و آپلود نتایج تکمیل‌شده</p>
          </div>
        </div>

        {/* Selectors */}
        <div className="premium-card p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>انتخاب تیم</label>
              <select className="w-full p-3 text-sm rounded-xl" value={selectedTeam} onChange={e => setSelectedTeam(Number(e.target.value))}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.member_count} عضو)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>انتخاب دوره</label>
              <select className="w-full p-3 text-sm rounded-xl" value={selectedPeriod} onChange={e => setSelectedPeriod(Number(e.target.value))}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name} {p.is_active ? '(فعال)' : ''}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
          {/* Export */}
          <div className="premium-card p-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-primary-light)', color: 'var(--accent-primary)' }}>
              <FileDown size={24} />
            </div>
            <h2 className="font-bold text-lg mb-2">دانلود فرم امتیازدهی</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              فایل اکسل حاوی اعضای تیم <strong>{teamName}</strong> برای دوره <strong>{periodName}</strong>
            </p>
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm mb-5" style={{ background: 'var(--accent-info-light)', color: 'var(--accent-info)' }}>
              <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>فایل دانلود شده را به مدیر تیم بدهید تا نمرات را وارد کند</span>
            </div>
            <button onClick={handleExport} disabled={!selectedTeam || !selectedPeriod}
              className="premium-btn btn-primary w-full justify-center">
              <Download size={15} /> دانلود فایل اکسل
            </button>
          </div>

          {/* Import */}
          <div className="premium-card p-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-success-light)', color: 'var(--accent-success)' }}>
              <FileUp size={24} />
            </div>
            <h2 className="font-bold text-lg mb-2">آپلود فایل تکمیل‌شده</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              فایل اکسل پر‌شده را آپلود کنید تا نمرات ثبت شوند
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls"
              className="w-full p-4 rounded-xl text-sm mb-4 file:ml-4 file:py-2 file:px-5 file:rounded-xl file:border-0 file:font-bold file:cursor-pointer"
              style={{ background: 'var(--bg-input)', border: '2px dashed var(--border-primary)' }} />
            <button onClick={handleImport} disabled={!selectedTeam || !selectedPeriod || importing}
              className="premium-btn btn-success w-full justify-center">
              {importing ? (<><Loader2 size={15} className="animate-spin" /> در حال آپلود...</>) : (<><Upload size={15} /> آپلود و ثبت نمرات</>)}
            </button>
            {importResult && (
              <div className="mt-4 p-4 rounded-xl text-sm animate-fadeIn"
                style={{ background: (importResult as any).error ? 'var(--accent-danger-light)' : 'var(--accent-success-light)', color: (importResult as any).error ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                {(importResult as any).error
                  ? <p className="flex items-center gap-2"><XCircle size={15} /> {(importResult as any).error}</p>
                  : <>
                    <p className="flex items-center gap-2"><CheckCircle2 size={15} /> {String(importResult.imported)} نمره ثبت شد</p>
                    {Number(importResult.skipped) > 0 && <p className="mt-1 flex items-center gap-2"><Clock size={14} /> {String(importResult.skipped)} سلول خالی رد شد</p>}
                  </>
                }
              </div>
            )}
          </div>
        </div>

        {/* Guide */}
        <div className="premium-card p-6" style={{ background: 'var(--accent-warning-light)', border: '1.5px solid var(--accent-warning)' }}>
          <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-warning)' }}><Info size={16} /> راهنمای استفاده</h3>
          <ol className="text-sm space-y-2 list-decimal list-inside" style={{ color: 'var(--text-primary)' }}>
            <li>تیم و دوره مورد نظر را انتخاب کنید</li>
            <li>روی «دانلود فایل اکسل» کلیک کنید</li>
            <li>فایل را به مدیر تیم بدهید تا نمرات (۰ تا ۱۰۰) را وارد کند</li>
            <li>فایل تکمیل‌شده را از بخش «آپلود» به سیستم برگردانید</li>
            <li>سیستم نمرات را خودکار ثبت و محاسبه می‌کند</li>
          </ol>
        </div>
      </div>
    </AppLayout>
  )
}
