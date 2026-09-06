/**
 * Navigation configuration — single source of truth for the top navbar,
 * mobile menu, and command palette.
 *
 * Each group can define `roles`: which roles see the whole group.
 * Each item can define `roles`: which roles see that item.
 * An item/group without roles is visible to everyone (any logged-in user).
 */
import {
  LayoutDashboard, Bell, Star, UserCheck, Users, Target, TrendingUp,
  Building2, IdCard, CalendarX, HeartPulse, BarChart3, SlidersHorizontal,
  FileSpreadsheet, Settings2, CalendarClock, DatabaseBackup, ScrollText,
  UserCog, Info, type LucideIcon,
} from 'lucide-react'

export type AppRole = 'admin' | 'hr' | 'manager' | 'employee'

export interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  roles?: AppRole[]
}
export interface NavGroup {
  label: string
  icon: LucideIcon
  items: NavItem[]
  roles?: AppRole[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'اصلی',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'داشبورد' },
      { href: '/notifications', icon: Bell, label: 'اعلان‌ها' },
      { href: '/about', icon: Info, label: 'درباره برنامه' },
    ],
  },
  {
    label: 'عملیات',
    icon: Star,
    items: [
      { href: '/scoring', icon: Star, label: 'امتیازدهی', roles: ['admin', 'hr', 'manager'] },
      { href: '/self-eval', icon: UserCheck, label: 'خودارزیابی' },
      { href: '/peer-reviews', icon: Users, label: 'ارزیابی ۳۶۰' },
      { href: '/goals', icon: Target, label: 'اهداف' },
      { href: '/pips', icon: TrendingUp, label: 'طرح بهبود', roles: ['admin', 'hr', 'manager'] },
    ],
  },
  {
    label: 'مدیریت',
    icon: Building2,
    items: [
      { href: '/teams', icon: Building2, label: 'تیم‌ها' },
      { href: '/employees', icon: IdCard, label: 'کارمندان' },
      { href: '/absences', icon: CalendarX, label: 'غیبت‌ها' },
      { href: '/users', icon: UserCog, label: 'کاربران', roles: ['admin'] },
    ],
  },
  {
    label: 'گزارش‌ها',
    icon: BarChart3,
    items: [
      { href: '/hr', icon: HeartPulse, label: 'داشبورد منابع انسانی', roles: ['admin', 'hr'] },
      { href: '/reports', icon: BarChart3, label: 'گزارش‌ها' },
      { href: '/custom-reports', icon: SlidersHorizontal, label: 'گزارش سفارشی', roles: ['admin', 'hr', 'manager'] },
      { href: '/excel', icon: FileSpreadsheet, label: 'اکسل', roles: ['admin', 'hr', 'manager'] },
    ],
  },
  {
    label: 'تنظیمات',
    icon: Settings2,
    roles: ['admin', 'hr'],
    items: [
      { href: '/admin/config', icon: Settings2, label: 'تنظیمات KPI', roles: ['admin', 'hr'] },
      { href: '/admin/periods', icon: CalendarClock, label: 'دوره‌ها', roles: ['admin', 'hr'] },
      { href: '/backup', icon: DatabaseBackup, label: 'پشتیبان‌گیری', roles: ['admin'] },
      { href: '/audit', icon: ScrollText, label: 'گزارش فعالیت', roles: ['admin', 'hr'] },
    ],
  },
]

/** Filter nav groups by role (null → full access, e.g. legacy no-auth mode). */
export function navForRole(role: AppRole | null): NavGroup[] {
  if (!role) return NAV_GROUPS
  return NAV_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(it => !it.roles || it.roles.includes(role)),
    }))
    .filter(g => (!g.roles || g.roles.includes(role)) && g.items.length > 0)
}
