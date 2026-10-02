import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Pure helpers for the assistant of lba.ark-fid.ch (app/api/lba/chat/route.ts).
 * The assistant answers questions about the Swiss AMLA adviser rules and the transparency register,
 * grounded on the texts shipped in its Foundry agent definition (see scripts/lba-agent-sync.mjs).
 */

export const LBA_CHAT_LOCALES = ["fr", "en", "de", "es", "pt"] as const;
export type LbaChatLocale = (typeof LBA_CHAT_LOCALES)[number];

export const LBA_CHAT_LIMITS = {
  maxMessages: 12,
  maxUserChars: 1500,
  maxHistoryChars: 6000,
  sessionTtlMs: 3 * 60 * 60 * 1000,
  maxTurnsPerSession: 30,
} as const;

/**
 * The closing sentence of every reply. It is appended by the server, never left to the model, so a
 * reply cannot go out without it.
 */
export const LBA_CHAT_DISCLAIMER: Record<LbaChatLocale, string> = {
  fr: "Ceci n'est pas un conseil juridique. Information générale uniquement : faites vérifier toute situation particulière par un conseil qualifié.",
  en: "This is not legal advice. General information only: have any specific situation checked by a qualified adviser.",
  de: "Dies ist keine Rechtsberatung. Nur allgemeine Information: Lassen Sie jeden konkreten Fall von einer qualifizierten Fachperson prüfen.",
  es: "Esto no constituye asesoramiento jurídico. Información general únicamente: haga verificar cualquier situación concreta por un asesor cualificado.",
  pt: "Isto não constitui aconselhamento jurídico. Apenas informação geral: peça a um consultor qualificado que verifique qualquer situação concreta.",
};

/** Sent when Azure's content filter blocks a prompt: a normal reply, not an error. */
export const LBA_CHAT_REFUSAL: Record<LbaChatLocale, string> = {
  fr: "Je ne peux pas répondre à cette demande. Je réponds uniquement aux questions sur le régime des conseillers LBA et sur le registre de transparence.",
  en: "I can't help with that request. I only answer questions about the AMLA adviser regime and the transparency register.",
  de: "Bei dieser Anfrage kann ich nicht helfen. Ich beantworte nur Fragen zum GwG-Beraterregime und zum Transparenzregister.",
  es: "No puedo ayudar con esa solicitud. Solo respondo a preguntas sobre el régimen de asesores de la LBA y el registro de transparencia.",
  pt: "Não posso ajudar com esse pedido. Só respondo a perguntas sobre o regime dos consultores da LBA e o registo de transparência.",
};

const DISCLAIMER_HINTS = [
  /pas un conseil juridique/i,
  /not legal advice/i,
  /keine rechtsberatung/i,
  /no constituye asesoramiento jur[ií]dico/i,
  /n[ãa]o constitui aconselhamento jur[ií]dico/i,
];

/** Removes a closing disclaimer the model may have written itself, then appends the canonical one. */
export function withDisclaimer(reply: string, locale: LbaChatLocale): string {
  const paragraphs = reply.trim().split(/\n{2,}/);
  while (paragraphs.length > 1) {
    const last = paragraphs[paragraphs.length - 1];
    if (last.length < 420 && DISCLAIMER_HINTS.some((re) => re.test(last))) paragraphs.pop();
    else break;
  }
  return `${paragraphs.join("\n\n").trim()}\n\n${LBA_CHAT_DISCLAIMER[locale]}`;
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(LBA_CHAT_LIMITS.maxHistoryChars),
});

export const lbaChatRequestSchema = z.object({
  locale: z.enum(LBA_CHAT_LOCALES),
  messages: z.array(messageSchema).min(1).max(LBA_CHAT_LIMITS.maxMessages),
  session: z.string().max(400).optional(),
  // Required with the first question (no session yet): the visitor's email, kept as a lead.
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export type LbaChatRequest = z.infer<typeof lbaChatRequestSchema>;

export type LbaChatValidation =
  | { ok: true; data: LbaChatRequest }
  | { ok: false; error: "invalid_request" | "invalid_email" | "payload_too_large" };

export function validateLbaChatRequest(body: unknown): LbaChatValidation {
  const parsed = lbaChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "email")) return { ok: false, error: "invalid_email" };
    const tooLong = parsed.error.issues.some((issue) => issue.code === "too_big");
    return { ok: false, error: tooLong ? "payload_too_large" : "invalid_request" };
  }
  const { messages } = parsed.data;
  const last = messages[messages.length - 1];
  if (last.role !== "user") return { ok: false, error: "invalid_request" };
  if (last.content.trim().length === 0) return { ok: false, error: "invalid_request" };
  if (last.content.length > LBA_CHAT_LIMITS.maxUserChars) return { ok: false, error: "payload_too_large" };
  return { ok: true, data: parsed.data };
}

// ---- Session token: issued once the visitor gave an email and passed Turnstile -----------------

const TOKEN_CONTEXT = "lba-chat-session-v2";

const sign = (secret: string, id: string, expiresAt: number, leadId: number) =>
  createHmac("sha256", secret).update(JSON.stringify([TOKEN_CONTEXT, id, expiresAt, leadId])).digest("hex");

/** `leadId` is the Odoo lead the conversation is attached to (0 when none, e.g. internal users). */
export function issueLbaChatSession(secret: string, leadId = 0, now = Date.now()): string {
  const id = randomBytes(12).toString("hex");
  const expiresAt = now + LBA_CHAT_LIMITS.sessionTtlMs;
  const lead = Number.isSafeInteger(leadId) && leadId > 0 ? leadId : 0;
  return `${id}.${expiresAt}.${lead}.${sign(secret, id, expiresAt, lead)}`;
}

/** Returns the session when the token is authentic and not expired, otherwise null. */
export function verifyLbaChatSession(
  secret: string,
  token: string | undefined,
  now = Date.now(),
): { id: string; leadId: number } | null {
  if (!token) return null;
  const [id, expiresRaw, leadRaw, signature, ...rest] = token.split(".");
  if (rest.length > 0 || !id || !expiresRaw || !leadRaw || !signature) return null;
  if (
    !/^[a-f0-9]{24}$/.test(id) ||
    !/^\d{13}$/.test(expiresRaw) ||
    !/^\d{1,12}$/.test(leadRaw) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return null;
  }
  const expiresAt = Number(expiresRaw);
  const leadId = Number(leadRaw);
  if (expiresAt <= now) return null;
  const expected = Buffer.from(sign(secret, id, expiresAt, leadId), "hex");
  const given = Buffer.from(signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { id, leadId };
}

export const LBA_INTERNAL_EMAIL_DOMAINS = new Set(["ark-fid.ch", "pbm.law"]);
export const emailDomain = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

// ---- Fixed-window counters (per process; fine for a single Node instance) ----------------------

export type Counter = { count: number; resetAt: number };

export function hit(store: Map<string, Counter>, key: string, max: number, windowMs: number, now = Date.now()) {
  if (store.size > 5000) {
    for (const [k, entry] of store) if (entry.resetAt <= now) store.delete(k);
    // Hard cap: under a flood of distinct keys, drop the oldest entries (Map keeps insertion order).
    if (store.size > 20000) {
      let excess = store.size - 10000;
      for (const k of store.keys()) {
        if (excess-- <= 0) break;
        store.delete(k);
      }
    }
  }
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: windowMs };
  }
  if (entry.count >= max) return { allowed: false, retryAfterMs: entry.resetAt - now };
  entry.count += 1;
  return { allowed: true, retryAfterMs: entry.resetAt - now };
}
