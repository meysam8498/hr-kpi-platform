'use client'

import { GitFork, Container, Briefcase, Send, MessageCircle, type LucideIcon } from 'lucide-react'

/* ─── Designer profile card (system designer credit) ─── */

const DESIGNER = {
  name: 'میثم ایجادی',
  role: 'طراح سیستم',
  links: [
    { href: 'https://github.com/meysam8498', label: 'گیت‌هاب', icon: GitFork },
    { href: 'https://hub.docker.com/u/meysam8498', label: 'داکر هاب', icon: Container },
    { href: 'https://linkedin.com/in/meysam-ijadi-920817127/', label: 'لینکدین', icon: Briefcase },
    { href: 'https://t.me/Meysam_Ijadi', label: 'تلگرام', icon: Send },
    { href: 'https://wa.me/Meysam_Ijadi', label: 'واتس‌اپ', icon: MessageCircle },
  ],
}

interface DesignerCardProps {
  variant?: 'sidebar' | 'surface'
}

export default function DesignerCard({ variant = 'surface' }: DesignerCardProps) {
  const isSidebar = variant === 'sidebar'

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        background: isSidebar ? 'rgba(255,255,255,0.03)' : 'var(--bg-tertiary)',
        border: isSidebar ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--border-secondary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'var(--gradient-primary)',
            color: 'white',
            fontSize: '0.75rem',
            fontWeight: 700,
            boxShadow: '0 2px 8px var(--accent-primary-glow)',
          }}
        >
          م
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isSidebar ? '#fff' : 'var(--text-primary)', lineHeight: 1.4 }}>
            {DESIGNER.name}
          </div>
          <div style={{ fontSize: '0.58rem', color: isSidebar ? 'var(--text-sidebar)' : 'var(--text-tertiary)', lineHeight: 1.4 }}>
            {DESIGNER.role}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 9 }}>
        {DESIGNER.links.map(link => {
          const Icon: LucideIcon = link.icon
          return (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              title={link.label}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSidebar ? 'var(--text-sidebar)' : 'var(--text-secondary)',
                background: isSidebar ? 'rgba(255,255,255,0.06)' : 'var(--bg-input)',
                border: isSidebar ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--border-secondary)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--accent-primary)'
                e.currentTarget.style.borderColor = 'var(--accent-primary)'
                e.currentTarget.style.background = 'var(--accent-primary-subtle)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = isSidebar ? 'var(--text-sidebar)' : 'var(--text-secondary)'
                e.currentTarget.style.borderColor = isSidebar ? 'rgba(255,255,255,0.06)' : 'var(--border-secondary)'
                e.currentTarget.style.background = isSidebar ? 'rgba(255,255,255,0.06)' : 'var(--bg-input)'
              }}
            >
              <Icon size={14} strokeWidth={2} />
            </a>
          )
        })}
      </div>
    </div>
  )
}
