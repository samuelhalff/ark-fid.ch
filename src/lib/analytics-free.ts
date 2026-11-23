/**
 * Pages that load no analytics at all (Sam, 23.11.2026): the KYC form
 * (kyc.ark-fid.ch, /<locale>/questionnaire-kyc/, signature steps included)
 * and the tax questionnaire (tax.ark-fid.ch, /<locale>/questionnaire-fiscal/),
 * both of which collect client data. No GTM, no gtag/GA4, no PostHog (not
 * even in memory), no OpenAI pixel, no attribution copy, no cookie banner.
 *
 * Enforced in three places:
 * - middleware.ts sets ANALYTICS_FREE_HEADER and the stricter CSP below
 *   (no third-party script or connect host apart from Turnstile);
 * - app/layout.tsx skips the Consent Mode bootstrap and every tracker;
 * - posthog-lazy and trackEvent drop everything at runtime on these pages.
 * Dependency-free for `node --test`.
 */
export const ANALYTICS_FREE_HEADER = "x-analytics-free";

const ANALYTICS_FREE_HOSTS = ["kyc.", "tax."];
const ANALYTICS_FREE_PATH = /(^|\/)(questionnaire-kyc|questionnaire-fiscal)(\/|$)/;

export function isAnalyticsFree(hostname: string, pathname: string): boolean {
  const host = (hostname || "").toLowerCase().split(":")[0];
  if (ANALYTICS_FREE_HOSTS.some((prefix) => host.startsWith(prefix))) return true;
  return ANALYTICS_FREE_PATH.test(pathname || "/");
}

/** Turnstile (anti-bot check of the tax questionnaire) is the only third party allowed. */
const TURNSTILE = "https://challenges.cloudflare.com";

/** CSP of the analytics-free pages: same origin only, plus Turnstile. */
export function analyticsFreeCsp(nonce: string, isProd: boolean): string {
  const directives = isProd
    ? [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE}`,
        `script-src-attr 'none'`,
        `style-src 'self' 'unsafe-inline'`,
        `font-src 'self' data:`,
        `connect-src 'self' ${TURNSTILE}`,
        `img-src 'self' data: blob:`,
        `frame-src 'self' ${TURNSTILE}`,
        `frame-ancestors 'self'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `object-src 'none'`,
        `worker-src 'self' blob:`,
      ]
    : [
        `default-src 'self'`,
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${TURNSTILE}`,
        `style-src 'self' 'unsafe-inline'`,
        `font-src 'self' data:`,
        `connect-src 'self' ws: wss: ${TURNSTILE}`,
        `img-src 'self' data: blob:`,
        `frame-src 'self' ${TURNSTILE}`,
        `frame-ancestors 'self'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `object-src 'none'`,
        `worker-src 'self' blob:`,
      ];
  return `${directives.join("; ")}; trusted-types nextjs#bundler goog#html 'allow-duplicates'`;
}
