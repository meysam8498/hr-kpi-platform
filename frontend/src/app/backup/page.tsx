'use client'

import { useEffect, useRef, useState } from 'react'
import { DatabaseBackup, Download, RotateCcw, Info, ShieldCheck } from 'lucide-react'
import AppLayout from '@/components/Layout'
import { backupApi } from '@/lib/api'
import { toPersianNums } from '@/lib/jalali'

export default function BackupPage() {
  const [info, setInfo] = useState<{ size_mb: number; last_modified: string; database_path: string } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    backupApi.info().then(setInfo).catch(() => {})
  }, [])

  const doRestore = async (file: File) => {
    setRestoring(true)
    setMsg(null)
    try {
      const res = await backupApi.restore(file)
      setMsg({ type: 'ok', text: res.message || 'دیتابیس بازیابی شد' })
      const fresh = await backupApi.info()
      setInfo(fresh)
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'خطا در بازیابی' })
    } finally {
      setRestoring(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="page-header">
          <div className="flex items-center gap-3">
            <span className="card-header-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <DatabaseBackup size={21} />
            </span>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>پشتیبان‌گیری</h1>
              <p className="page-subtitle">دانلود نسخه پشتیبان از دیتابیس یا بازیابی از فایل — برای ابزار محلی منابع انسانی ضروری است</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Download */}
          <div className="card" style={{ padding: 24 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><Download size={14} /></span>
                دانلود نسخه پشتیبان
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '12px 0 16px' }}>
              یک کپی کامل از دیتابیس SQLite (شامل کارمندان، نمرات، پیکربندی‌ها) به صورت فایل دانلود می‌شود.
            </div>
            {info && (
              <div className="info-box info-box-primary" style={{ marginBottom: 16 }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.7rem' }}>حجم دیتابیس</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{toPersianNums(String(info.size_mb))} مگابایت</span>
                </div>
              </div>
            )}
            <a className="btn btn-primary" href={backupApi.downloadUrl()} style={{ textDecoration: 'none', display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
              <Download size={15} /> دانلود فایل پشتیبان
            </a>
          </div>

          {/* Restore */}
          <div className="card" style={{ padding: 24 }}>
            <div className="card-header">
              <div className="card-header-title">
                <span className="card-header-icon"><RotateCcw size={14} /></span>
                بازیابی از فایل
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '12px 0 16px' }}>
              فایل پشتیبان (db.) را انتخاب کنید تا جایگزین دیتابیس فعلی شود. <b>داده‌های فعلی با این کار جایگزین می‌شوند.</b>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) doRestore(f)
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                border: '1px dashed var(--border-primary)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
              }}
            />
            {restoring && (
              <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
                <div className="spinner" style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>در حال بازیابی…</span>
              </div>
            )}
            {msg && (
              <div
                className={msg.type === 'ok' ? 'info-box info-box-success' : 'info-box info-box-danger'}
                style={{ marginTop: 16 }}
              >
                {msg.text}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 20, marginTop: 24 }}>
          <div className="card-header">
            <div className="card-header-title">
              <span className="card-header-icon"><ShieldCheck size={14} /></span>
              اطلاعات فنی
            </div>
          </div>
          {info ? (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', direction: 'ltr', textAlign: 'left', marginTop: 8 }}>
              {info.database_path}
            </div>
          ) : (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>—</div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}