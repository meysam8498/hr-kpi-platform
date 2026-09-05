'use client'

import { useEffect, useState } from 'react'
import { IdCard, Plus, Upload, Pencil, ArrowLeftRight, Archive, Trash2, RotateCcw, UserRound, Package } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { employeesApi, teamsApi } from '@/lib/api'
import type { Employee, Team } from '@/lib/api'
import { gregorianToJalaliStr, jalaliToGregorianStr, toPersianNums } from '@/lib/jalali'
import JalaliDatePicker from '@/components/JalaliDatePicker'

type ViewMode = 'active' | 'archived'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [filterTeam, setFilterTeam] = useState<number>(0)
  const [viewMode, setViewMode] = useState<ViewMode>('active')
  const [loading, setLoading] = useState(true)

  // Modals
  const [showEdit, setShowEdit] = useState<Employee | null>(null)
  const [showTransfer, setShowTransfer] = useState<Employee | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [transferTeamId, setTransferTeamId] = useState<number>(0)
  const [showImport, setShowImport] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [jsonText, setJsonText] = useState('')

  // Form state
  const [form, setForm] = useState({
    employee_code: '', first_name: '', last_name: '',
    position: '', team_id: 0, hire_date: '1404-01-01', phone: '',
  })

  const load = () => {
    const loader = viewMode === 'archived' ? employeesApi.listArchived : employeesApi.list
    const promise = filterTeam ? loader(filterTeam) : loader()
    promise.then(setEmployees).catch(() => setEmployees([]))
  }

  useEffect(() => {
    teamsApi.list().then(setTeams).finally(() => {
      load()
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [viewMode, filterTeam])

  const openCreate = () => {
    setForm({ employee_code: '', first_name: '', last_name: '', position: '', team_id: teams[0]?.id || 1, hire_date: '', phone: '' })
    setShowCreate(true)
  }

  const openEdit = (emp: Employee) => {
    setForm({
      employee_code: emp.employee_code, first_name: emp.first_name, last_name: emp.last_name,
      position: emp.position, team_id: emp.team_id, hire_date: gregorianToJalaliStr(emp.hire_date), phone: emp.phone || '',
    })
    setShowEdit(emp)
  }

  const handleCreate = async () => {
    if (!form.employee_code || !form.first_name || !form.last_name) return
    await employeesApi.create({ ...form, hire_date: jalaliToGregorianStr(form.hire_date), phone: form.phone || undefined })
    setShowCreate(false); load()
  }

  const handleUpdate = async () => {
    if (!showEdit) return
    await employeesApi.update(showEdit.id, { ...form, hire_date: jalaliToGregorianStr(form.hire_date), phone: form.phone || undefined })
    setShowEdit(null); load()
  }

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`آیا "${emp.first_name} ${emp.last_name}" حذف شود؟\nاین عمل غیرقابل بازگشت است.`)) return
    await employeesApi.delete(emp.id); load()
  }

  const handleArchive = async (emp: Employee) => {
    if (!confirm(`"${emp.first_name} ${emp.last_name}" به آرشیو منتقل شود؟`)) return
    await employeesApi.archive(emp.id); load()
  }

  const handleUnarchive = async (emp: Employee) => {
    await employeesApi.unarchive(emp.id); load()
  }

  const handleTransfer = async () => {
    if (!showTransfer || !transferTeamId) return
    await employeesApi.transfer(showTransfer.id, transferTeamId)
    setShowTransfer(null); load()
  }

  const handleImportExcel = async (file: File) => {
    setImportBusy(true)
    setImportMsg(null)
    try {
      const res = await employeesApi.importExcel(file)
      setImportMsg({ type: 'ok', text: `${res.created} کارمند اضافه شد${res.skipped.length ? `، ${res.skipped.length} تکراری` : ''}${res.errors.length ? `، ${res.errors.length} خطا` : ''}` })
      load()
    } catch (e: any) {
      setImportMsg({ type: 'err', text: e.message || 'خطا در وارد کردن فایل' })
    } finally {
      setImportBusy(false)
    }
  }

  const handleImportJson = async () => {
    setImportBusy(true)
    setImportMsg(null)
    try {
      const items = JSON.parse(jsonText)
      if (!Array.isArray(items)) throw new Error('ورودی باید آرایه باشد')
      const res = await employeesApi.importJson(items)
      setImportMsg({ type: 'ok', text: `${res.created} کارمند اضافه شد${res.skipped.length ? `، ${res.skipped.length} تکراری` : ''}${res.errors.length ? `، ${res.errors.length} خطا` : ''}` })
      setJsonText('')
      load()
    } catch (e: any) {
      setImportMsg({ type: 'err', text: e.message || 'JSON نامعتبر است' })
    } finally {
      setImportBusy(false)
    }
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        {/* Page Header */}
          <div className="page-header">
            <div className="flex items-center gap-3">
              <span className="card-header-icon" style={{ width: 40, height: 40, borderRadius: 12 }}>
                <IdCard size={19} />
              </span>
              <div>
                <h1 className="page-title">مدیریت کارمندان</h1>
                <p className="page-subtitle">
                  {viewMode === 'active' ? 'کارمندان فعال شرکت' : 'کارمندان آرشیو شده'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowImport(true)} className="btn btn-outline">
                <Upload size={15} /> ورود گروهی
              </button>
              <button onClick={openCreate} className="btn btn-primary">
                <Plus size={16} /> کارمند جدید
              </button>
            </div>
          </div>

        {/* Tabs + Filter */}
        <div className="flex items-center gap-4 flex-wrap" style={{ marginBottom: 20 }}>
          <div className="tabs">
            <button
              onClick={() => setViewMode('active')}
              className={`tab ${viewMode === 'active' ? 'tab-active' : ''}`}
            >
              فعال ({employees.length})
            </button>
            <button
              onClick={() => setViewMode('archived')}
              className={`tab ${viewMode === 'archived' ? 'tab-active' : ''}`}
            >
              آرشیو
            </button>
          </div>
          <select
            className=""
            style={{ width: 'auto', minWidth: 140 }}
            value={filterTeam}
            onChange={e => setFilterTeam(Number(e.target.value))}
          >
            <option value={0}>همه تیم‌ها</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Employee Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {employees.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ color: 'var(--accent-primary)', opacity: 0.4 }}>
                {viewMode === 'archived' ? <Package size={40} strokeWidth={1.2} /> : <UserRound size={40} strokeWidth={1.2} />}
              </div>
              <div className="empty-state-title">
                {viewMode === 'archived' ? 'هیچ کارمند آرشیو شده‌ای وجود ندارد' : 'هیچ کارمندی یافت نشد'}
              </div>
              <div className="empty-state-desc">
                {viewMode === 'active' && 'برای شروع، یک کارمند جدید اضافه کنید'}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>نام و نام خانوادگی</th>
                    <th>سمت شغلی</th>
                    <th>تیم</th>
                    <th>تاریخ استخدام</th>
                    <th style={{ textAlign: 'center' }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id} style={{ opacity: emp.is_archived ? 0.6 : 1 }}>
                      <td>
                        <span
                          className="badge badge-info"
                          style={{ fontFamily: "'Vazirmatn', monospace", fontSize: '0.65rem' }}
                        >
                          {emp.employee_code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{emp.position}</td>
                      <td>
                        <span className="badge badge-primary">{emp.team_name || '—'}</span>
                      </td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                        {toPersianNums(gregorianToJalaliStr(emp.hire_date))}
                      </td>
                      <td>
                        <div className="flex items-center gap-1" style={{ justifyContent: 'center' }}>
                          {viewMode === 'active' ? (
                            <>
                              <button onClick={() => openEdit(emp)} className="btn btn-ghost btn-sm" title="ویرایش" style={{ padding: '4px 8px', minHeight: 28, fontSize: '0.7rem' }}><Pencil size={12} /> ویرایش</button>
                              <button onClick={() => { setShowTransfer(emp); setTransferTeamId(0) }} className="btn btn-ghost btn-sm" title="انتقال" style={{ padding: '4px 8px', minHeight: 28, fontSize: '0.7rem' }}><ArrowLeftRight size={12} /> انتقال</button>
                              <button onClick={() => handleArchive(emp)} className="btn btn-ghost btn-sm" title="آرشیو" style={{ padding: '4px 8px', minHeight: 28, fontSize: '0.7rem', color: 'var(--accent-warning)' }}><Archive size={12} /> آرشیو</button>
                              <button onClick={() => handleDelete(emp)} className="btn btn-ghost btn-sm" title="حذف" style={{ padding: '4px 8px', minHeight: 28, fontSize: '0.7rem', color: 'var(--accent-danger)' }}><Trash2 size={12} /> حذف</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleUnarchive(emp)} className="btn btn-success btn-sm" style={{ padding: '4px 10px', minHeight: 28, fontSize: '0.7rem' }}><RotateCcw size={12} /> بازگردانی</button>
                              <button onClick={() => handleDelete(emp)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', minHeight: 28, fontSize: '0.7rem', color: 'var(--accent-danger)' }}><Trash2 size={12} /> حذف</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Create/Edit Modal ─── */}
      {(showCreate || showEdit) && (
        <div className="modal-overlay" onClick={() => { setShowCreate(false); setShowEdit(null) }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{showEdit ? 'ویرایش کارمند' : 'کارمند جدید'}</span>
              <button className="modal-close" onClick={() => { setShowCreate(false); setShowEdit(null) }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>کد پرسنلی</label>
                <input placeholder="کد پرسنلی" value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} disabled={!!showEdit} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>نام</label>
                  <input placeholder="نام" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>نام خانوادگی</label>
                  <input placeholder="نام خانوادگی" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>سمت شغلی</label>
                <input placeholder="سمت شغلی" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>تیم</label>
                  <select value={form.team_id} onChange={e => setForm({ ...form, team_id: Number(e.target.value) })}>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>تاریخ استخدام</label>
                  <JalaliDatePicker value={form.hire_date} onChange={v => setForm({ ...form, hire_date: v })} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>تلفن (اختیاری)</label>
                <input placeholder="تلفن" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button onClick={showEdit ? handleUpdate : handleCreate} className="btn btn-primary flex-1 justify-center">
                {showEdit ? 'ذخیره تغییرات' : 'افزودن کارمند'}
              </button>
              <button onClick={() => { setShowCreate(false); setShowEdit(null) }} className="btn btn-ghost">لغو</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Import Modal ─── */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">ورود گروهی کارمندان</span>
              <button className="modal-close" onClick={() => setShowImport(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Excel upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  روش ۱ — فایل اکسل
                </label>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  ستون‌ها: کد پرسنلی | نام | نام خانوادگی | سمت | تیم | تاریخ استخدام (yyyy-mm-dd) | تلفن (اختیاری)
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleImportExcel(f)
                  }}
                  style={{ padding: '10px', border: '1px dashed var(--border-primary)', borderRadius: 10, background: 'var(--bg-tertiary)', width: '100%' }}
                />
              </div>

              {/* JSON paste */}
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  روش ۲ — JSON
                </label>
                <textarea
                  rows={5}
                  value={jsonText}
                  onChange={e => setJsonText(e.target.value)}
                  placeholder='[{"employee_code": "EMP010", "first_name": "علی", "last_name": "محمدی", "position": "کارشناس", "team_id": 1, "hire_date": "2025-01-01", "phone": "0912..."}]'
                />
                <button onClick={handleImportJson} disabled={importBusy || !jsonText.trim()} className="btn btn-primary" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
                  {importBusy ? 'در حال وارد کردن…' : 'وارد کردن JSON'}
                </button>
              </div>

              {importMsg && (
                <div className={importMsg.type === 'ok' ? 'info-box info-box-success' : 'info-box info-box-danger'}>
                  {importMsg.text}
                </div>
              )}
              {importBusy && <div className="spinner" style={{ width: 22, height: 22, margin: '0 auto' }} />}
            </div>
          </div>
        </div>
      )}

      {/* ─── Transfer Modal ─── */}
      {showTransfer && (
        <div className="modal-overlay" onClick={() => setShowTransfer(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">انتقال کارمند</span>
              <button className="modal-close" onClick={() => setShowTransfer(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              انتقال <strong>{showTransfer.first_name} {showTransfer.last_name}</strong> از تیم <strong>{showTransfer.team_name}</strong>
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>تیم مقصد</label>
              <select value={transferTeamId} onChange={e => setTransferTeamId(Number(e.target.value))}>
                <option value={0}>انتخاب تیم مقصد...</option>
                {teams.filter(t => t.id !== showTransfer.team_id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button onClick={handleTransfer} disabled={!transferTeamId} className="btn btn-primary flex-1 justify-center">انتقال</button>
              <button onClick={() => setShowTransfer(null)} className="btn btn-ghost">لغو</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
