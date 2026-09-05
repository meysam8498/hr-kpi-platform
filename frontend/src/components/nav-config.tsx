/**
 * Navigation configuration — single source of truth for sidebar + command palette.
 */
import {
  LayoutDashboard, Bell, Star, UserCheck, Users, Target, TrendingUp,
  Building2, IdCard, CalendarX, HeartPulse, BarChart3, SlidersHorizontal,
  FileSpreadsheet, Settings2, CalendarClock, DatabaseBackup, ScrollText,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem { href: string; icon: LucideIcon; label: string; badge?: string }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
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
