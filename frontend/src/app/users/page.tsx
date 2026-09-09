'use client'

/**
 * User management (admin) — create accounts, assign roles/teams,
 * reset passwords, activate/deactivate, delete.
 */
import { useEffect, useState } from 'react'
import { UserCog, Plus, Trash2, KeyRound, ShieldCheck, Pencil, X } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { authUsersApi, teamsApi, employeesApi } from '@/lib/api'
import type { Team, Employee } from '@/lib/api'
import { useAuth, ROLE_LABELS } from '@/lib/auth-context'
import { Avatar, EmptyState, TableSkeleton } from '@/components/ui'
import SearchBox, { matchesQuery } from '@/components/SearchBox'
import { useToast } from '@/components/Toast'
import { toPersianNums } from '@/lib/jalali'

interface UserRow {
  id: number
  username: string
  full_name: string
  role: 'admin' | 'hr' | 'manager' | 'employee'
  team_id: number | null
  employee_id: number | null
  is_active: boolean
  managed_team_ids: number[]
  extra_employee_ids: number[]
}

const ROLE_ORDER = ['admin', 'hr', 'manager', 'employee'] as const

/**
 * PermissionPicker — tick-based grant list (teams or employees) with its own
 * filter box, so finding one of 55 employees takes two keystrokes.
 */
