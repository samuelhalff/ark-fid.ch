import { NextRequest, NextResponse } from 'next/server'
import { locales } from './src/lib/i18n'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // Generate a per-request nonce for CSP
  const nonce = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 32)
  const isProd = process.env.NODE_ENV === 'production'

  // CSP: strict in production, relaxed in development for Next.js dev client
  const csp = (
    isProd
      ? [
          `default-src 'self'`,
          // Nonce-based inline scripts with strict-dynamic
          `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: http:`,
          // Allow inline styles for Tailwind and Next styles
          `style-src 'self' 'unsafe-inline'`,
          `img-src 'self' data: blob: https:`,
          `font-src 'self' data:`,
          `connect-src 'self' https: https://vitals.vercel-analytics.com`,
          `frame-ancestors 'self'`,
          `base-uri 'self'`,
          `form-action 'self'`,
          `object-src 'none'`,
        ]
      : [
          `default-src 'self'`,
          // Relax for dev: allow eval for source maps and dev client scripts
          `script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:`,
          `style-src 'self' 'unsafe-inline'`,
          `img-src 'self' data: blob: https:`,
          `font-src 'self' data:`,
          // Allow HMR/WebSocket in dev
          `connect-src 'self' http: https: ws: wss: https://vitals.vercel-analytics.com`,
          `frame-ancestors 'self'`,
          `base-uri 'self'`,
          `form-action 'self'`,
          `object-src 'none'`,
        ]
  ).join('; ')
  
  // Check if the path already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    // Extract locale and set it in headers for the pages to use
    const locale = pathname.split('/')[1]
    const response = NextResponse.next()
    response.headers.set('x-locale', locale)
    // Security headers
    response.headers.set('x-nonce', nonce)
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    response.headers.set('X-DNS-Prefetch-Control', 'on')
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  // Expect-CT was deprecated by Chrome in 2021; kept for legacy intermediaries
  response.headers.set('Expect-CT', 'max-age=0, enforce, report-uri="https://example.com/report"')
    if (isProd) {
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }
    return response
  }

  // If no locale in the path, redirect to the path with detected locale
  const locale = getLocale(request)
  const redirectUrl = new URL(`/${locale}${pathname}`, request.url)
  const response = NextResponse.redirect(redirectUrl)
  response.headers.set('x-nonce', nonce)
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  response.headers.set('Expect-CT', 'max-age=0, enforce, report-uri="https://example.com/report"')
  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  return response
}

function getLocale(request: NextRequest): string {
  // Check the accept-language header
  const acceptLanguage = request.headers.get('accept-language')
  
  if (acceptLanguage) {
    // Parse the accept-language header to find the best match
    const languages = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim())
      .map(lang => lang.split('-')[0]) // Get main language code
    
    for (const lang of languages) {
      if (locales.includes(lang as any)) {
        return lang
      }
    }
  }
  
  // Default to French
  return 'fr'
}

export const config = {
  // Skip only internal/static paths that should not be internationalized
  // Allow `ressources` and other content routes to be redirected to /<locale>/...
  matcher: ['/((?!_next|api|favicon.ico|assets).*)']
}
