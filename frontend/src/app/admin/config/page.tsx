'use client'

import { useEffect, useState } from 'react'
import { Settings2, ClipboardList, Dna, Scale, Trash2, Plus, Save } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { teamsApi, kpiApi } from '@/lib/api'
import type { Team, KPICriterion, TeamKPIConfig } from '@/lib/api'
import { HelpHint } from '@/components/ui'

export default function KPIConfigPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [criteria, setCriteria] = useState<KPICriterion[]>([])
  const [teamConfigs, setTeamConfigs] = useState<TeamKPIConfig[]>([])
  const [selectedTeam, setSelectedTeam] = useState<number>(0)
  const [showAddCriteria, setShowAddCriteria] = useState(false)
  const [newCritName, setNewCritName] = useState('')
  const [newCritDesc, setNewCritDesc] = useState('')
  const [newCritCat, setNewCritCat] = useState('common')
  const [addCritId, setAddCritId] = useState<number>(0)
  const [addWeight, setAddWeight] = useState<number>(20)
  const [loading, setLoading] = useState(true)

  // Score blend (peer-review + goal achievement weights)
  const [blend, setBlend] = useState<{ base_weight: number; peer_weight: number; goal_weight: number } | null>(null)
  const [blendMsg, setBlendMsg] = useState<string>('')

  const load = () => {
    Promise.all([teamsApi.list(), kpiApi.listCriteria()]).then(([t, c]) => {
      setTeams(t); setCriteria(c)
      if (t.length > 0) setSelectedTeam(t[0].id)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (selectedTeam) { kpiApi.teamConfig(selectedTeam).then(setTeamConfigs); loadBlend(selectedTeam) } }, [selectedTeam])

  const loadBlend = (teamId: number) => {
    kpiApi.getTeamBlend(teamId).then(b => setBlend({ base_weight: b.base_weight, peer_weight: b.peer_weight, goal_weight: b.goal_weight })).catch(() => setBlend(null))
  }

  const saveBlend = async () => {
    if (!selectedTeam || !blend) return
    try {
      await kpiApi.setTeamBlend(selectedTeam, { base_weight: blend.base_weight, peer_weight: blend.peer_weight, goal_weight: blend.goal_weight })
      setBlendMsg('ترکیب نمره ذخیره شد — نمرات نهایی بعد از محاسبه مجدد به‌روز می‌شوند')
      loadBlend(selectedTeam)
    } catch (e: any) {
      setBlendMsg(e.detail || e.message || 'خطا در ذخیره')
    }
  }

  const blendSum = blend ? blend.base_weight + blend.peer_weight + blend.goal_weight : 1

  const createCriteria = async () => {
    if (!newCritName.trim()) return
    await kpiApi.createCriteria({ name: newCritName, description: newCritDesc, category: newCritCat })
    setNewCritName(''); setNewCritDesc(''); setShowAddCriteria(false); load()
  }
  const deleteCriteria = async (id: number) => {
    if (!confirm('این معیار غیرفعال شود؟')) return
    await kpiApi.deleteCriteria(id); load()
  }
  const addToTeam = async () => {
    if (!selectedTeam || !addCritId) return
    await kpiApi.addTeamConfig(selectedTeam, { criterion_id: addCritId, weight: addWeight })
    kpiApi.teamConfig(selectedTeam).then(setTeamConfigs); setAddCritId(0)
  }
  const removeFromTeam = async (configId: number) => {
    if (!selectedTeam) return
    await kpiApi.removeTeamConfig(selectedTeam, configId)
    kpiApi.teamConfig(selectedTeam).then(setTeamConfigs)
  }

  const totalWeight = teamConfigs.reduce((sum, c) => sum + c.weight, 0)

  if (loading) return <AppLayout><div className="flex items-center justify-center py-32"><div className="inline-block w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'transparent' }} /></div></AppLayout>

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <Settings2 size={21} />
          </span>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>تنظیمات KPI</h1>
            <p className="page-subtitle">مدیریت معیارها و وزن‌دهی برای هر تیم</p>
          </div>
        </div>

        {/* Criteria */}
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold flex items-center gap-2"><ClipboardList size={16} /> معیارهای KPI</h2>
            <button onClick={() => setShowAddCriteria(!showAddCriteria)} className="premium-btn btn-primary text-sm">
              <Plus size={14} /> معیار جدید
            </button>
          </div>
          {showAddCriteria && (
            <div className="p-4 rounded-xl mb-5 space-y-3 animate-slideUp" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
              <input className="w-full p-3 text-sm" placeholder="نام معیار" value={newCritName} onChange={e => setNewCritName(e.target.value)} />
              <input className="w-full p-3 text-sm" placeholder="توضیحات" value={newCritDesc} onChange={e => setNewCritDesc(e.target.value)} />
              <select className="w-full p-3 text-sm" value={newCritCat} onChange={e => setNewCritCat(e.target.value)}>
                <option value="common">مشترک (همه تیم‌ها)</option>
                <option value="team_specific">تخصصی (تیم خاص)</option>
              </select>
              <div className="flex gap-3">
                <button onClick={createCriteria} className="premium-btn btn-success">ذخیره</button>
                <button onClick={() => setShowAddCriteria(false)} className="premium-btn btn-ghost">لغو</button>
              </div>
            </div>
          )}
          <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border-primary)' }}>
            <table className="premium-table">
              <thead>
                <tr><th>نام معیار</th><th>دسته‌بندی</th><th>بازه نمره</th><th>وضعیت</th><th>عملیات</th></tr>
              </thead>
              <tbody>
                {criteria.map(c => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.name}</td>
                    <td><span className={`badge ${c.category === 'common' ? 'badge-primary' : 'badge-info'}`}>{c.category === 'common' ? 'مشترک' : 'تخصصی'}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.min_score} — {c.max_score}</td>
                    <td><span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>{c.is_active ? 'فعال' : 'غیرفعال'}</span></td>
                    <td>
                      <button onClick={() => deleteCriteria(c.id)} className="premium-btn btn-ghost text-xs py-1 px-2" title="حذف" style={{ color: 'var(--accent-danger)' }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Final Score Blend */}
        <div className="premium-card p-6">
          <h2 className="font-bold mb-5 flex items-center gap-2"><Dna size={17} /> ترکیب نمره نهایی (نمره مدیر + ارزیابی ۳۶۰ + اهداف)</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            نمره نهایی هر کارمند از ترکیب سه بخش ساخته می‌شود. فقط بخش‌هایی که داده دارند در محاسبه وارد می‌شوند و وزن‌ها به‌صورت خودکار نرمال می‌شوند.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>نمره مدیر (KPI)</label>
              <input type="number" min={0} max={100} className="w-full p-2.5 text-sm rounded-xl" value={blend ? Math.round(blend.base_weight * 100) : 70}
                onChange={e => setBlend({ ...(blend as any), base_weight: Number(e.target.value) / 100 })} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>ارزیابی ۳۶۰ (همکاران)</label>
              <input type="number" min={0} max={100} className="w-full p-2.5 text-sm rounded-xl" value={blend ? Math.round(blend.peer_weight * 100) : 15}
                onChange={e => setBlend({ ...(blend as any), peer_weight: Number(e.target.value) / 100 })} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>تحقق اهداف</label>
              <input type="number" min={0} max={100} className="w-full p-2.5 text-sm rounded-xl" value={blend ? Math.round(blend.goal_weight * 100) : 15}
                onChange={e => setBlend({ ...(blend as any), goal_weight: Number(e.target.value) / 100 })} />
            </div>
          </div>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>مجموع:</span>
            <span className="font-black" style={{ color: Math.abs(blendSum - 1) < 0.01 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
              {Math.round(blendSum * 100)}%
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>(وزن‌ها هنگام ذخیره به‌صورت خودکار به ۱۰۰٪ نرمال می‌شوند)</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveBlend} className="premium-btn btn-primary">ذخیره ترکیب</button>
            {blendMsg && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{blendMsg}</span>}
          </div>
        </div>

        {/* Weight Config */}
        <div className="premium-card p-6">
          <h2 className="font-bold mb-5 flex items-center gap-2"><Scale size={17} /> وزن‌دهی معیارها</h2>
          <div className="flex gap-3 items-end mb-5 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>تیم</label>
              <select className="w-full p-2.5 text-sm rounded-xl" value={selectedTeam} onChange={e => setSelectedTeam(Number(e.target.value))}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>معیار</label>
              <select className="w-full p-2.5 text-sm rounded-xl" value={addCritId} onChange={e => setAddCritId(Number(e.target.value))}>
                <option value={0}>انتخاب...</option>
                {criteria.filter(c => c.is_active && !teamConfigs.some(tc => tc.criterion_id === c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>وزن % <HelpHint text="اهمیت نسبی این معیار نسبت به بقیه. بعد از ذخیره، همه وزن‌ها خودکار نرمال می‌شوند و نیازی به جمع ۱۰۰ نیست." /></label>
              <input type="number" className="w-full p-2.5 text-sm rounded-xl" value={addWeight} onChange={e => setAddWeight(Number(e.target.value))} min={0} max={100} />
            </div>
            <button onClick={addToTeam} disabled={!addCritId} className="premium-btn btn-success">افزودن</button>
          </div>

          {/* Weight Bar */}
          <div className="mb-5">
            <div className="flex items-center gap-3 text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>مجموع وزن‌ها:</span>
              <span className="font-black" style={{ color: totalWeight === 100 ? 'var(--accent-success)' : totalWeight > 100 ? 'var(--accent-danger)' : 'var(--accent-warning)' }}>
                {totalWeight}%
              </span>
              {totalWeight !== 100 && <span className="text-xs" style={{ color: 'var(--accent-warning)' }}>(توصیه: مجموع = ۱۰۰٪)</span>}
            </div>
            <div className="w-full h-3 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--border-primary)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(totalWeight, 100)}%`, background: totalWeight === 100 ? 'var(--accent-success)' : totalWeight > 100 ? 'var(--accent-danger)' : 'var(--accent-warning)' }} />
            </div>
          </div>

          {teamConfigs.length > 0 && (
            <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border-primary)' }}>
              <table className="premium-table">
                <thead>
                  <tr><th>معیار</th><th>دسته</th><th>وزن</th><th>عملیات</th></tr>
                </thead>
                <tbody>
                  {teamConfigs.map(tc => (
                    <tr key={tc.id}>
                      <td className="font-bold">{tc.criterion_name}</td>
                      <td><span className={`badge ${tc.criterion_category === 'common' ? 'badge-primary' : 'badge-info'}`}>{tc.criterion_category === 'common' ? 'مشترک' : 'تخصصی'}</span></td>
                      <td className="font-black" style={{ color: 'var(--accent-primary)' }}>{tc.weight}%</td>
                      <td>
                        <button onClick={() => removeFromTeam(tc.id)} className="premium-btn btn-ghost text-xs py-1 px-2" title="حذف" style={{ color: 'var(--accent-danger)' }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
