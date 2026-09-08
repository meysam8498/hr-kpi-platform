'use client'

/**
 * About page — what the app does, who built it, how roles work.
 */
import { Gauge, ShieldCheck, UserCog, Users, User, Info, History, Sparkles, ChevronDown } from 'lucide-react'
import AppLayout from '@/components/Layout'
import DesignerCard from '@/components/DesignerCard'
import { GitFork, Container, Briefcase, Send, MessageCircle } from 'lucide-react'
import { APP_VERSION, CHANGELOG } from '@/lib/version'
import { toPersianNums } from '@/lib/jalali'
import { useState } from 'react'

const LINKS = [
  { href: 'https://github.com/meysam8498', label: 'گیت‌هاب', icon: GitFork },
  { href: 'https://hub.docker.com/u/meysam8498', label: 'داکر هاب', icon: Container },
  { href: 'https://linkedin.com/in/meysam-ijadi-920817127/', label: 'لینکدین', icon: Briefcase },
  { href: 'https://t.me/Meysam_Ijadi', label: 'تلگرام', icon: Send },
  { href: 'https://wa.me/Meysam_Ijadi', label: 'واتس‌اپ', icon: MessageCircle },
]

const ROLE_CARDS = [
  {
    icon: UserCog, role: 'مدیر سیستم (Admin)', color: 'var(--accent-danger)',
    perms: ['دسترسی کامل به همه بخش‌ها', 'ساخت کاربران و تعیین دسترسی', 'تنظیمات KPI، دوره‌ها و پشتیبان‌گیری'],
  },
  {
    icon: ShieldCheck, role: 'مدیر منابع انسانی (HR)', color: 'var(--accent-info)',
    perms: ['مشاهده همه تیم‌ها و گزارش‌ها', 'مدیریت دوره‌ها و امتیازدهی', 'بدون دسترسی به ساخت کاربر و پشتیبان‌گیری'],
  },
  {
    icon: Users, role: 'مدیر تیم (Manager)', color: 'var(--accent-primary)',
    perms: ['امتیازدهی فقط به اعضای تیم خود', 'مشاهده گزارش‌های تیم خود', 'بدون دسترسی به تنظیمات و سایر تیم‌ها'],
  },
  {
    icon: User, role: 'کارمند (Employee)', color: 'var(--accent-success)',
    perms: ['مشاهده فقط گزارش خودش', 'ثبت خودارزیابی', 'بدون دسترسی به اطلاعات سایر همکاران'],
  },
]

