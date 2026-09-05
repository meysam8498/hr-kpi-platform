import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/theme-context'
import { ToastProvider } from '@/components/Toast'

export const metadata: Metadata = {
  title: 'سیستم مدیریت KPI',
  description: 'مدیریت عملکرد و ارزیابی KPI کارکنان',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
