import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/theme-context'
import { ToastProvider } from '@/components/Toast'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'سیستم مدیریت KPI',
  description: 'مدیریت عملکرد و ارزیابی KPI کارکنان',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
