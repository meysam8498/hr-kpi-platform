'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Trash2 } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { peerReviewsApi, employeesApi, kpiApi, teamsApi } from '@/lib/api'
import type { PeerReview, Employee, ReportingPeriod, Team } from '@/lib/api'
import { toPersianNums } from '@/lib/jalali'

export default function PeerReviewsPage() {
  const [reviews, setReviews] = useState<PeerReview[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [teamId, setTeamId] = useState<number | ''>('')
  const [periodId, setPeriodId] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)

  // Form
  const [fReviewer, setFReviewer] = useState<number | ''>('')
  const [fReviewee, setFReviewee] = useState<number | ''>('')
  const [fTeamwork, setFTeamwork] = useState('80')
  const [fComm, setFComm] = useState('80')
  const [fReli, setFReli] = useState('80')
  const [fComment, setFComment] = useState('')
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      teamsApi.list(), kpiApi.listPeriods(), employeesApi.listAll(),
    ]).then(([t, p, e]) => {
      setTeams(t)
      setPeriods(p.filter(per => !per.is_archived))
      setEmployees(e.filter(emp => !emp.is_archived))
      const active = p.find(per => per.is_active && !per.is_archived)
      if (active) setPeriodId(active.id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    peerReviewsApi.list(periodId === '' ? undefined : Number(periodId))
      .then(setReviews)
      .catch(() => setReviews([]))
  }, [periodId])

  const teamEmployees = teamId === '' ? employees : employees.filter(e => e.team_id === teamId)

  const addReview = async () => {
    if (!fReviewer || !fReviewee || !periodId) {
      setFormMsg({ type: 'err', text: 'ارزیاب، فرد مورد ارزیابی و دوره الزامی است' })
      return
    }
    try {
      await peerReviewsApi.create({
        reviewer_id: Number(fReviewer), reviewee_id: Number(fReviewee),
        period_id: Number(periodId),
        teamwork_score: Number(fTeamwork), communication_score: Number(fComm),
        reliability_score: Number(fReli), comment: fComment || undefined,
      })
      setFormMsg({ type: 'ok', text: 'ارزیابی ۳۶۰ ثبت شد' })
      setFComment('')
      setReviews(await peerReviewsApi.list(Number(periodId)))
    } catch (e: any) {
      setFormMsg({ type: 'err', text: e.detail || e.message || 'خطا در ثبت ارزیابی' })
    }
  }

  const remove = async (id: number) => {
    await peerReviewsApi.delete(id)
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const avgClass = (n: number) => n >= 80 ? 'score-excellent' : n >= 60 ? 'score-good' : 'score-poor'

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="page-header">
          <div>
            <h1 className="page-title">ارزیابی ۳۶۰ درجه</h1>
            <p className="page-subtitle">هم‌تیمی‌ها به یکدیگر در سه بعد همکاری، ارتباطات و قابلیت اطمینان نمره می‌دهند</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="card" style={{ padding: 20, alignSelf: 'start' }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><Users size={14} /></span>
                ثبت ارزیابی
              </div>
            </div>
            <div className="flex flex-col gap-3" style={{ marginTop: 14 }}>
              <div>
                <label className="form-label">تیم</label>
                <select className="form-input" value={teamId} onChange={e => setTeamId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">همه تیم‌ها</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">ارزیاب (نمره‌دهنده)</label>
                <select className="form-input" value={fReviewer} onChange={e => setFReviewer(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">انتخاب کنید</option>
                  {teamEmployees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">فرد مورد ارزیابی</label>
                <select className="form-input" value={fReviewee} onChange={e => setFReviewee(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">انتخاب کنید</option>
                  {teamEmployees.filter(e => e.id !== fReviewer).map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">دوره</label>
                <select className="form-input" value={periodId} onChange={e => setPeriodId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">انتخاب کنید</option>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="form-label">همکاری</label>
                  <input className="form-input" type="number" min={0} max={100} value={fTeamwork} onChange={e => setFTeamwork(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">ارتباطات</label>
                  <input className="form-input" type="number" min={0} max={100} value={fComm} onChange={e => setFComm(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">قابلیت اطمینان</label>
                  <input className="form-input" type="number" min={0} max={100} value={fReli} onChange={e => setFReli(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">نظر (اختیاری)</label>
                <textarea className="form-input" rows={2} value={fComment} onChange={e => setFComment(e.target.value)} />
              </div>
              {formMsg && (
                <div className={formMsg.type === 'ok' ? 'info-box info-box-success' : 'info-box info-box-danger'}>
                  {formMsg.text}
                </div>
              )}
              <button className="btn btn-primary" onClick={addReview}>ثبت ارزیابی</button>
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>دوره:</span>
              <div className="flex gap-1.5 flex-wrap">
                {periods.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodId(p.id)}
                    className="tab"
                    style={{
                      background: periodId === p.id ? 'var(--accent-primary)' : 'transparent',
                      color: periodId === p.id ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center" style={{ padding: 40 }}>
                <div className="spinner" style={{ width: 26, height: 26 }} />
              </div>
            ) : reviews.length === 0 ? (
              <div className="card empty-state" style={{ padding: 32 }}>
                <div className="empty-state-icon" style={{ color: 'var(--accent-primary)', opacity: 0.4 }}><Users size={40} strokeWidth={1.2} /></div>
                <div className="empty-state-title">ارزیابی‌ای ثبت نشده</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {reviews.map(r => (
                  <div key={r.id} className="card" style={{ padding: 16 }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.reviewee_name}</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>توسط {r.reviewer_name}</span>
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{r.period_name}</div>
                        {r.comment && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 6 }}>{r.comment}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`score-badge ${avgClass(r.avg_score)}`}>{toPersianNums(String(r.avg_score))}</span>
                        <button className="btn-icon btn-icon-danger" onClick={() => remove(r.id)}>✕</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2" style={{ marginTop: 12 }}>
                      {[
                        { label: 'همکاری', v: r.teamwork_score },
                        { label: 'ارتباطات', v: r.communication_score },
                        { label: 'قابلیت اطمینان', v: r.reliability_score },
                      ].map(x => (
                        <div key={x.label} className="info-box info-box-primary" style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{toPersianNums(String(x.v))}</div>
                          <div style={{ fontSize: '0.62rem', opacity: 0.85 }}>{x.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}