function PermissionPicker({
  title, hint, options, selected, onChange, labelOf,
}: {
  title: string
  hint: string
  options: { id: number }[]
  selected: number[]
  onChange: (ids: number[]) => void
  labelOf: (o: { id: number }) => string
}) {
  const [q, setQ] = useState('')
  const filtered = options.filter(o => matchesQuery([labelOf(o)], q))
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  return (
    <div className="rounded-xl p-3" style={{ border: '1px solid var(--border-primary)', background: 'var(--surface-2)' }}>
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
        <div>
          <span className="text-xs font-bold">{title}</span>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="فیلتر…" width={140} />
          {selected.length > 0 && (
            <span className="badge badge-primary">{selected.length} انتخاب</span>
          )}
        </div>
      </div>
      <div style={{ maxHeight: 150, overflowY: 'auto' }} className="space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs p-2" style={{ color: 'var(--text-tertiary)' }}>موردی یافت نشد</p>
        ) : filtered.map(o => (
          <label
            key={o.id}
            className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-xs"
            style={{ background: selected.includes(o.id) ? 'var(--surface-3)' : 'transparent' }}
          >
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() => toggle(o.id)}
              style={{ accentColor: 'var(--accent-primary)', width: 14, height: 14 }}
            />
            <span>{labelOf(o)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<UserRow[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  // Create form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRow['role']>('employee')
  const [teamId, setTeamId] = useState<number | 0>(0)
  const [employeeId, setEmployeeId] = useState<number | 0>(0)
  const [permTeams, setPermTeams] = useState<number[]>([])
  const [permEmployees, setPermEmployees] = useState<number[]>([])

  // Edit modal
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editRole, setEditRole] = useState<UserRow['role']>('employee')
  const [editTeamId, setEditTeamId] = useState<number | 0>(0)
  const [editPassword, setEditPassword] = useState('')
  const [editPermTeams, setEditPermTeams] = useState<number[]>([])
  const [editPermEmployees, setEditPermEmployees] = useState<number[]>([])

  const load = () => {
    Promise.all([authUsersApi.list(), teamsApi.list(), employeesApi.list()])
      .then(([u, t, e]) => { setUsers(u); setTeams(t); setEmployees(e) })
      .catch(() => toast.error('خطا در دریافت کاربران'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!username || !password || !fullName) return
    try {
      await authUsersApi.create({
        username, password, full_name: fullName, role,
        team_id: teamId || null,
        employee_id: employeeId || null,
        managed_team_ids: permTeams,
        extra_employee_ids: permEmployees,
      })
      toast.success(`کاربر «${fullName}» ساخته شد`)
      setUsername(''); setPassword(''); setFullName('')
      setTeamId(0); setEmployeeId(0); setShowForm(false)
      setPermTeams([]); setPermEmployees([])
      load()
    } catch (e: any) {
      toast.error(e.message || 'خطا در ساخت کاربر')
    }
  }

  const openEdit = (u: UserRow) => {
    setEditUser(u); setEditFullName(u.full_name); setEditRole(u.role)
    setEditTeamId(u.team_id || 0); setEditPassword('')
    setEditPermTeams(u.managed_team_ids || [])
    setEditPermEmployees(u.extra_employee_ids || [])
  }

  const saveEdit = async () => {
    if (!editUser) return
    try {
      await authUsersApi.update(editUser.id, {
        full_name: editFullName,
        role: editRole,
        team_id: editTeamId || null,
        managed_team_ids: editPermTeams,
        extra_employee_ids: editPermEmployees,
        ...(editPassword ? { password: editPassword } : {}),
      })
      toast.success('تغییرات ذخیره شد')
      setEditUser(null); load()
    } catch (e: any) {
      toast.error(e.message || 'خطا در ذخیره')
    }
  }

  const toggleActive = async (u: UserRow) => {
    try {
      await authUsersApi.update(u.id, { is_active: !u.is_active })
      load()
    } catch (e: any) { toast.error(e.message || 'خطا') }
  }

  const remove = async (u: UserRow) => {
    if (!confirm(`کاربر «${u.full_name}» حذف شود؟`)) return
    try {
      await authUsersApi.remove(u.id)
      toast.success('کاربر حذف شد')
      load()
    } catch (e: any) { toast.error(e.message || 'خطا در حذف') }
  }

  const teamName = (id: number | null) => teams.find(t => t.id === id)?.name || '—'

  /** Compact summary of tick-granted teams + extra employees. */
  const permSummary = (u: UserRow) => {
    const tCount = (u.managed_team_ids || []).length
    const eCount = (u.extra_employee_ids || []).length
    if (tCount === 0 && eCount === 0) return null
    const names = (u.managed_team_ids || [])
      .map(id => teams.find(t => t.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join('، ')
    return (
      <div style={{ fontSize: '0.68rem', lineHeight: 1.9 }}>
        {tCount > 0 && (
          <span className="badge badge-primary" style={{ marginLeft: 4 }} title={names}>
            {toPersianNums(String(tCount))} تیم
          </span>
        )}
        {eCount > 0 && (
          <span className="badge badge-info">
            {toPersianNums(String(eCount))} کارمند
          </span>
        )}
        {names && (
          <div style={{ color: 'var(--text-tertiary)', marginTop: 2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {names}{tCount > 2 ? ' و…' : ''}
          </div>
        )}
      </div>
    )
  }

  const roleBadge = (r: UserRow['role']) => {
    const map = {
      admin: 'badge-danger', hr: 'badge-info', manager: 'badge-primary', employee: 'badge-success',
    } as const
    return <span className={`badge ${map[r]}`}>{ROLE_LABELS[r]}</span>
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <UserCog size={21} />
            </span>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>مدیریت کاربران</h1>
              <p className="page-subtitle">ساخت حساب کاربری و تعیین سطح دسترسی — مدیر سیستم به همه‌چیز و مدیر منابع انسانی به همه گزارش‌ها دسترسی دارد</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="premium-btn btn-primary">
            <Plus size={15} /> کاربر جدید
          </button>
        </div>

        {showForm && (
          <div className="premium-card p-6 animate-slideUp">
            <h2 className="font-bold mb-4">حساب جدید</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>نام و نام خانوادگی</label>
                <input className="w-full p-2.5 text-sm rounded-xl" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="مثلاً علی رضایی" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>نام کاربری</label>
                <input className="w-full p-2.5 text-sm rounded-xl" value={username} onChange={e => setUsername(e.target.value)} placeholder="مثلاً ali.rezaei" style={{ direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>رمز عبور</label>
                <input type="password" className="w-full p-2.5 text-sm rounded-xl" value={password} onChange={e => setPassword(e.target.value)} style={{ direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>سطح دسترسی</label>
                <select className="w-full p-2.5 text-sm rounded-xl" value={role} onChange={e => setRole(e.target.value as UserRow['role'])}>
                  {ROLE_ORDER.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {(role === 'manager' || role === 'employee') && (
                <>
                  <div>
                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>تیم</label>
                    <select className="w-full p-2.5 text-sm rounded-xl" value={teamId} onChange={e => setTeamId(Number(e.target.value))}>
                      <option value={0}>انتخاب تیم...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  {role === 'employee' && (
                    <div>
                      <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>پرونده کارمندی</label>
                      <select className="w-full p-2.5 text-sm rounded-xl" value={employeeId} onChange={e => setEmployeeId(Number(e.target.value))}>
                        <option value={0}>انتخاب کارمند...</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
              مدیر تیم فقط تیم خودش را می‌بیند و امتیازدهی به اعضای همان تیم را انجام می‌دهد؛ کارمند فقط اطلاعات خودش را می‌بیند.
            </p>
            {(role === 'manager' || role === 'employee' || role === 'hr') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <PermissionPicker
                  title="تیم‌های تحت مدیریت"
                  hint="با تیک زدن، اجازه امتیازدهی و مشاهده اعضای این تیم‌ها را بده (برای افرادی که چند تیم را اداره می‌کنند)"
                  options={teams}
                  selected={permTeams}
                  onChange={setPermTeams}
                  labelOf={t => (t as Team).name}
                />
                <PermissionPicker
                  title="کارمندان خاص"
                  hint="با تیک زدن، اجازه امتیازدهی به این کارمندان خاص (خارج از تیم) یا مشاهده پرونده خودِ کاربر را بده"
                  options={employees}
                  selected={permEmployees}
                  onChange={setPermEmployees}
                  labelOf={e => `${(e as Employee).first_name} ${(e as Employee).last_name} (${(e as Employee).employee_code})`}
                />
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={create} disabled={!username || !password || !fullName} className="premium-btn btn-success">ایجاد کاربر</button>
              <button onClick={() => setShowForm(false)} className="premium-btn btn-ghost">لغو</button>
            </div>
          </div>
        )}

        <div className="premium-card overflow-hidden">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
            <SearchBox value={search} onChange={setSearch} placeholder="نام، نام کاربری، نقش یا تیم…" width={240} />
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {users.filter(u => matchesQuery([
                u.username, u.full_name, u.role,
                teams.find(t => t.id === u.team_id)?.name,
                employees.find(e => e.id === u.employee_id)?.employee_code,
              ], search)).length} از {users.length} کاربر
            </span>
          </div>
          {loading ? (
            <div className="p-6"><TableSkeleton rows={5} cols={5} /></div>
          ) : users.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={UserCog} title="هنوز کاربری ساخته نشده" description="اولین حساب کاربری را بسازید." />
            </div>
          ) : (
            <table className="premium-table">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>نام کاربری</th>
                  <th>سطح دسترسی</th>
                  <th>مجوزهای تیک‌خورده</th>
                  <th>تیم</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => matchesQuery([
                  u.username, u.full_name, u.role,
                  teams.find(t => t.id === u.team_id)?.name,
                  employees.find(e => e.id === u.employee_id)?.employee_code,
                ], search)).map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.full_name} size={32} />
                        <span className="font-bold">{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ direction: 'ltr', textAlign: 'right', fontFamily: "'Vazirmatn', monospace", color: 'var(--text-secondary)' }}>
                      {u.username}
                    </td>
                    <td>{roleBadge(u.role)}</td>
                    <td>{permSummary(u) || <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>—</span>}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{teamName(u.team_id)}</td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="premium-btn btn-ghost text-xs py-1 px-2" title="ویرایش">
                          <Pencil size={13} />
                        </button>
                        {u.username !== 'admin' && u.id !== me?.id && (
                          <>
                            <button
                              onClick={() => toggleActive(u)}
                              className="premium-btn btn-ghost text-xs py-1 px-2"
                              title={u.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                              style={{ color: u.is_active ? 'var(--accent-warning)' : 'var(--accent-success)' }}
                            >
                              <ShieldCheck size={13} />
                            </button>
                            <button
                              onClick={() => remove(u)}
                              className="premium-btn btn-ghost text-xs py-1 px-2" title="حذف"
                              style={{ color: 'var(--accent-danger)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
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

      {/* Edit modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><KeyRound size={17} /> ویرایش کاربر</h3>
              <button className="modal-close" onClick={() => setEditUser(null)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>نام و نام خانوادگی</label>
                <input className="w-full p-2.5 text-sm rounded-xl" value={editFullName} onChange={e => setEditFullName(e.target.value)} />
              </div>
              {editUser.username !== 'admin' && (
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>سطح دسترسی</label>
                  <select className="w-full p-2.5 text-sm rounded-xl" value={editRole} onChange={e => setEditRole(e.target.value as UserRow['role'])}>
                    {ROLE_ORDER.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
              )}
              {(editRole === 'manager' || editRole === 'employee') && (
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>تیم</label>
                  <select className="w-full p-2.5 text-sm rounded-xl" value={editTeamId} onChange={e => setEditTeamId(Number(e.target.value))}>
                    <option value={0}>انتخاب تیم...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  رمز عبور جدید <span style={{ fontWeight: 400 }}>(خالی = بدون تغییر)</span>
                </label>
                <input type="password" className="w-full p-2.5 text-sm rounded-xl" value={editPassword} onChange={e => setEditPassword(e.target.value)} style={{ direction: 'ltr', textAlign: 'right' }} />
              </div>
              {(editRole === 'manager' || editRole === 'employee' || editRole === 'hr') && (
                <div className="grid grid-cols-1 gap-3">
                  <PermissionPicker
                    title="تیم‌های تحت مدیریت"
                    hint="تیک = اجازه امتیازدهی و مشاهده اعضای آن تیم"
                    options={teams}
                    selected={editPermTeams}
                    onChange={setEditPermTeams}
                    labelOf={t => (t as Team).name}
                  />
                  <PermissionPicker
                    title="کارمندان خاص"
                    hint="تیک = اجازه امتیازدهی یا مشاهده آن کارمند خاص"
                    options={employees}
                    selected={editPermEmployees}
                    onChange={setEditPermEmployees}
                    labelOf={e => `${(e as Employee).first_name} ${(e as Employee).last_name} (${(e as Employee).employee_code})`}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveEdit} className="premium-btn btn-primary flex-1 justify-center">ذخیره</button>
              <button onClick={() => setEditUser(null)} className="premium-btn btn-ghost">لغو</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
