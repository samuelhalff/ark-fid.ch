import { NextResponse } from "next/server";
import { z } from "zod";
import { runWithTimeout } from "@/src/lib/agent/resilience";
import { createOdooWebsiteLead } from "@/src/lib/odoo/leads";

export const runtime = "nodejs";
export const revalidate = 0;

const FORMSPARK_ACTION_URL = process.env.FORMSPARK_ACTION_URL;
const FORMSPARK_TIMEOUT_MS = Number.parseInt(
  process.env.FORMSPARK_TIMEOUT_MS || "5000",
  10,
);
const DEBUG_VALIDATION = process.env.DEBUG_AGENT === "1";
const INTERNAL_DOMAINS = new Set(["ark-fid.ch", "pbm.law"]);

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  message: z.string().trim().min(1).max(500),
  consent: z.literal(true),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(80).optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  pageUrl: z.string().trim().max(600).optional().or(z.literal("")),
  referrer: z.string().trim().max(600).optional().or(z.literal("")),
});

const getEmailDomain = (email: string) =>
  email.split("@")[1]?.toLowerCase().trim() || "";

const submitFormspark = async (payload: z.infer<typeof contactSchema>) => {
  if (!FORMSPARK_ACTION_URL) return;
  const res = await runWithTimeout(
    (signal) =>
      fetch(FORMSPARK_ACTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      }),
    FORMSPARK_TIMEOUT_MS,
    "formspark_contact",
  );
  if (!res.ok) {
    throw new Error(`Formspark contact failed (${res.status})`);
  }
};

export async function POST(request: Request) {
  let payload: z.infer<typeof contactSchema>;
  try {
    payload = contactSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const internal = INTERNAL_DOMAINS.has(getEmailDomain(payload.email));
    const odooLeadId = await createOdooWebsiteLead({
      name: payload.firstName,
      email: payload.email,
      companyName: payload.companyName || undefined,
      phone: payload.phone || undefined,
      subject: payload.subject || "Contact form",
      message: payload.message,
      sourceDetail: "contact_form",
      pageUrl: payload.pageUrl,
      referrer: payload.referrer,
    });
    if (!internal && !odooLeadId) {
      throw new Error("odoo_lead_missing");
    }

    if (!internal) {
      try {
        await submitFormspark(payload);
      } catch (error) {
        if (DEBUG_VALIDATION) {
          console.warn("[contact] Formspark submission failed", error);
        }
      }
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    if (DEBUG_VALIDATION) {
      console.warn("[contact] submission failed", error);
    }
    return NextResponse.json({ error: "crm_unavailable" }, { status: 502 });
  }
}
