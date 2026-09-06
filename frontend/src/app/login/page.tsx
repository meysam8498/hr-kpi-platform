'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Gauge, LogIn, User, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const { login, user, loading } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Already logged in → straight to dashboard (in an effect, not render)
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [loading, user, router])

  if (!loading && user) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setBusy(true)
    setError('')
    try {
      await login(username, password)
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err.message || 'خطا در ورود')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        direction: 'rtl',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Aurora backdrop */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(700px 420px at 80% 15%, var(--accent-primary-glow), transparent 60%),' +
            'radial-gradient(600px 380px at 15% 85%, rgba(139,109,215,0.10), transparent 60%)',
        }}
      />

      <div
        className="animate-fadeIn"
        style={{
          position: 'relative', width: 'min(400px, calc(100% - 32px))',
          padding: '40px 36px', borderRadius: 20,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center" style={{ marginBottom: 28 }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'linear-gradient(135deg, #5b6abf 0%, #8b6dd7 100%)',
              boxShadow: '0 6px 24px var(--accent-primary-glow)',
              color: 'white', marginBottom: 14,
            }}
          >
            <Gauge size={30} strokeWidth={2.2} />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            سیستم مدیریت KPI
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
            برای ادامه وارد حساب کاربری خود شوید
          </p>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 animate-slideUp"
            style={{
              padding: '10px 14px', borderRadius: 12, marginBottom: 16,
              background: 'var(--accent-danger-light)', color: 'var(--accent-danger)',
              fontSize: '0.78rem',
            }}
            role="alert"
          >
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              نام کاربری
            </label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', top: 13, right: 14, color: 'var(--text-tertiary)' }} />
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="مثلاً admin"
                style={{
                  width: '100%', padding: '12px 42px 12px 14px', borderRadius: 12,
                  border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              رمز عبور
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', top: 13, right: 14, color: 'var(--text-tertiary)' }} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 42px 12px 14px', borderRadius: 12,
                  border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="premium-btn btn-primary"
            style={{
              width: '100%', justifyContent: 'center', padding: '12px',
              fontSize: '0.9rem', opacity: busy || !username || !password ? 0.6 : 1,
            }}
          >
            <LogIn size={16} /> {busy ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>

        <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 22, lineHeight: 1.8 }}>
          حساب‌های پیش‌فرض: <strong>admin / admin123</strong> (مدیر سیستم) و <strong>hr / hr123</strong> (منابع انسانی)
          <br />
          طراحی و توسعه: میثم ایجادی
        </p>
      </div>
    </div>
  )
}
