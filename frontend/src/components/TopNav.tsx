'use client'

/**
 * TopNav — horizontal navbar with nested dropdown groups.
 * Replaces the sidebar to save vertical space; role-filtered per user.
 */
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Sun, Moon, Gauge, ChevronDown, LogOut, User as UserIcon, Menu, X, UserRound,
} from 'lucide-react'
import { useTheme } from '@/lib/theme-context'
import { useAuth, ROLE_LABELS } from '@/lib/auth-context'
import { NAV_GROUPS, navForRole, type NavGroup } from '@/components/nav-config'
import NotificationBell from '@/components/NotificationBell'
import { nowJalali, toEnglishNums, toPersianNums } from '@/lib/jalali'

const PERSIAN_DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']
const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

function jalaliToday(): string {
  const j = nowJalali().split('  🕐  ')[0] || ''
  const [y, m, d] = j.split('-').map(p => parseInt(toEnglishNums(p)))
  const name = new Date().getDay()
  if (!y || !m || !d) return j
  return `${PERSIAN_DAYS[name]} ${toPersianNums(String(d))} ${PERSIAN_MONTHS[m - 1]} ${toPersianNums(String(y))}`
}

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle: toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [userMenu, setUserMenu] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [today, setToday] = useState('')
  const navRef = useRef<HTMLDivElement>(null)

  const groups: NavGroup[] = navForRole(user?.role ?? null)

  useEffect(() => {
    setToday(jalaliToday())
    const t = setInterval(() => setToday(jalaliToday()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Close dropdowns on outside click / route change
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null); setUserMenu(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  useEffect(() => { setOpenGroup(null); setMobileOpen(false) }, [pathname])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const groupActive = (g: NavGroup) => g.items.some(it => isActive(it.href))

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  return (
    <header
      ref={navRef}
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
        direction: 'rtl',
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{ padding: '0 20px', height: 56, maxWidth: 1440, margin: '0 auto' }}
      >
        {/* Logo + title */}
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0" style={{ textDecoration: 'none' }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #5b6abf 0%, #8b6dd7 100%)',
              boxShadow: '0 2px 10px var(--accent-primary-glow)', color: 'white',
            }}
          >
            <Gauge size={17} strokeWidth={2.2} />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              سیستم KPI
            </div>
            <div style={{ fontSize: '0.56rem', color: 'var(--text-tertiary)' }}>{today}</div>
          </div>
        </Link>

        {/* Desktop menus */}
        <nav className="hidden md:flex items-center" style={{ marginRight: 8, gap: 2 }}>
          {groups.map(g => (
            <div key={g.label} style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenGroup(openGroup === g.label ? null : g.label)}
                className="flex items-center gap-1.5"
                style={{
                  padding: '7px 12px', borderRadius: 9, fontSize: '0.78rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: openGroup === g.label || groupActive(g) ? 'var(--accent-primary-subtle)' : 'transparent',
                  color: openGroup === g.label || groupActive(g) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <g.icon size={14} />
                {g.label}
                <ChevronDown
                  size={12}
                  style={{ transform: openGroup === g.label ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
              </button>

              {openGroup === g.label && (
                <div
                  className="animate-slideUp"
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 190,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                    borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 60,
                  }}
                  role="menu"
                >
                  {g.items.map(it => (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setOpenGroup(null)}
                      className="flex items-center gap-2.5"
                      style={{
                        padding: '9px 12px', borderRadius: 8, textDecoration: 'none',
                        fontSize: '0.78rem', fontWeight: 500,
                        color: isActive(it.href) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: isActive(it.href) ? 'var(--accent-primary-subtle)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isActive(it.href)) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { if (!isActive(it.href)) e.currentTarget.style.background = 'transparent' }}
                    >
                      <it.icon size={14} style={{ flexShrink: 0 }} />
                      {it.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <NotificationBell variant="desktop" />

          <button
            onClick={toggleTheme}
            aria-label="تغییر تم"
            title="تغییر تم روشن/تاریک"
            style={{
              width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border-primary)',
              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* User chip */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-2"
                style={{
                  padding: '4px 10px 4px 6px', borderRadius: 10,
                  border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: 'var(--gradient-primary)', color: '#fff',
                    fontSize: '0.65rem', fontWeight: 700,
                  }}
                >
                  {user.full_name.trim().charAt(0)}
                </div>
                <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {user.full_name}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>
                    {ROLE_LABELS[user.role]}
                  </div>
                </div>
                <ChevronDown size={12} color="var(--text-tertiary)" />
              </button>

              {userMenu && (
                <div
                  className="animate-slideUp"
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 170,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                    borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 60,
                  }}
                >
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-primary)', marginBottom: 4 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user.full_name}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>
                      {user.username} — {ROLE_LABELS[user.role]}
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 w-full"
                    style={{
                      padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
                      background: 'transparent', fontSize: '0.78rem', fontFamily: 'inherit', width: '100%', textAlign: 'right',
                    }}
                  >
                    <UserRound size={14} /> حساب کاربری
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full"
                    style={{
                      padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'transparent', color: 'var(--accent-danger)',
                      fontSize: '0.78rem', fontFamily: 'inherit', width: '100%', textAlign: 'right',
                    }}
                  >
                    <LogOut size={14} /> خروج از حساب
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="premium-btn btn-primary" style={{ fontSize: '0.72rem', padding: '6px 14px' }}>
              ورود
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="منو"
            style={{
              width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border-primary)',
              background: mobileOpen ? 'var(--accent-primary-subtle)' : 'var(--bg-tertiary)',
              color: mobileOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{
            borderTop: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
            maxHeight: 'calc(100vh - 56px)', overflowY: 'auto', padding: '12px 16px 24px',
          }}
        >
          {groups.map(g => (
            <div key={g.label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-tertiary)', padding: '0 8px', marginBottom: 5 }}>
                {g.label}
              </div>
              {g.items.map(it => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="flex items-center gap-2.5"
                  style={{
                    padding: '10px 12px', borderRadius: 9, textDecoration: 'none', fontSize: '0.8rem',
                    color: isActive(it.href) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: isActive(it.href) ? 'var(--accent-primary-subtle)' : 'transparent',
                    fontWeight: isActive(it.href) ? 700 : 500,
                  }}
                >
                  <it.icon size={15} /> {it.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
