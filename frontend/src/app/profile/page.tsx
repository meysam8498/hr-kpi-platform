'use client'

/**
 * حساب کاربری — تغییر رمز عبور برای همه نقش‌ها (نیازمند رمز فعلی).
 */
import { useState } from 'react'
import { KeyRound, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { authApi } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدیر سیستم',
  hr: 'مدیر منابع انسانی',
  manager: 'مدیر تیم',
  employee: 'کارمند',
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const validate = (): string | null => {
    if (!current) return 'رمز عبور فعلی را وارد کنید'
    if (next.length < 4) return 'رمز جدید باید حداقل ۴ کاراکتر باشد'
    if (next === current) return 'رمز جدید باید با رمز فعلی متفاوت باشد'
    if (next !== confirm) return 'تکرار رمز جدید با رمز جدید یکسان نیست'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      setMsg({ ok: false, text: err })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await authApi.changePassword(current, next)
      setMsg({ ok: true, text: res.message })
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err2) {
      setMsg({ ok: false, text: (err2 as Error).message || 'خطا در تغییر رمز عبور' })
    } finally {
      setSaving(false)
    }
  }

  const strength = next.length >= 8 && /[0-9]/.test(next) && (/[a-zA-Z]/.test(next) || /[\u0600-\u06FF]/.test(next))
    ? 'قوی'
    : next.length >= 4 ? 'متوسط' : next ? 'ضعیف' : ''

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn max-w-xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <KeyRound size={21} />
          </span>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>حساب کاربری</h1>
            <p className="page-subtitle">تغییر رمز عبور شخصی — برای امنیت بیشتر، بعد از اولین ورود رمز پیش‌فرض را عوض کنید</p>
          </div>
        </div>

        {/* Account card */}
        {user && (
          <div className="premium-card p-5 flex items-center gap-4">
            <span className="card-header-icon" style={{ width: 40, height: 40 }}>
              <ShieldCheck size={18} />
            </span>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{user.full_name}</div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                نام کاربری: {user.username} · نقش: {ROLE_LABELS[user.role] || user.role}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="premium-card p-6 space-y-5">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>رمز عبور فعلی</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="w-full p-3 text-sm rounded-xl pl-10"
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: 'var(--text-tertiary)' }}
                aria-label="نمایش/مخفی کردن رمز">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>رمز عبور جدید</label>
            <input
              type={showPw ? 'text' : 'password'}
              className="w-full p-3 text-sm rounded-xl"
              value={next}
              onChange={e => setNext(e.target.value)}
              placeholder="حداقل ۴ کاراکتر — پیشنهاد: حروف و اعداد"
              autoComplete="new-password"
            />
            {next && (
              <div className="text-xs mt-1 font-bold" style={{
                color: strength === 'قوی' ? 'var(--accent-success)' : strength === 'متوسط' ? 'var(--accent-warning)' : 'var(--accent-danger)',
              }}>قدرت رمز: {strength}</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>تکرار رمز جدید</label>
            <input
              type={showPw ? 'text' : 'password'}
              className="w-full p-3 text-sm rounded-xl"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="تکرار رمز جدید"
              autoComplete="new-password"
            />
          </div>

          {msg && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-bold" style={{
              background: msg.ok ? 'var(--accent-success-light)' : 'var(--accent-danger-light)',
              color: msg.ok ? 'var(--accent-success)' : 'var(--accent-danger)',
            }}>
              {msg.ok && <CheckCircle2 size={16} />}
              {msg.text}
            </div>
          )}

          <button type="submit" disabled={saving} className="premium-btn btn-primary w-full justify-center">
            {saving ? 'در حال ثبت...' : (<><KeyRound size={15} /> تغییر رمز عبور</>)}
          </button>
        </form>
      </div>
    </AppLayout>
  )
}
