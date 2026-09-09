'use client'

/**
 * Auth context — stores the JWT + user in localStorage, exposes login/logout.
 * The API client reads the token from localStorage on every request.
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

export interface AuthUser {
  id: number
  username: string
  full_name: string
  role: 'admin' | 'hr' | 'manager' | 'employee'
  team_id: number | null
  employee_id: number | null
  is_active: boolean
  managed_team_ids?: number[]
  extra_employee_ids?: number[]
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
})

export const ROLE_LABELS: Record<AuthUser['role'], string> = {
  admin: 'مدیر سیستم',
  hr: 'مدیر منابع انسانی',
  manager: 'مدیر تیم',
  employee: 'کارمند',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session; ask the backend /me to validate the token.
    const token = localStorage.getItem('auth-token')
    if (!token) { setLoading(false); return }
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((u: AuthUser) => setUser(u))
      .catch(() => { localStorage.removeItem('auth-token') })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'خطا در ورود')
    localStorage.setItem('auth-token', data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth-token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
