/**
 * Jalali (Shamsi/Persian) Calendar Conversion Utilities.
 *
 * Algorithm based on: https://en.wikipedia.org/wiki/Jalali_calendar
 * Uses standard Gregorian-to-Jalali conversion for dates stored as
 * Gregorian in the database, displayed as Jalali in the UI.
 *
 * Format: yyyy-mm-dd in Jalali calendar.
 */

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

const JALALI_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

/*
 * Conversion core — based on the jalaali-js algorithm
 * (Kazimierz M. Borkowski, "The Persian calendar for 3000 years").
 * Verified against known Nowruz dates and round-trip conversions.
 */

function div(a: number, b: number): number {
  return ~~(a / b)
}

function mod(a: number, b: number): number {
  return a - ~~(a / b) * b
}

// Jalaali years starting the 33-year rule (jalaali-js)
const J_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]

function jalCal(jy: number, withoutLeap = false): { leap?: number; gy: number; march: number } {
  const bl = J_BREAKS.length
  const gy = jy + 621
  let leapJ = -14
  let jp = J_BREAKS[0]
  let jm = 0
  let jump = 0
  let leap = 0
  let n = 0
  let i: number

  if (jy < jp || jy >= J_BREAKS[bl - 1]) {
    throw new Error('Invalid Jalaali year ' + jy)
  }

  for (i = 1; i < bl; i += 1) {
    jm = J_BREAKS[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  n = jy - jp

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG

  if (withoutLeap) {
    return { gy, march }
  }

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4

  return { leap, gy, march }
}

function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5)
    + gd - 34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy, true)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

function d2j(jdn: number): [number, number, number] {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy, false)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  let jm: number
  let jd: number

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31)
      jd = mod(k, 31) + 1
      return [jy, jm, jd]
    }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }

  jm = 7 + div(k, 30)
  jd = mod(k, 30) + 1
  return [jy, jm, jd]
}

function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  return d2j(g2d(gy, gm, gd))
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const r = d2g(j2d(jy, jm, jd))
  return [r.gy, r.gm, r.gd]
}

/**
 * Convert a Gregorian date string (yyyy-mm-dd or ISO) to Jalali date string.
 * Output format: yyyy-mm-dd in Jalali calendar.
 */
export function gregorianToJalaliStr(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`
}

/**
 * Convert a Jalali date string (yyyy-mm-dd) to Gregorian ISO string.
 */
export function jalaliToGregorianStr(jalaliStr: string): string {
  if (!jalaliStr) return ''
  const parts = jalaliStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return jalaliStr
  const [gy, gm, gd] = jalaliToGregorian(parts[0], parts[1], parts[2])
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
}

/**
 * Format Jalali date for display with month name.
 * e.g. "۱۴۰۴-۰۱-۰۱ — فروردین"
 */
export function jalaliDisplay(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const jyStr = toPersianNums(jy)
  const jmStr = toPersianNums(String(jm).padStart(2, '0'))
  const jdStr = toPersianNums(String(jd).padStart(2, '0'))
  return `${jyStr}-${jmStr}-${jdStr} — ${JALALI_MONTHS[jm - 1] || ''}`
}

/**
 * Convert English/Persian digits to Persian.
 */
export function toPersianNums(input: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(input).replace(/\d/g, d => persianDigits[parseInt(d)])
}

/**
 * Convert Persian/Arabic digits to English digits.
 * e.g. "۱۴۰۵" → "1405" — useful before parseInt / arithmetic.
 */
export function toEnglishNums(input: string | number): string {
  return String(input)
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

/**
 * Get current Jalali date-time string.
 */
export function nowJalali(): string {
  const now = new Date()
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const hours = toPersianNums(String(now.getHours()).padStart(2, '0'))
  const mins = toPersianNums(String(now.getMinutes()).padStart(2, '0'))
  return `${toPersianNums(jy)}-${toPersianNums(String(jm).padStart(2, '0'))}-${toPersianNums(String(jd).padStart(2, '0'))}  🕐  ${hours}:${mins}`
}

/**
 * Get weekday name for a date.
 */
export function jalaliWeekday(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return JALALI_WEEKDAYS[d.getDay()]
}

/**
 * Get Jalali month name.
 */
export function jalaliMonthName(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const [, jm] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return JALALI_MONTHS[jm - 1] || ''
}
