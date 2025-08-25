import { NextRequest, NextResponse } from 'next/server'
import { locales } from './src/lib/i18n'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Check if the path already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    // Extract locale and set it in headers for the pages to use
    const locale = pathname.split('/')[1]
    const response = NextResponse.next()
    response.headers.set('x-locale', locale)
    return response
  }

  // If no locale in the path, redirect to the path with detected locale
  const locale = getLocale(request)
  const redirectUrl = new URL(`/${locale}${pathname}`, request.url)
  return NextResponse.redirect(redirectUrl)
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
