'use client'

/**
 * Toast notification system — unified success/error/warning/info feedback.
 * Usage:
 *   const { success, error, warning, info } = useToast()
 *   success('ذخیره شد')
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const ToastContext = createContext<{
  success: (msg: string) => void
  error: (msg: string) => void
  warning: (msg: string) => void
  info: (msg: string) => void
} | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++
    setToasts(t => [...t, { id, kind, message }])
    window.setTimeout(() => remove(id), 4200)
  }, [remove])

  const api = {
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg),
    warning: (msg: string) => push('warning', msg),
    info: (msg: string) => push('info', msg),
  }

  const ICONS: Record<ToastKind, { Icon: typeof CheckCircle2; color: string }> = {
    success: { Icon: CheckCircle2, color: 'var(--accent-success)' },
    error: { Icon: XCircle, color: 'var(--accent-danger)' },
    warning: { Icon: AlertTriangle, color: 'var(--accent-warning)' },
    info: { Icon: Info, color: 'var(--accent-info)' },
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast viewport — bottom-left in RTL */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 'calc(100vw - 40px)',
        }}
      >
        {toasts.map(t => {
          const { Icon, color } = ICONS[t.kind]
          return (
            <div
              key={t.id}
              role="status"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                borderRight: `3px solid ${color}`,
                boxShadow: 'var(--shadow-lg)',
                minWidth: 260,
                maxWidth: 420,
                animation: 'toastIn 0.3s cubic-bezier(0.21, 1.02, 0.73, 1)',
              }}
            >
              <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.6, flex: 1 }}>
                {t.message}
              </div>
              <button
                onClick={() => remove(t.id)}
                aria-label="بستن"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 2, display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Safe no-op fallback so pages never crash outside the provider
    return {
      success: (m: string) => console.log('[toast]', m),
      error: (m: string) => console.warn('[toast]', m),
      warning: (m: string) => console.warn('[toast]', m),
      info: (m: string) => console.log('[toast]', m),
    }
  }
  return ctx
}
