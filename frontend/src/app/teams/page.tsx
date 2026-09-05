'use client'

import { useEffect, useState } from 'react'
import { Building2, Plus, X, Pencil, Archive, Trash2, RotateCcw, UserPlus, UsersRound } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { teamsApi, employeesApi } from '@/lib/api'
import { gregorianToJalaliStr, jalaliToGregorianStr, toPersianNums } from '@/lib/jalali'
import JalaliDatePicker from '@/components/JalaliDatePicker'
import type { Team, Employee } from '@/lib/api'

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showEditMember, setShowEditMember] = useState<Employee | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')
  const [loading, setLoading] = useState(true)

  const [mForm, setMForm] = useState({
    employee_code: '', first_name: '', last_name: '',
    position: '', hire_date: '', phone: '',
  })

  const load = () => {
    Promise.all([teamsApi.list(), employeesApi.listAll()]).then(([t, e]) => {
      setTeams(t); setEmployees(e)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const createTeam = async () => {
    if (!newTeamName.trim()) return
    await teamsApi.create({ name: newTeamName, description: newTeamDesc })
    setNewTeamName(''); setNewTeamDesc(''); setShowCreateForm(false); load()
  }

  const deleteTeam = async (id: number, name: string) => {
    if (!confirm(`تیم "${name}" حذف شود؟`)) return
    await teamsApi.delete(id); load()
  }

  const openAddMember = () => {
    setMForm({ employee_code: '', first_name: '', last_name: '', position: '', hire_date: '', phone: '' })
    setShowAddMember(true)
  }

  const openEditMember = (emp: Employee) => {
    setMForm({
      employee_code: emp.employee_code, first_name: emp.first_name, last_name: emp.last_name,
      position: emp.position, hire_date: gregorianToJalaliStr(emp.hire_date), phone: emp.phone || '',
    })
    setShowEditMember(emp)
  }

  const addMember = async () => {
    if (!selectedTeam || !mForm.employee_code || !mForm.first_name || !mForm.last_name) return
    await employeesApi.create({ ...mForm, team_id: selectedTeam, hire_date: jalaliToGregorianStr(mForm.hire_date) || '1400-01-01', phone: mForm.phone || undefined })
    setShowAddMember(false); load()
  }

  const updateMember = async () => {
    if (!showEditMember) return
    await employeesApi.update(showEditMember.id, { ...mForm, hire_date: jalaliToGregorianStr(mForm.hire_date) || '1400-01-01', phone: mForm.phone || undefined })
    setShowEditMember(null); load()
  }

  const removeMember = async (id: number, name: string) => {
    if (!confirm(`"${name}" از تیم حذف شود؟`)) return
    await employeesApi.delete(id); load()
  }

  const archiveMember = async (id: number, name: string) => {
    if (!confirm(`"${name}" به آرشیو منتقل شود؟`)) return
    await employeesApi.archive(id); load()
  }

  const teamEmployees = selectedTeam ? employees.filter(e => e.team_id === selectedTeam && !e.is_archived) : []
  const archivedTeamEmployees = selectedTeam ? employees.filter(e => e.team_id === selectedTeam && e.is_archived) : []

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
        <div className="flex items-center justify-between page-header">
          <div className="flex items-center gap-3">
            <span className="card-header-icon" style={{ width: 40, height: 40, borderRadius: 12 }}>
              <Building2 size={19} />
            </span>
            <div>
              <h1 className="page-title">مدیریت تیم‌ها</h1>
              <p className="page-subtitle">ایجاد، ویرایش و مدیریت اعضای تیم‌ها</p>
            </div>
          </div>
          <button onClick={() => setShowCreateForm(true)} className="btn btn-primary"><Plus size={16} /> تیم جدید</button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, padding: '0 4px' }}>
              لیست تیم‌ها
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {teams.map(team => {
                const isActive = selectedTeam === team.id
                const memberCount = employees.filter(e => e.team_id === team.id && !e.is_archived).length
                return (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeam(team.id)}
                    className="flex items-center gap-3"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: isActive ? 'var(--accent-primary-subtle)' : 'transparent',
                      border: `1.5px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 9,
                        background: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: isActive ? 'white' : 'var(--text-secondary)',
                      }}
                    >
                      <Building2 size={17} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                      }}>
                        {team.name}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                        {toPersianNums(String(memberCount))} عضو فعال
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteTeam(team.id, team.name) }}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 8px', minHeight: 24, fontSize: '0.65rem', color: 'var(--accent-danger)' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Team Members */}
          <div className="lg:col-span-2 card" style={{ padding: 20 }}>
            {!selectedTeam ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ color: 'var(--accent-primary)', opacity: 0.4 }}>
                  <Building2 size={40} strokeWidth={1.2} />
                </div>
                <div className="empty-state-title">یک تیم را انتخاب کنید</div>
                <div className="empty-state-desc">لیست اعضای تیم انتخاب‌شده در اینجا نمایش داده می‌شود</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    اعضای تیم {teams.find(t => t.id === selectedTeam)?.name}
                  </h2>
                  <button onClick={openAddMember} className="btn btn-primary btn-sm"><UserPlus size={13} /> عضو جدید</button>
                </div>

                {teamEmployees.length === 0 && archivedTeamEmployees.length === 0 ? (
                  <div className="empty-state" style={{ padding: 32 }}>
                    <div className="empty-state-icon" style={{ color: 'var(--text-tertiary)', opacity: 0.4 }}>
                      <UsersRound size={40} strokeWidth={1.2} />
                    </div>
                    <div className="empty-state-title">هیچ عضوی ندارد</div>
                    <div className="empty-state-desc">اولین عضو را اضافه کنید</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>کد</th>
                          <th>نام</th>
                          <th>سمت</th>
                          <th>تاریخ استخدام</th>
                          <th>وضعیت</th>
                          <th style={{ textAlign: 'center' }}>عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamEmployees.map(emp => (
                          <tr key={emp.id}>
                            <td>
                              <span className="badge badge-info" style={{ fontFamily: "'Vazirmatn', monospace", fontSize: '0.65rem' }}>
                                {emp.employee_code}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{emp.position}</td>
                            <td style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                              {toPersianNums(gregorianToJalaliStr(emp.hire_date))}
                            </td>
                            <td><span className="badge badge-success">فعال</span></td>
                            <td>
                              <div className="flex items-center gap-1" style={{ justifyContent: 'center' }}>
                                <button onClick={() => openEditMember(emp)} className="btn btn-ghost btn-sm" title="ویرایش" style={{ padding: '4px 8px', minHeight: 28, fontSize: '0.7rem' }}><Pencil size={12} /></button>
                                <button onClick={() => archiveMember(emp.id, `${emp.first_name} ${emp.last_name}`)} className="btn btn-ghost btn-sm" title="آرشیو" style={{ padding: '4px 8px', minHeight: 28, fontSize: '0.7rem', color: 'var(--accent-warning)' }}><Archive size={12} /></button>
                                <button onClick={() => removeMember(emp.id, `${emp.first_name} ${emp.last_name}`)} className="btn btn-ghost btn-sm" title="حذف" style={{ padding: '4px 8px', minHeight: 28, fontSize: '0.7rem', color: 'var(--accent-danger)' }}><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {archivedTeamEmployees.map(emp => (
                          <tr key={emp.id} style={{ opacity: 0.5 }}>
                            <td>
                              <span className="badge badge-info" style={{ fontFamily: "'Vazirmatn', monospace", fontSize: '0.65rem' }}>
                                {emp.employee_code}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{emp.position}</td>
                            <td style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                              {toPersianNums(gregorianToJalaliStr(emp.hire_date))}
                            </td>
                            <td><span className="badge badge-warning">آرشیو</span></td>
                            <td>
                              <div className="flex items-center gap-1" style={{ justifyContent: 'center' }}>
                                <button onClick={() => { employeesApi.unarchive(emp.id).then(load) }} className="btn btn-success btn-sm" style={{ padding: '4px 10px', minHeight: 28, fontSize: '0.7rem' }}><RotateCcw size={12} /> بازگردانی</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Create Team Modal ─── */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">تیم جدید</span>
              <button className="modal-close" onClick={() => setShowCreateForm(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>نام تیم</label>
                <input placeholder="نام تیم" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>توضیحات (اختیاری)</label>
                <input placeholder="توضیحات" value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button onClick={createTeam} className="btn btn-primary flex-1 justify-center">ایجاد تیم</button>
              <button onClick={() => setShowCreateForm(false)} className="btn btn-ghost">لغو</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add/Edit Member Modal ─── */}
      {(showAddMember || showEditMember) && selectedTeam && (
        <div className="modal-overlay" onClick={() => { setShowAddMember(false); setShowEditMember(null) }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{showEditMember ? 'ویرایش عضو' : 'افزودن عضو جدید'}</span>
              <button className="modal-close" onClick={() => { setShowAddMember(false); setShowEditMember(null) }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>کد پرسنلی</label>
                <input placeholder="کد پرسنلی" value={mForm.employee_code} onChange={e => setMForm({ ...mForm, employee_code: e.target.value })} disabled={!!showEditMember} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>نام</label>
                  <input placeholder="نام" value={mForm.first_name} onChange={e => setMForm({ ...mForm, first_name: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>نام خانوادگی</label>
                  <input placeholder="نام خانوادگی" value={mForm.last_name} onChange={e => setMForm({ ...mForm, last_name: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>سمت شغلی</label>
                <input placeholder="سمت شغلی" value={mForm.position} onChange={e => setMForm({ ...mForm, position: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>تاریخ استخدام</label>
                  <JalaliDatePicker value={mForm.hire_date} onChange={v => setMForm({ ...mForm, hire_date: v })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>تلفن (اختیاری)</label>
                  <input placeholder="تلفن" value={mForm.phone} onChange={e => setMForm({ ...mForm, phone: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button onClick={showEditMember ? updateMember : addMember} className="btn btn-primary flex-1 justify-center">
                {showEditMember ? 'ذخیره تغییرات' : 'افزودن عضو'}
              </button>
              <button onClick={() => { setShowAddMember(false); setShowEditMember(null) }} className="btn btn-ghost">لغو</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
