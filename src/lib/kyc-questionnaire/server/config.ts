/**
 * Configuration of kyc.ark-fid.ch. Everything lives on the SharePoint site "LBA - OAR"
 * (sites/LBA-OAR): client folders under "Dossiers LBA Clients", the lists "Suivi KYC" and
 * "Accès KYC". Nothing on the Interne site (owner decision, 30.10.2026).
 */

const env = (name: string) => (process.env[name] || "").trim();

export const KYC_SITE_ID = () => env("KYC_QF_SP_SITE_ID") || "arkfiduciaire.sharepoint.com,354ef18a-86f8-4752-b6ab-66f3ff0b63ed,3f9654c2-2e87-4092-8e9e-5dd048466688";
/** Library "Documents" of LBA - OAR: client folders given by Cadence must be in it. */
export const KYC_DRIVE_ID = () => env("KYC_QF_SP_DRIVE_ID") || "b!ivFONfiGUke2q2bz_wtj7cJUlj-HLpJAjp5d0EhGZohGTjv7e0KMSIdacpWmk4Dn";

export const TRACKER_LIST = () => env("KYC_QF_TRACKING_LIST") || "Suivi KYC";
export const ACCESS_LIST = () => env("KYC_QF_ACCESS_LIST") || "Accès KYC";

export const publicOrigin = () => env("KYC_QF_PUBLIC_ORIGIN") || "https://kyc.ark-fid.ch";
export const ALLOWED_ORIGINS = ["https://kyc.ark-fid.ch"];
export const extraOrigins = () => env("KYC_QF_ALLOWED_ORIGINS").split(",").map((v) => v.trim()).filter(Boolean);

/** One-time code e-mails (the only e-mails sent by this app; invitations are Cadence's). */
export const mailSender = () => env("KYC_QF_MAIL_SENDER") || "info@ark-fid.ch";

export const isProd = () => process.env.NODE_ENV === "production";
export const mockStorageEnabled = () => !isProd() && env("KYC_QF_STORAGE") === "mock";
export const skipTurnstile = () => !isProd() && env("KYC_QF_SKIP_TURNSTILE") === "1";

/** Link, session and code lifetimes. */
export const LINK_TTL_MS = 21 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 2 * 24 * 60 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function tokenSecret(): string | null {
  const value = env("KYC_QF_TOKEN_SECRET");
  return value.length >= 32 ? value : null;
}

/**
 * Cadence API keys, "keyId:secret" pairs separated by commas (two pairs during a rotation).
 * Distinct from the token secret: a leaked API key cannot forge client links, and the reverse.
 */
export function apiKeys(): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of env("KYC_QF_API_KEYS").split(",")) {
    const index = pair.indexOf(":");
    if (index <= 0) continue;
    const id = pair.slice(0, index).trim();
    const secret = pair.slice(index + 1).trim();
    if (/^[A-Za-z0-9_-]{2,40}$/.test(id) && secret.length >= 32) out.set(id, secret);
  }
  return out;
}
