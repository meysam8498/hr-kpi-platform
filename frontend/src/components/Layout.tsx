'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bell, Star, UserCheck, Users, Target, TrendingUp,
  Building2, IdCard, CalendarX, HeartPulse, BarChart3, SlidersHorizontal,
  FileSpreadsheet, Settings2, CalendarClock, DatabaseBackup, ScrollText,
  Sun, Moon, Menu, X, ChevronRight, ChevronLeft, Gauge, ChevronsRight, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '@/lib/theme-context'
import { nowJalali, toEnglishNums, toPersianNums } from '@/lib/jalali'
import DesignerCard from '@/components/DesignerCard'
import NotificationBell from '@/components/NotificationBell'

/* ─── Navigation Groups (Hick's Law: Reduce complexity by grouping) ─── */
interface NavItem { href: string; icon: LucideIcon; label: string; badge?: string }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'اصلی',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'داشبورد' },
      { href: '/notifications', icon: Bell, label: 'اعلان‌ها' },
    ],
  },
  {
    label: 'عملیات',
    items: [
      { href: '/scoring', icon: Star, label: 'امتیازدهی' },
      { href: '/self-eval', icon: UserCheck, label: 'خودارزیابی' },
      { href: '/peer-reviews', icon: Users, label: 'ارزیابی ۳۶۰' },
      { href: '/goals', icon: Target, label: 'اهداف' },
      { href: '/pips', icon: TrendingUp, label: 'طرح بهبود' },
    ],
  },
  {
    label: 'مدیریت',
    items: [
      { href: '/teams', icon: Building2, label: 'تیم‌ها' },
      { href: '/employees', icon: IdCard, label: 'کارمندان' },
      { href: '/absences', icon: CalendarX, label: 'غیبت‌ها' },
    ],
  },
  {
    label: 'گزارش‌ها',
    items: [
      { href: '/hr', icon: HeartPulse, label: 'داشبورد منابع انسانی' },
      { href: '/reports', icon: BarChart3, label: 'گزارش‌ها' },
      { href: '/custom-reports', icon: SlidersHorizontal, label: 'گزارش سفارشی' },
      { href: '/excel', icon: FileSpreadsheet, label: 'اکسل' },
    ],
  },
  {
    label: 'تنظیمات',
    items: [
      { href: '/admin/config', icon: Settings2, label: 'تنظیمات KPI' },
      { href: '/admin/periods', icon: CalendarClock, label: 'دوره‌ها' },
      { href: '/backup', icon: DatabaseBackup, label: 'پشتیبان‌گیری' },
      { href: '/audit', icon: ScrollText, label: 'گزارش فعالیت' },
    ],
  },
]

const PERSIAN_DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']
const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

