# DESIGN.md — سیستم مدیریت KPI

> نسخه: 1.0 — فرمت: Google Stitch DESIGN.md (الهام از Linear DESIGN.md)
> این سند، سیستم طراحی کامل پلتفرم است. هر agent ای که UI می‌سازد باید این سند را بخواند و دقیقاً از توکن‌های آن استفاده کند.

---

## 1. Visual Theme & Atmosphere (تم بصری و فضا)

پلتفرم مدیریت عملکرد (KPI) — یک **داشبورد SaaS حرفه‌ای** برای ۵۰ نفر نیرو.

- **حالت دارک پیش‌فرض است** (`data-theme="dark"`)، حالت لایت هم کاملاً پشتیبانی می‌شود.
- فضا: تمیز، مینیمال، داده‌محور — با الهام از Linear / TheBase / Synthesia.
- **رنگ تک‌اکسنت**: بنفش-آبی (Indigo) فقط برای تعامل‌ها (دکمه اصلی، لینک فعال، focus ring).
- **رنگ‌های معنایی** فقط برای وضعیت نمرات: سبز (عالی)، آبی (خوب)، زرد (متوسط)، قرمز (ضعیف).
- سلسله‌مراتب با **نردبان سطح (surface ladder)** + **حاشیه‌های مویی (hairline)** ساخته می‌شود، نه سایه سنگین.
- بک‌گراند: الگوی نقطه‌ای ظریف (الهام از Pattern Monster) — در هر دو تم.
- انیمیشن‌ها ظریف و کوتاه (fadeIn / slideUp) — بدون bounce یا float اضافی.

---

## 2. Color Palette & Roles (پالت رنگ و نقش‌ها)

### Dark Mode (پیش‌فرض) — `[data-theme="dark"]`

| توکن | مقدار | نقش |
|------|-------|-----|
| `--bg-primary` | `#0f1117` | بوم اصلی صفحه (canvas) |
| `--bg-secondary` | `#161822` | سطح ۱ — کارت‌ها |
| `--bg-tertiary` | `#1c1f2e` | سطح ۲ — هدر جدول، تب‌بار |
| `--bg-elevated` | `#1e2132` | سطح ۳ — مودال، منوی کشویی |
| `--bg-sidebar` | `#0a0c14` | سایدبار (گرادیانت ملایم به `#080a10`) |
| `--text-primary` | `#e8eaf0` | عنوان‌ها و متن اصلی |
| `--text-secondary` | `#9498a8` | متن ثانویه |
| `--text-tertiary` | `#6a6e82` | جزئیات، توضیحات |
| `--text-muted` | `#4a4e62` | placeholder، غیرفعال |
| `--border-primary` | `#262940` | حاشیه مویی کارت‌ها و جدول |
| `--border-secondary` | `#1e2132` | حاشیه داخلی |
| `--border-focus` | `#7c8ae0` | حاشیه فوکوس ورودی‌ها |
| `--accent-primary` | `#7c8ae0` | تک‌اکسنت — دکمه اصلی، لینک فعال |
| `--accent-primary-hover` | `#6b7ad0` | هاور دکمه اصلی |
| `--accent-primary-subtle` | `rgba(124,138,224,0.1)` | پس‌زمینه آیتم فعال منو |
| `--accent-success` | `#50c990` | نمره عالی (≥۸۰) |
| `--accent-warning` | `#f0b840` | نمره متوسط (۶۰-۷۹) |
| `--accent-danger` | `#f06868` | نمره ضعیف (<۶۰) |
| `--accent-info` | `#50b0e8` | نمره خوب (۷۰-۸۹) |

### Light Mode — `[data-theme="light"]`

| توکن | مقدار |
|------|-------|
| `--bg-primary` | `#fafbfc` |
| `--bg-secondary` | `#ffffff` |
| `--bg-tertiary` | `#f1f3f8` |
| `--text-primary` | `#1a1c2e` |
| `--text-secondary` | `#5c6173` |
| `--text-tertiary` | `#9498a8` |
| `--border-primary` | `#e2e5ed` |
| `--accent-primary` | `#5b6abf` |

**قواعد رنگ:**
- `--accent-primary` هرگز به‌عنوان پس‌زمینه کارت یا بخش استفاده نمی‌شود — فقط تعامل‌ها.
- نمرات فقط با `score-badge` رنگ می‌گیرند (هرگز متن عادی رنگی نمی‌شود).
- گرادیانت فقط در: دکمه اصلی، لوگو، ۴ کارت آمار داشبورد (stat-card).

---

## 3. Typography Rules (تایپوگرافی)

فونت: **Vazirmatn** (وزن‌های ۱۰۰ تا ۹۵۰) — از Google Fonts لود می‌شود.

