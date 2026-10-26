/** Swiss formatting helpers (CHF 1'234.50, dd.mm.yyyy). Pure, shared by browser and server. */

/** Parses "1'234.50", "1 234,5", "CHF 1234" → 1234.5; null when not a number. */
export function parseAmount(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/^(CHF|EUR|USD|GBP)\s*/i, "").replace(/['’\s  ]/g, "");
  if (!s) return null;
  // "1.234,50" (German style) → 1234.50 ; "1234,5" → 1234.5
  // (a single "1.234" stays a decimal number).
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+(,\d+)$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 1234.5 → "1'234.50" (Swiss grouping, always two decimals). */
export function formatAmount(n: number): string {
  const negative = n < 0;
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${negative ? "-" : ""}${grouped}.${dec}`;
}

/** Normalises an amount as typed; returns the input unchanged when it is not a number. */
export function normaliseAmount(raw: string): string {
  const n = parseAmount(raw);
  return n === null ? raw : formatAmount(n);
}

export interface DateParts {
  day: number;
  month: number;
  year: number;
}

/** Accepts d.m.yyyy, dd/mm/yyyy, dd-mm-yyyy and yyyy-mm-dd; checks the calendar. */
export function parseDate(raw: string | undefined | null): DateParts | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  let day: number, month: number, year: number;
  if (m) {
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]);
  } else {
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return { day, month, year };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDate(parts: DateParts): string {
  return `${pad(parts.day)}.${pad(parts.month)}.${parts.year}`;
}

/** Normalises a date as typed to dd.mm.yyyy; unchanged when invalid. */
export function normaliseDate(raw: string): string {
  const parts = parseDate(raw);
  return parts ? formatDate(parts) : raw;
}

/** Date as a UTC Date (for Excel cells). */
export function dateToUtc(parts: DateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/** Today as dd.mm.yyyy in Swiss time. */
export function todaySwiss(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}

/** Date and time in Swiss time: "dd.mm.yyyy hh:mm". */
export function nowSwiss(now = new Date()): string {
  const time = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return `${todaySwiss(now)} ${time}`;
}
