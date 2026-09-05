'use client'

import {
  Building2, IdCard, CalendarX, CalendarDays, Target, PieChart, Activity,
  Users, ClipboardList, AlertTriangle, Medal, Download, RotateCcw, Info,
  Settings2, FileDown, FileUp, Pin, BarChart3, TrendingUp, Trophy, Award,
  Sparkles, Scale, type LucideIcon,
} from 'lucide-react'

/* ─── Tiny glyph → lucide icon mapper for card headers & icon tiles ───
   Lets older pages swap their unicode glyph tiles for real icons with a
   single import (no per-icon imports needed). */

const GLYPH_MAP: Record<string, LucideIcon> = {
  '▣': Building2,       // teams / group
  '▢': IdCard,          // employees / people
  '◷': CalendarX,       // absence / calendar minus
  '◔': PieChart,        // distribution (half)
  '◐': PieChart,        // distribution
  '◉': Activity,        // live / overview
  '◎': Target,          // goals / target
  '◬': Users,           // 360 peers
  '📋': ClipboardList,  // checklist / list
  '⚠': AlertTriangle,   // warning
  '⚠️': AlertTriangle,
  '🏅': Medal,          // medal / top
  '⬇': Download,
  '↻': RotateCcw,
  'ℹ': Info,
  '⚙': Settings2,
  '📥': FileDown,
  '📤': FileUp,
  '📌': Pin,
  '🎯': Target,
  '🏆': Trophy,
  '📊': BarChart3,
  '📈': TrendingUp,
}

export default function HeadIcon({ glyph, size = 14 }: { glyph: string; size?: number }) {
  const Icon = GLYPH_MAP[glyph] || Sparkles
  return <Icon size={size} strokeWidth={2} />
}
