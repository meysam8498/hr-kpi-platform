'use client'

/**
 * HelpStrip — یک نوار راهنمای کوتاه بالای هر صفحه.
 *
 * اصل: «برای همه چیز توضیح داشته باش» — هر صفحه با یک جمله فارسی ساده
 * توضیح می‌دهد چه کاری انجام می‌دهد، بدون آنکه پیچیدگی اضافه کند.
 * کاربر می‌تواند هر صفحه را ببندد (به‌ازای هر مسیر جداگانه ذخیره می‌شود).
 */
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Lightbulb, X } from 'lucide-react'

const HELP: Record<string, string> = {
  '/dashboard': 'نمای کلی عملکرد همه تیم‌ها و کارمندان. دوره فعال را از همین‌جا عوض کنید.',
  '/notifications': 'رویدادهای سیستم: تایم‌لاین امتیازدهی، طرح‌های بهبود و یادآورها.',
  '/scoring': 'ورود نمره ۰ تا ۱۰۰ کارمندان تیم توسط مدیر. برای اعمال نمره‌ها دکمه «ثبت» را بزنید.',
  '/self-eval': 'کارمند نمره خودش را وارد می‌کند؛ در گزارش، مقایسه با نمره مدیر نمایش داده می‌شود.',
  '/peer-reviews': 'ارزیابی همکار به همکار (۳۶۰ درجه). میانگین آن با وزن مشخص در نمره نهایی لحاظ می‌شود.',
  '/goals': 'هدف‌گذاری کارمند با وزن و درصد پیشرفت؛ درصد تحقق هدف در نمره نهایی ترکیب می‌شود.',
  '/pips': 'طرح بهبود عملکرد: اگر کارمند ۲ دوره متوالی زیر ۶۰ بگیرد، خودکار اینجا ساخته می‌شود.',
  '/teams': 'ساخت تیم، تعیین مدیر تیم و عضوکردن کارمندان. هر کارمند فقط یک تیم دارد.',
  '/employees': 'مدیریت پروفایل کارمندان: افزودن، ویرایش، انتقال بین تیم‌ها و آرشیو نیروی خارج‌شده.',
  '/absences': 'ثبت مرخصی و غیبت؛ درصد حضور در محاسبه نهایی لحاظ می‌شود.',
  '/hr': 'شاخص‌های منابع انسانی: نرخ حضور، اضافه‌کاری، روند جذب و خروج نیرو.',
  '/reports': 'گزارش فردی و تیمی با نمودار روند، رادار معیارها و خروجی چاپ/PDF.',
  '/custom-reports': 'گزارش دلخواه: تیم و بازه زمانی را انتخاب کنید و نتیجه را فیلتر یا خروجی بگیرید.',
  '/excel': 'دانلود اکسل امتیازدهی برای مدیران و بازگرداندن فایل پُرشده به سیستم.',
  '/admin/config': 'تعریف معیارهای KPI، وزن هر معیار و ترکیب نمره نهایی. بدون نیاز به کدنویسی.',
  '/admin/periods': 'ساخت دوره‌های امتیازدهی (ماهانه/فصلی)، فعال‌سازی و آرشیو دوره‌های گذشته.',
  '/backup': 'دریافت نسخه پشتیبان کامل دیتابیس و بازگرداندن آن در زمان نیاز.',
  '/audit': 'تاریخچه همه تغییرات سیستم: چه کسی، چه زمانی، چه چیزی را تغییر داد.',
}

export default function HelpStrip() {
  const pathname = usePathname()
  const text = HELP[pathname]
  const [hidden, setHidden] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(false)
    if (!text) return
    try {
      setHidden(window.localStorage.getItem(`help-closed:${pathname}`) === '1')
    } catch { /* private mode */ }
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [pathname, text])

  if (!text || !mounted || hidden) return null

  const dismiss = () => {
    setHidden(true)
    try { window.localStorage.setItem(`help-closed:${pathname}`, '1') } catch { /* noop */ }
  }

  return (
    <div
      role="note"
      aria-label="راهنمای این صفحه"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        maxWidth: 1100, margin: '0 auto 18px',
        padding: '10px 14px', borderRadius: 12,
        background: 'var(--accent-primary-subtle)',
        border: '1px solid var(--accent-primary-glow)',
        color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.8,
      }}
    >
      <Lightbulb size={15} style={{ flexShrink: 0, marginTop: 3, color: 'var(--accent-primary)' }} />
      <span style={{ flex: 1 }}>{text}</span>
      <button
        onClick={dismiss}
        aria-label="بستن راهنما"
        title="بستن راهنما"
        style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: 'none',
          background: 'transparent', color: 'var(--text-tertiary)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
