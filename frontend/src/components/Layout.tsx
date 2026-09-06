'use client'

/**
 * AppLayout — thin shell around the top navbar.
 * Redirects to /login when there is no session.
 */
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import TopNav from '@/components/TopNav'
import HelpStrip from '@/components/HelpStrip'
import CommandPalette from '@/components/CommandPalette'
import { useAuth } from '@/lib/auth-context'

const PUBLIC_PATHS = ['/login']

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      router.replace('/login')
    }
  }, [loading, user, isPublic, pathname, router])

  // Session still loading → blank to avoid flashing the login redirect
  if (!isPublic && loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
        <div
          className="inline-block animate-spin rounded-full"
          style={{ width: 36, height: 36, border: '3px solid var(--border-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // Not logged in and not on a public page → render nothing while redirecting
  if (!isPublic && !user) return null

  if (isPublic) return <>{children}</>

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav />
      <main
        style={{
          padding: '22px clamp(16px, 4vw, 36px) 40px',
          maxWidth: 1440,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div className="route-fade" key={pathname}>
          <HelpStrip />
          {children}
        </div>
      </main>
    </div>
  )
}