| توکن | اندازه | وزن | کاربرد |
|------|--------|------|--------|
| `.page-title` | 1.5rem (24px) | 800 | عنوان صفحه (`letter-spacing: -0.02em`) |
| `.page-subtitle` | 0.85rem (13.6px) | 400 | زیرعنوان صفحه |
| کارت‌ها `h2` | 0.85rem | 700 | عنوان کارت |
| جدول `th` | 0.7rem | 600 | هدر ستون (`uppercase`) |
| جدول `td` | 0.85rem | 400 | سلول‌ها |
| `.btn` | 0.85rem | 600 | دکمه‌ها |
| `.badge` | 0.7rem | 600 | بج وضعیت |
| `.stat-card-value` | 1.75rem | 800 | عدد بزرگ آمار |

**قواعد تایپوگرافی:**
- RTL کامل — `direction: rtl` در `html` و `body`.
- متن همیشه راست‌چین؛ اعداد با `toPersianNums()` به ارقام فارسی تبدیل می‌شوند.
- سلسله‌مراتب واضح: عنوان `extrabold` → متن `medium` → جزئیات `light`.
- جدول‌ها `text-align: right` و `white-space: nowrap` در هدر.

---

## 4. Component Stylings (کامپوننت‌ها)

### دکمه‌ها — Fitts's Law (هدف ≥40px)

| کلاس | پس‌زمینه | متن | کاربرد |
|------|----------|------|--------|
| `.btn-primary` | گرادیانت accent | سفید | اقدام اصلی |
| `.btn-success` | گرادیانت سبز | سفید | ذخیره/تأیید |
| `.btn-danger` | گرادیانت قرمز | سفید | حذف |
| `.btn-ghost` | شفاف + حاشیه | ثانویه | اقدام ثانویه |

- پدینگ: `10px 20px`، شعاع: `10px`، `min-height: 40px`.
- کلیک: `transform: scale(0.97)`.
- `.btn-sm`: `6px 12px`، `.btn-lg`: `14px 28px`.

### کارت‌ها

- پس‌زمینه: `var(--bg-secondary)`، حاشیه: `1px solid var(--border-primary)`، شعاع: `12px`.
- سایه: `--shadow-card` ملایم (سایه به‌جای حاشیه‌های سنگین).
- هاور: `--shadow-card-hover` — **هرگز transform روی کارت‌ها نگذارید** (دکمه‌ها را جابجا می‌کند).
- **هدر ماژولار کارت (الهام از Nixtio — readability + modularity):**
  ```html
  <div class="card-header">
    <div class="card-header-title">
      <span class="card-header-icon">▣</span> عنوان
    </div>
    <Link href="/teams" class="btn btn-ghost btn-sm">مشاهده همه</Link>
  </div>
  ```
  - آیکون در چیپ `26px` با `--accent-primary-subtle`.
  - جداکننده مویی زیر هدر (`border-bottom: 1px solid var(--border-secondary)`).
  - اکشن اختیاری سمت چپ (RTL).

### فرم‌ها — Postel's Law

- پس‌زمینه `--bg-input`، حاشیه `1.5px solid var(--border-primary)`، شعاع `10px`، پدینگ `10px 14px`.
- فوکوس: `border-color: var(--border-focus)` + `box-shadow: 0 0 0 3px var(--accent-primary-subtle)`.
- `select` فلش سفارشی در سمت چپ دارد (`padding-left: 32px`).

### جدول

- `border-collapse: separate` با `border-spacing: 0`.
- هدر: `--bg-tertiary`، متن `--text-tertiary`، `uppercase`.
- هاور ردیف: `--bg-hover` (فقط تغییر background-color — بدون scale).

### مودال

- اورلی: `rgba(0,0,0,0.5)` + `backdrop-filter: blur(4px)`، انیمیشن `fadeIn`.
- محتوا: `--bg-secondary`، شعاع `16px`، `--shadow-xl`، انیمیشن `scaleIn`.

### بج نمره (score-badge)

| وضعیت | شرط | کلاس |
|-------|-----|------|
| عالی | ≥ ۸۰ | `score-excellent` (سبز) |
| خوب | ۷۰–۷۹ | `score-good` (آبی) |
| متوسط | ۶۰–۶۹ | `score-average` (زرد) |
| ضعیف | < ۶۰ | `score-poor` (قرمز) |

---

## 5. Layout Principles (اصول چیدمان)

- **سایدبار ثابت راست** (RTL): عرض 220px، حالت جمع‌شده 64px، موبایل → هدر 56px + منوی همبرگری تمام‌صفحه.
- محتوای اصلی: `margin-right: sidebarWidth` + `padding: 24px 32px`.
- گرید کارت‌ها: `grid-cols-2 lg:grid-cols-4` برای آمار، `lg:grid-cols-3` برای محتوا.
- فاصله‌گذاری: کارت‌ها `gap: 24px`، بین سکشن‌ها `margin-bottom: 24px`.
- موبایل (<768px): ستون‌های ۱-۲، جدول‌ها اسکرول افقی (`overflow-x: auto`).
- فضای سفید سخاوتمندانه (TheBase) — کارت‌ها پدینگ داخلی ≥20px.

