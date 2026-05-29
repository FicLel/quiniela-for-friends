/**
 * proxy.ts — Next.js 16 Proxy (formerly Middleware).
 *
 * In Next.js 16, Middleware was renamed to Proxy. The file must be named
 * proxy.ts and export a named `proxy` function (or a default export).
 * Reference: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
 *
 * Responsibilities:
 * - Public assets (_next/*, /api/*, favicon.ico): pass through immediately.
 * - Unauthenticated access to any private route → redirect to /login.
 * - Authenticated user on /login → redirect to /auth/change-password (if
 *   mustChangePassword is true) or /welcome.
 * - Authenticated user on any private route with mustChangePassword = true →
 *   redirect to /auth/change-password (unless already there).
 * - Authenticated user on /auth/change-password with mustChangePassword = false
 *   → redirect to /welcome (password already changed).
 *
 * Uses AuthClient.getTokenFromRequest() because next/headers cookies() is
 * NOT available in the Proxy execution context.
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthClient } from '@/auth/AuthClient'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isLoginRoute = pathname === '/login'
  const isChangePasswordRoute = pathname.startsWith('/auth/change-password')
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'

  // Fast path: static assets and API routes never need auth checks.
  if (isPublicAsset) {
    return NextResponse.next()
  }

  const authClient = new AuthClient()
  const token = authClient.getTokenFromRequest(request)

  // Verify JWT; null means absent, expired, or tampered.
  const session = token ? await authClient.verifyToken(token) : null

  // Unauthenticated: redirect all private routes to /login.
  if (!session && !isLoginRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated: determine mustChangePassword for routing decisions.
  if (session) {
    const mustChange = session.mustChangePassword

    if (isLoginRoute) {
      const dest = mustChange ? '/auth/change-password' : '/welcome'
      return NextResponse.redirect(new URL(dest, request.url))
    }

    if (mustChange && !isChangePasswordRoute) {
      return NextResponse.redirect(new URL('/auth/change-password', request.url))
    }
    if (!mustChange && isChangePasswordRoute) {
      return NextResponse.redirect(new URL('/welcome', request.url))
    }
  }

  // Pass through.
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
