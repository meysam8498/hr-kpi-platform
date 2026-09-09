'use client'

import { useEffect, useState } from 'react'
import { Settings2, ClipboardList, Dna, Scale, Trash2, Plus, Save, Calculator } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { teamsApi, kpiApi } from '@/lib/api'
import type { Team, KPICriterion, TeamKPIConfig } from '@/lib/api'
import { HelpHint } from '@/components/ui'
import { toPersianNums } from '@/lib/jalali'

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

  // Normalization mode: average over entered criteria only
  const [normalizeEntered, setNormalizeEntered] = useState(false)
  const [normMsg, setNormMsg] = useState<string>('')

  const load = () => {
    Promise.all([teamsApi.list(), kpiApi.listCriteria()]).then(([t, c]) => {
      setTeams(t); setCriteria(c)
      if (t.length > 0) setSelectedTeam(t[0].id)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (selectedTeam) { kpiApi.teamConfig(selectedTeam).then(setTeamConfigs); loadBlend(selectedTeam); kpiApi.getNormalizeMode(selectedTeam).then(r => setNormalizeEntered(r.normalize_over_entered)).catch(() => setNormalizeEntered(false)) } }, [selectedTeam])

  const toggleNormalize = async () => {
    if (!selectedTeam) return
    const next = !normalizeEntered
    try {
      const r = await kpiApi.setNormalizeMode(selectedTeam, next)
      setNormalizeEntered(r.normalize_over_entered)
      setNormMsg('ذخیره شد — با محاسبه مجدد نمرات اعمال می‌شود')
    } catch {
      setNormMsg('خطا در ذخیره')
    }
  }

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

  // Inline live example of the weighted-average formula for the selected team.
  // Sample scores (80/60) show how weights turn raw scores into a final number.
  const sampleScores = [80, 60]
  const previewRows = teamConfigs.map((tc, i) => ({
    name: tc.criterion_name,
    weight: tc.weight,
    score: sampleScores[i % 2],
  }))
  const previewWeight = previewRows.reduce((s, r) => s + r.weight, 0)
  const previewFinal = previewWeight > 0
    ? Math.round(previewRows.reduce((s, r) => s + r.score * r.weight, 0) / previewWeight * 10) / 10
    : 0

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

        {/* Normalization mode */}
        <div className="premium-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div style={{ maxWidth: 640 }}>
              <h2 className="font-bold mb-2 flex items-center gap-2"><Scale size={17} /> نحوه محاسبه معیارهای نمره‌نداده‌شده</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                وقتی بعضی معیارهای یک کارمند نمره ندارند، چه چیزی جای آن‌ها بنشیند؟
                {normalizeEntered
                  ? ' در حالت فعلی، فقط معیارهای نمره‌دار در میانگین حساب می‌شوند — نمره‌ی نداده‌شده بی‌اثر است (پیشنهادی برای تیم‌هایی که همه معیارها را نمره نمی‌دهند).'
                  : ' در حالت فعلی، معیار بدون نمره صفر حساب می‌شود — برای تیم‌هایی که همیشه همه معیارها را نمره می‌دهند درست است.'}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 190 }}>
              <button
                onClick={toggleNormalize}
                role="switch"
                aria-checked={normalizeEntered}
                className="premium-btn"
                style={{
                  padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700,
                  background: normalizeEntered ? 'var(--accent-success-subtle, rgba(52,199,89,0.12))' : 'var(--bg-tertiary)',
                  color: normalizeEntered ? 'var(--accent-success)' : 'var(--text-secondary)',
                  border: `1px solid ${normalizeEntered ? 'var(--accent-success)' : 'var(--border-primary)'}`,
                }}
              >
                {normalizeEntered ? '✓ فقط معیارهای نمره‌دار' : 'معیار بدون نمره = صفر'}
              </button>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>کلیک برای تغییر (تیم انتخاب‌شده)</span>
              {normMsg && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{normMsg}</span>}
            </div>
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

          {/* Inline calculation preview — makes the formula visible without a new page */}
          {teamConfigs.length > 0 && (
            <div className="p-4 rounded-xl mb-5" style={{ background: 'var(--accent-primary-subtle)', border: '1px dashed var(--accent-primary)' }}>
              <div className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                <Calculator size={15} /> نمونه محاسبه — نمره فرضی برای تیم انتخابی
              </div>
              <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                نمره نهایی = مجموع (نمره × وزن) ÷ مجموع وزن‌ها. برای درک وزن‌دهی، نمره‌های فرضی ۸۰ و ۶۰ در نظر گرفته شده:
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                {previewRows.map(r => (
                  <span key={r.name} className="badge badge-info">
                    {r.name}: {toPersianNums(String(r.score))} × وزن {toPersianNums(String(r.weight))}٪
                  </span>
                ))}
                <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                <span className="badge badge-success">نمره نهایی: {toPersianNums(String(previewFinal))}</span>
              </div>
            </div>
          )}

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