---

## 6. Depth & Elevation (عمق و ارتفاع)

| سطح | روش |
|-----|-----|
| 0 | بدون سایه/حاشیه — متن و بک‌گراند |
| 1 | `--shadow-card` + حاشیه 1px — کارت‌ها |
| 2 | `--shadow-card-hover` — کارت hover |
| 3 | `--shadow-xl` — مودال |
| 4 | focus ring: `box-shadow 0 0 0 3px var(--accent-primary-subtle)` |

**سایه‌ها در دارک عمیق‌تر و خنک‌ترند** (`rgba(0,0,0,0.2)` تا `0.35`)، در لایت گرم و ملایم (`rgba(26,28,46,0.04)` تا `0.08`).

---

## 7. Do's and Don'ts (بایدها و نبایدها)

**باید:**
- ✅ از توکن‌های CSS متغیر استفاده کن — هرگز هاردکد رنگ.
- ✅ از کلاس‌های آماده استفاده کن: `.card`, `.btn-*`, `.table`, `.badge-*`, `.score-*`, `.tab`, `.modal-*`, `.stat-card`, `.empty-state`, `.info-box-*`.
- ✅ اعداد را با `toPersianNums()` فارسی کن، تاریخ‌ها را با `gregorianToJalaliStr()` شمسی کن.
- ✅ همه متن‌های UI فارسی باشند — حتی placeholder و aria-label.
- ✅ سایدبار: آیتم فعال با `--accent-primary-subtle` + نوار کناری 3px `--accent-primary`.
- ✅ انیمیشن فقط `animate-fadeIn` / `animate-slideUp` / `animate-scaleIn` — زیر ۰.۴ ثانیه.
- ✅ حداقل target لمسی: دکمه 40px، آیتم منو 38px.

**نباید:**
- ❌ `transform: translateY` روی کارت‌ها هنگام hover (دکمه‌ها جابجا می‌شوند).
- ❌ متن انگلیسی در UI — همه‌چیز فارسی.
- ❌ استفاده از accent به‌عنوان پس‌زمینه کارت کامل.
- ❌ انیمیشن‌های bounce/float/پررنگ.
- ❌ سایه‌های سنگین روی کارت‌ها — حاشیه‌های ظریف کافی‌اند.

---

## 8. Responsive Behavior (رفتار واکنش‌گرا)

| Breakpoint | رفتار |
|------------|-------|
| ≥768px | سایدبار کامل 220px با ساعت و منوی گروهی |
| <768px | هدر موبایل 56px (لوگو + ساعت کوچک + دکمه تم + همبرگر) + منوی کشویی تمام‌صفحه |
| <480px | گریدها تک‌ستونه، جدول‌ها اسکرول افقی |

- منوی موبایل با تغییر مسیر بسته می‌شود (`useEffect` روی `pathname`).
- سایدبار حالت جمع‌شده 64px: فقط آیکون‌ها + tooltip نوار فعال.

---

## 9. Agent Prompt Guide (راهنمای prompt برای agent)

هنگام ساخت هر صفحه جدید:

```
از توکن‌های DESIGN.md استفاده کن. تم دارک/لایت با data-theme.
- هدر صفحه: <h1 class="page-title"> + <p class="page-subtitle">
- کارت‌ها: class="card" با padding داخلی
- دکمه اصلی: class="btn btn-primary"، حذف: btn-danger، ثانویه: btn-ghost
- جدول: class="table" با thead/tbody
- بج وضعیت: badge badge-success/warning/danger/info
- نمرات: score-badge score-excellent/good/average/poor
- مودال: modal-overlay > modal-content > modal-header/modal-title/modal-close
- انیمیشن ورود: animate-fadeIn یا stagger-children
- اعداد فارسی: toPersianNums() — تاریخ شمسی: gregorianToJalaliStr()
- همه متن‌ها فارسی، RTL، فونت Vazirmatn
```

---

## منابع طراحی

- Linear DESIGN.md (VoltAgent/awesome-design-md) — ساختار سند و انضباط تک‌اکسنت
- Nixtio — Web App UI Design (Management Dashboard, Dribbble #26825384) — خوانایی، کامپوننت‌های ماژولار، معماری مقیاس‌پذیر
- thebase.design — مینیمالیسم و فضای سفید
- synthesia.io — الگوهای SaaS مدرن
- happyhues.co — پالت هماهنگ با سلسله‌مراتب
- pattern.monster — بافت نقطه‌ای پس‌زمینه
- lawsofux.com — قوانین Fitts, Hick, Miller, Jakob, Postel
- bookofshapes.com — اشکال هندسی در آیکون‌ها
- checklist.design — سازگاری کامپوننت‌ها و بازخورد