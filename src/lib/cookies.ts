import { cookies } from "next/headers";

const CONSENT_KEY = "cookieConsent";

export function getConsentFromCookies(): "accepted" | "declined" | null {
  try {
    const c = cookies().get(CONSENT_KEY)?.value;
    if (c === "accepted" || c === "declined") return c;
    return null;
  } catch {
    return null;
  }
}
