import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // API_UPSTREAM is read at runtime (not inlined at build), so the same
    // image works for local dev (localhost:8000) and docker (backend:8000).
    const apiUrl = process.env.API_UPSTREAM
      || process.env.NEXT_PUBLIC_API_URL
      || 'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
