/**
 * proxy.ts — Next.js 16 Proxy (formerly Middleware).
 *
 * In Next.js 16, Middleware was renamed to Proxy. The file must be named
 * proxy.ts and export a named `proxy` function (or a default export).
 * Reference: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
 *
 * Responsibilities:
 * - Public assets (_next/*, /api/*, favicon.ico): pass through immediately.
 * - Paths without a locale prefix: negotiate from Accept-Language header
 *   (defaulting to DEFAULT_LOCALE) and redirect to /{locale}{pathname}.
 * - Unauthenticated access to any private route → redirect to /{locale}/login.
 * - Authenticated user on /{locale}/login → redirect to
 *   /{locale}/auth/change-password (if mustChangePassword) or /{locale}/welcome.
 * - Authenticated user on any private route with mustChangePassword = true →
 *   redirect to /{locale}/auth/change-password (unless already there).
 * - Authenticated user on /{locale}/auth/change-password with
 *   mustChangePassword = false → redirect to /{locale}/welcome.
 *
 * Uses AuthClient.getTokenFromRequest() because next/headers cookies() is
 * NOT available in the Proxy execution context.
 */

import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'
import { NextRequest, NextResponse } from 'next/server'
import { AuthClient } from '@/auth/AuthClient'
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/i18n.types'

function negotiateLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get('accept-language') ?? ''
  const headers = { 'accept-language': acceptLanguage }
  const languages = new Negotiator({ headers }).languages()
  try {
    return match(languages, [...LOCALES], DEFAULT_LOCALE)
  } catch {
    return DEFAULT_LOCALE
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    /\.(png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|mp4|pdf)$/i.test(pathname)

  if (isPublicAsset) {
    return NextResponse.next()
  }

  // Detect if pathname already starts with a supported locale.
  const detectedLocale = LOCALES.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  )

  if (!detectedLocale) {
    // No locale prefix — negotiate and redirect.
    const locale = negotiateLocale(request)
    request.nextUrl.pathname = `/${locale}${pathname}`
    return NextResponse.redirect(request.nextUrl)
  }

  const locale = detectedLocale
  // Bare path without locale prefix (e.g. "/login", "/welcome").
  const barePath = pathname.slice(`/${locale}`.length) || '/'

  const isLoginRoute = barePath === '/login'
  const isChangePasswordRoute = barePath.startsWith('/auth/change-password')
  const isInviteRoute = barePath.startsWith('/invite/')
  const isResetPasswordRoute = barePath.startsWith('/reset-password/')

  const authClient = new AuthClient()
  const token = authClient.getTokenFromRequest(request)

  // Verify JWT; null means absent, expired, or tampered.
  const session = token ? await authClient.verifyToken(token) : null

  // Unauthenticated: redirect all private routes to /{locale}/login.
  if (!session && !isLoginRoute && !isInviteRoute && !isResetPasswordRoute) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
  }

  // Authenticated: determine mustChangePassword for routing decisions.
  if (session) {
    // Already logged in — no need for password reset.
    if (isResetPasswordRoute) {
      return NextResponse.redirect(new URL(`/${locale}/welcome`, request.url))
    }

    const mustChange = session.mustChangePassword

    if (isLoginRoute) {
      const dest = mustChange ? `/${locale}/auth/change-password` : `/${locale}/welcome`
      return NextResponse.redirect(new URL(dest, request.url))
    }

    if (mustChange && !isChangePasswordRoute) {
      return NextResponse.redirect(new URL(`/${locale}/auth/change-password`, request.url))
    }
    if (!mustChange && isChangePasswordRoute) {
      return NextResponse.redirect(new URL(`/${locale}/welcome`, request.url))
    }
  }

  // Pass through — forward x-locale so app/layout.tsx can read it via headers().
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-locale', locale)
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
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
