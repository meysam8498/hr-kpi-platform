'use client'

import { useState, useRef, useEffect } from 'react'

/**
 * Jalali Date Picker — custom dropdown-based picker.
 * 
 * Value is a Jalali date string in "yyyy-mm-dd" format.
 * Uses the same gregorianToJalali / jalaliToGregorian logic from jalali.ts.
 */

// Gregorian ↔ Jalali conversion (duplicated from jalali.ts to keep this self-contained)
function div(a: number, b: number) { return Math.floor(a / b) }

function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let gy2 = gy; if (gm > 2) gy2 += 1
  const days = 355666 + 365 * gy2 + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + g_d_m[gm - 1]
  let jy = -1595 + 33 * div(days, 12053); let jd = days % 12053
  jy += 4 * div(jd, 1461); jd %= 1461
  if (jd > 365) { jy += div(jd - 1, 365); jd = (jd - 1) % 365 }
  let jm: number; let jdd: number
  if (jd < 186) { jm = 1 + div(jd, 31); jdd = 1 + (jd % 31) }
  else { jm = 7 + div(jd - 186, 30); jdd = 1 + ((jd - 186) % 30) }
  return [jy, jm, jdd]
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const jy1 = jy - 979; const jm1 = jm - 1; const jd1 = jd - 1
  let j_day_no = 365 * jy1 + div(jy1, 33) * 8 + div(jy1 % 33 + 3, 4)
  const month_days = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]
  const m_idx = jm1 < 7 ? jm1 : jm1 - 7
  for (let i = 0; i < m_idx; i++) j_day_no += month_days[i]
  j_day_no += jd1
  let g_day_no = j_day_no + 79
  let gy = 1600 + 400 * div(g_day_no, 146097); g_day_no %= 146097
  if (g_day_no > 36524) {
    g_day_no -= 1; gy += 100 * div(g_day_no, 36524); g_day_no %= 36524
    if (g_day_no >= 365) g_day_no += 1
  }
  gy += 4 * div(g_day_no, 1461); g_day_no %= 1461
  if (g_day_no > 365) { gy += div(g_day_no - 1, 365); g_day_no = (g_day_no - 1) % 365 }
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let gm = 1; let gd = g_day_no + 1; let i = 0
  while (i < 12 && gd > g_d_m[i]) { gm++; i++ }
  gd -= g_d_m[i - 1] || 0
  return [gy, gm, gd]
}

function parseJalali(str: string): [number, number, number] | null {
  if (!str) return null
  const parts = str.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  return [parts[0], parts[1], parts[2]]
}

function formatJalali(jy: number, jm: number, jd: number): string {
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`
}

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

const JALALI_MONTH_DAYS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

function toPersianNums(input: string | number): string {
  return String(input).replace(/\d/g, d => PERSIAN_DIGITS[parseInt(d)])
}

interface JalaliDatePickerProps {
  value: string // "yyyy-mm-dd" in Jalali
  onChange: (jalaliDate: string) => void
  placeholder?: string
  className?: string
}

export default function JalaliDatePicker({ value, onChange, placeholder = 'تاریخ شمسی', className = '' }: JalaliDatePickerProps) {
  const parsed = value ? parseJalali(value) : null
  const [jy, setJy] = useState(parsed?.[0] || 1404)
  const [jm, setJm] = useState(parsed?.[1] || 1)
  const [jd, setJd] = useState(parsed?.[2] || 1)

  // Update internal state when value prop changes
  useEffect(() => {
    const p = value ? parseJalali(value) : null
    if (p) { setJy(p[0]); setJm(p[1]); setJd(p[2]) }
  }, [value])

  const maxDay = JALALI_MONTH_DAYS[jm - 1] || 30

  // Ensure day is within valid range when month changes
  useEffect(() => {
    if (jd > maxDay) setJd(maxDay)
  }, [jm, maxDay, jd])

  const handleChange = (newY: number, newM: number, newD: number) => {
    const maxD = JALALI_MONTH_DAYS[newM - 1] || 30
    const clampedD = Math.min(newD, maxD)
    onChange(formatJalali(newY, newM, clampedD))
  }

  // Year range: 20 years back to 5 years forward from current Jalali year
  const now = new Date()
  const [currentJy] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const yearOptions: number[] = []
  for (let y = currentJy - 20; y <= currentJy + 5; y++) yearOptions.push(y)

  const dayOptions: number[] = []
  for (let d = 1; d <= maxDay; d++) dayOptions.push(d)

  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ direction: 'rtl' }}>
      {/* Day */}
      <select
        className="flex-1 p-3 text-sm rounded-xl text-center"
        value={jd}
        onChange={e => { const v = Number(e.target.value); setJd(v); handleChange(jy, jm, v) }}
      >
        {dayOptions.map(d => (
          <option key={d} value={d}>{toPersianNums(d)}</option>
        ))}
      </select>

      {/* Month */}
      <select
        className="flex-[2] p-3 text-sm rounded-xl text-center"
        value={jm}
        onChange={e => { const v = Number(e.target.value); setJm(v); handleChange(jy, v, jd) }}
      >
        {JALALI_MONTHS.map((name, idx) => (
          <option key={idx + 1} value={idx + 1}>{toPersianNums(idx + 1)} — {name}</option>
        ))}
      </select>

      {/* Year */}
      <select
        className="flex-[1.5] p-3 text-sm rounded-xl text-center"
        value={jy}
        onChange={e => { const v = Number(e.target.value); setJy(v); handleChange(v, jm, jd) }}
      >
        {yearOptions.map(y => (
          <option key={y} value={y}>{toPersianNums(y)}</option>
        ))}
      </select>
    </div>
  )
}