export default function AboutPage() {
  const [openVersions, setOpenVersions] = useState<Set<string>>(new Set([CHANGELOG[0]?.version]))

  const toggleVersion = (v: string) => {
    const next = new Set(openVersions)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    setOpenVersions(next)
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fadeIn" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="flex items-center gap-3">
          <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <Info size={21} />
          </span>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>درباره برنامه</h1>
            <p className="page-subtitle">سیستم مدیریت و ارزیابی عملکرد کارمندان بر اساس KPI</p>
          </div>
        </div>

        {/* What it is */}
        <div className="premium-card p-6">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Gauge size={17} /> این سیستم چه کاری انجام می‌دهد؟</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 2 }}>
            یک پلتفرم داخلی برای ثبت، محاسبه و گزارش‌گیری شاخص‌های کلیدی عملکرد (KPI) کارمندان است.
            مدیران هر تیم در پایان هر دوره، نمره ۰ تا ۱۰۰ اعضای تیم خود را وارد می‌کنند؛ سیستم به‌صورت خودکار
            نمره نهایی را با ترکیب امتیاز مدیر، ارزیابی ۳۶۰ درجه، تحقق اهداف و حضور محاسبه می‌کند و
            گزارش‌های فردی، تیمی و سازمانی را به‌صورت بصری و قابل خروجی (اکسل و چاپ) ارائه می‌دهد.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {[
              { k: 'محاسبه', v: 'میانگین وزنی قابل تنظیم' },
              { k: 'دوره‌ها', v: 'ماهانه / فصلی / سالانه' },
              { k: 'گزارش', v: 'فردی، تیمی، سازمانی' },
              { k: 'اجرا', v: 'کاملاً لوکال با داکر' },
            ].map(x => (
              <div key={x.k} className="p-3 rounded-xl text-center" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>{x.k}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Roles */}
        <div className="premium-card p-6">
          <h2 className="font-bold mb-1">سطوح دسترسی</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
            هر نقش فقط منوها و داده‌های مرتبط با خودش را می‌بیند. حساب‌های کاربری توسط مدیر سیستم در صفحه «کاربران» ساخته می‌شوند.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLE_CARDS.map(rc => (
              <div key={rc.role} className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg-secondary)', color: rc.color, border: '1px solid var(--border-primary)' }}
                  >
                    <rc.icon size={16} />
                  </span>
                  <span className="font-bold text-sm">{rc.role}</span>
                </div>
                <ul style={{ paddingRight: 18, margin: 0 }}>
                  {rc.perms.map(p => (
                    <li key={p} className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 2 }}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Designer */}
        <div className="premium-card p-6">
          <h2 className="font-bold mb-4">طراح و توسعه‌دهنده</h2>
          <div className="flex items-center gap-5 flex-wrap">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'linear-gradient(135deg, #5b6abf 0%, #8b6dd7 100%)',
                boxShadow: '0 4px 18px var(--accent-primary-glow)',
                color: 'white', fontSize: '1.4rem', fontWeight: 800,
              }}
            >
              م
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                میثم ایجادی
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                طراح و توسعه‌دهنده سیستم
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {LINKS.map(l => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    <l.icon size={13} /> {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Version + Changelog */}
        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="card-header-icon" style={{ width: 40, height: 40, borderRadius: 12 }}>
              <History size={18} />
            </span>
            <div>
              <h2 className="font-bold" style={{ fontSize: '1rem' }}>تاریخچه نسخه‌ها</h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                آخرین نسخه: <strong style={{ color: 'var(--accent-primary)' }}>{toPersianNums(APP_VERSION)}</strong> — ساخته‌شده با Next.js، FastAPI و SQLite
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {CHANGELOG.map((c, i) => {
              const isOpen = openVersions.has(c.version)
              return (
                <div
                  key={c.version}
                  style={{ position: 'relative', paddingBottom: 12 }}
                >
                  {i < CHANGELOG.length - 1 && (
                    <div style={{ position: 'absolute', right: 13, top: 34, bottom: 0, width: 2, background: 'var(--border-primary)' }} />
                  )}
                  <div className="flex gap-4">
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 28, height: 28, borderRadius: '50%', zIndex: 1,
                        background: i === 0 ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        border: '2px solid var(--border-primary)',
                        color: i === 0 ? 'white' : 'var(--text-tertiary)',
                      }}
                    >
                      {i === 0 ? <Sparkles size={13} /> : null}
                    </div>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <button
                        onClick={() => toggleVersion(c.version)}
                        className="flex items-center gap-3 flex-wrap w-full"
                        style={{
                          marginTop: 1, background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, fontFamily: 'inherit', textAlign: 'right',
                        }}
                        aria-expanded={isOpen}
                      >
                        <span className="badge" style={{
                          background: i === 0 ? 'var(--accent-primary-subtle)' : 'var(--bg-tertiary)',
                          color: i === 0 ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          fontSize: '0.68rem', fontWeight: 700,
                        }}>
                          نسخه {toPersianNums(c.version)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{toPersianNums(c.date)}</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                        <ChevronDown
                          size={14}
                          style={{
                            marginRight: 'auto', color: 'var(--text-tertiary)',
                            transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      </button>
                      {isOpen && (
                        <ul style={{ paddingRight: 18, margin: '6px 0 0', listStyle: 'disc' }} className="animate-fadeIn">
                          {c.items.map(it => (
                            <li key={it} className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 2 }}>{it}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
