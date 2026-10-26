import type { NextResponse } from "next/server";
import { clientIp, errorResponse, json, originAllowed, rateLimited, readJson, requireSession, type Counter } from "./http";
import { getCase, type CaseInfo } from "./service";
import { getStorage, type TaxStorage } from "./storage";

/** Small wrapper shared by the /api/tax-questionnaire/* routes (origin, limits, body, session, errors). */

const stores = new Map<string, Map<string, Counter>>();
const store = (name: string) => {
  let s = stores.get(name);
  if (!s) stores.set(name, (s = new Map()));
  return s;
};

export interface RouteOptions {
  name: string;
  /** Requests per IP per window. */
  perIp: number;
  windowMs?: number;
  maxBytes?: number;
  /** Session scope required ("none" for public routes). */
  scope: "edit" | "status" | "any" | "none";
}

export interface RouteContext {
  body: Record<string, unknown>;
  ip: string;
  storage: TaxStorage;
  info: CaseInfo | null;
  session: { caseId: string; emailHash: string; scope: "edit" | "status" } | null;
}

export async function route(request: Request, options: RouteOptions, handler: (ctx: RouteContext) => Promise<NextResponse>): Promise<NextResponse> {
  if (!originAllowed(request)) return json({ error: "forbidden" }, 403);
  const ip = clientIp(request);
  const limited = rateLimited(store(options.name), ip, options.perIp, options.windowMs || 10 * 60 * 1000);
  if (limited) return limited;
  let body: Record<string, unknown> = {};
  if (request.method !== "GET") {
    const parsed = await readJson(request, options.maxBytes || 32 * 1024);
    if (!parsed.ok) return parsed.response;
    body = parsed.body;
  }
  let session: RouteContext["session"] = null;
  let info: CaseInfo | null = null;
  try {
    if (options.scope !== "none") {
      const result = await requireSession(request, options.scope);
      if (!("caseId" in result)) return result;
      session = result;
      // Per-session limit as well (a stolen cookie cannot hammer SharePoint from many IPs).
      const perSession = rateLimited(store(`${options.name}:session`), session.caseId, options.perIp * 2, options.windowMs || 10 * 60 * 1000);
      if (perSession) return perSession;
      info = await getCase(session.caseId);
    }
    return await handler({ body, ip, storage: getStorage(), info, session });
  } catch (error) {
    return errorResponse(error, options.name);
  }
}