function getClockData() {
  const now = new Date()
  const jalali = nowJalali()
  const parts = jalali.split('  🕐  ')
  const dateParts = (parts[0] || '').split('-')
  const dayName = PERSIAN_DAYS[now.getDay()]
  // nowJalali returns Persian digits; normalize before arithmetic
  const y = parseInt(toEnglishNums(dateParts[0]))
  const m = parseInt(toEnglishNums(dateParts[1]))
  const d = parseInt(toEnglishNums(dateParts[2]))
  const monthName = PERSIAN_MONTHS[(m || 1) - 1] || ''
  const dayNum = Number.isFinite(d) ? toPersianNums(String(d)) : ''
  const yearNum = Number.isFinite(y) ? toPersianNums(String(y)) : ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${toPersianNums(dayNum)} ${monthName} ${toPersianNums(yearNum)}`,
    time: `${toPersianNums(pad(now.getHours()))}:${toPersianNums(pad(now.getMinutes()))}`,
    seconds: toPersianNums(pad(now.getSeconds())),
    day: dayName,
  }
}

function LogoMark({ size = 36, radius = 10, iconSize = 18 }: { size?: number; radius?: number; iconSize?: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'linear-gradient(135deg, #5b6abf 0%, #8b6dd7 100%)',
        boxShadow: '0 2px 12px var(--accent-primary-glow)',
        color: 'white',
      }}
    >
      <Gauge size={iconSize} strokeWidth={2.2} />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { theme, toggle: toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [clock, setClock] = useState({ date: '', time: '', seconds: '', day: '' })
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const updateClock = useCallback(() => setClock(getClockData()), [])

  useEffect(() => {
    updateClock()
    const t = setInterval(updateClock, 1000)
    return () => clearInterval(t)
  }, [updateClock])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const sidebarWidth = isMobile ? 0 : collapsed ? 64 : 232

  return (
    <div className="flex min-h-screen" style={{ direction: 'rtl' }}>
      {/* ─── Mobile Top Bar ─── */}
      {isMobile && (
        <header
          className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between"
          style={{
            height: 58,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-primary)',
            padding: '0 14px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Logo + clock */}
          <Link href="/dashboard" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
            <LogoMark size={34} radius={9} iconSize={17} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.2, fontFamily: 'var(--font-display)' }}>
                سیستم KPI
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', lineHeight: 1.2, direction: 'ltr', textAlign: 'right', marginTop: 1 }}>
                {clock.day && `${clock.day} — `}{clock.time}
              </div>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <NotificationBell variant="mobile" />
            <button
              onClick={toggleTheme}
              aria-label="تغییر تم"
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {mounted ? (theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />) : <Moon size={17} />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="منو"
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: '1px solid var(--border-primary)',
                background: mobileOpen ? 'var(--accent-primary-subtle)' : 'var(--bg-tertiary)',
                color: mobileOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>
      )}

      {/* ─── Mobile Menu Panel ─── */}
      {isMobile && mobileOpen && (
        <div
          className="fixed z-40"
          style={{
            top: 58,
            right: 0, left: 0, bottom: 0,
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-primary)',
            overflowY: 'auto',
            padding: '12px 16px 32px',
            animation: 'slideUp 0.25s ease-out',
          }}
        >
          {/* Mobile Clock */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12,
              background: 'var(--gradient-primary)',
              color: '#fff', marginBottom: 14,
              boxShadow: '0 4px 14px var(--accent-primary-glow)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>{clock.day}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{clock.date}</div>
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: "'Vazirmatn', monospace", direction: 'ltr' }}>
              {clock.time}:{clock.seconds}
            </div>
          </div>

          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? 14 : 0 }}>
              <div
                style={{
                  fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-tertiary)',
                  letterSpacing: '0.02em', padding: '0 8px', marginBottom: 6,
                }}
              >
                {group.label}
              </div>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                }}
              >
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', borderRadius: 10,
                        background: isActive ? 'var(--accent-primary-subtle)' : 'transparent',
                        color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                        textDecoration: 'none', fontWeight: isActive ? 700 : 500,
                        fontSize: '0.8rem',
                        border: isActive ? '1px solid var(--border-focus)' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                        minWidth: 0,
                      }}
                    >
                      <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                      <span style={{ lineHeight: 1.45 }}>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Designer Credit (mobile) */}
          <div style={{ marginTop: 18 }}>
            <DesignerCard variant="surface" />
          </div>
        </div>
      )}

      {/* ─── Desktop Sidebar ─── */}
      {!isMobile && (
        <aside
          className="fixed top-0 right-0 h-full z-40 flex flex-col"
          style={{
            width: sidebarWidth,
            background: 'var(--gradient-sidebar)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
          }}
        >
          {/* Logo Area */}
          <div
            className="flex items-center gap-3"
            style={{
              height: 64,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
              padding: collapsed ? '0 12px' : '0 16px',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <LogoMark size={38} radius={11} iconSize={19} />
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 400, color: '#fff', letterSpacing: '-0.01em', fontFamily: 'var(--font-display)' }}>
                  سیستم KPI
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-sidebar)', marginTop: -1 }}>
                  مدیریت عملکرد منابع انسانی
                </div>
              </div>
            )}
          </div>

          {/* Clock Widget */}
          {!collapsed && (
            <div
              className="mx-3 mt-3"
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(91,106,191,0.16) 0%, rgba(139,109,215,0.10) 100%)',
                border: '1px solid rgba(124,138,224,0.22)',
              }}
            >
              <div style={{ fontSize: '0.6rem', color: 'var(--text-sidebar)', marginBottom: 2 }}>
                {clock.day}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#e8eaf0', fontWeight: 600, marginBottom: 4 }}>
                {clock.date}
              </div>
              <div
                style={{
                  fontSize: '1.55rem',
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: "'Vazirmatn', monospace",
                  letterSpacing: '0.02em',
                  lineHeight: 1.05,
                  direction: 'ltr',
                  textAlign: 'right',
                }}
              >
                {clock.time}
                <span style={{ fontSize: '0.7rem', opacity: 0.55, marginRight: 2 }}>:{clock.seconds}</span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto" style={{ padding: '10px 10px' }}>
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? 18 : 0 }}>
                {!collapsed && (
                  <div
                    style={{
                      fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-sidebar)',
                      letterSpacing: '0.06em', padding: '0 10px', marginBottom: 6,
                    }}
                  >
                    {group.label}
                  </div>
                )}
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      style={{
                        display: 'flex', alignItems: 'center',
                        gap: 10,
                        padding: collapsed ? '10px 0' : '9px 10px',
                        borderRadius: 10,
                        marginBottom: 3,
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(91,106,191,0.28) 0%, rgba(139,109,215,0.22) 100%)'
                          : 'transparent',
                        color: isActive ? '#fff' : 'var(--text-sidebar)',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        position: 'relative',
                        minHeight: 40,
                        border: isActive ? '1px solid rgba(124,138,224,0.25)' : '1px solid transparent',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                          e.currentTarget.style.color = '#cdd1e8'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-sidebar)'
                        }
                      }}
                    >
                      {isActive && !collapsed && (
                        <div
                          style={{
                            position: 'absolute', right: -10, top: '50%',
                            transform: 'translateY(-50%)',
                            width: 3, height: 20,
                            borderRadius: '3px 0 0 3px',
                            background: '#a5b0f0',
                          }}
                        />
                      )}
                      <Icon size={17} strokeWidth={isActive ? 2.2 : 1.9} style={{ flexShrink: 0 }} />
                      {!collapsed && (
                        <span style={{ fontSize: '0.78rem', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Footer — Bell + Theme Toggle + Collapse */}
          <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Notification Bell */}
            <div
              style={{
                display: 'flex',
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: '0 4px',
                marginBottom: 6,
              }}
            >
              <NotificationBell anchorOffset={sidebarWidth + 12} />
            </div>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={collapsed ? 'تغییر تم' : undefined}
              className="flex items-center gap-2 cursor-pointer"
              style={{
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 10px',
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--text-sidebar)',
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                transition: 'all 0.15s ease',
                justifyContent: collapsed ? 'center' : 'flex-start',
                minHeight: 38,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = '#cdd1e8'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-sidebar)'
              }}
            >
              <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                {mounted ? (theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />) : <Moon size={16} />}
              </span>
              {!collapsed && (
                <span>{mounted ? (theme === 'dark' ? 'حالت روشن' : 'حالت تاریک') : ''}</span>
              )}
            </button>

            {/* Collapse Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'باز کردن منو' : 'جمع کردن'}
              className="flex items-center gap-2 cursor-pointer"
              style={{
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 10px',
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--text-sidebar)',
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                transition: 'all 0.15s ease',
                justifyContent: collapsed ? 'center' : 'flex-start',
                minHeight: 38,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = '#cdd1e8'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-sidebar)'
              }}
            >
              <span
                style={{
                  flexShrink: 0, display: 'inline-flex',
                  transform: collapsed ? 'none' : 'rotate(180deg)',
                  transition: 'transform 0.25s ease',
                }}
              >
                {collapsed ? <ChevronsRight size={16} /> : <ChevronRight size={16} />}
              </span>
              {!collapsed && <span>جمع کردن منو</span>}
            </button>

            {/* Designer Credit */}
            {!collapsed && (
              <div style={{ marginTop: 8 }}>
                <DesignerCard variant="sidebar" />
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ─── Main Content ─── */}
      <main
        style={{
          marginRight: isMobile ? 0 : sidebarWidth,
          paddingTop: isMobile ? 74 : '28px',
          paddingBottom: '28px',
          paddingLeft: isMobile ? '16px' : '36px',
          paddingRight: isMobile ? '16px' : '36px',
          transition: 'margin-right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '100vh',
          width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {children}
      </main>
    </div>
  )
}
