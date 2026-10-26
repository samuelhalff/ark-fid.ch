import { z } from "zod";

export const AGENT_CHAT_MAX_MESSAGES = 12;
export const AGENT_CHAT_MESSAGE_MAX_LENGTH = 2000;
export const AGENT_LEAD_MESSAGE_MAX_LENGTH = 240;

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const optionalTrimmedString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const trimmedEmail = () =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().email(),
  );

const utmSchema = z
  .object({
    source: optionalTrimmedString(160),
    medium: optionalTrimmedString(160),
    campaign: optionalTrimmedString(200),
    term: optionalTrimmedString(160),
    content: optionalTrimmedString(200),
  })
  .optional();

/**
 * Server-side validation for the first-party attribution sent with lead
 * submissions (see src/lib/attribution.ts). Values are attacker-controlled:
 * bounded lengths, pathnames only, and the lead formatter strips markup.
 * Invalid attribution is dropped (`.catch`) so it can never cost a lead.
 */
const attributionString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().max(max).optional().or(z.literal("")),
  );

const attributionPathname = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/[^\s?#]*$/);

export const attributionSchema = z
  .object({
    landingPage: attributionPathname.optional().or(z.literal("")),
    referrer: attributionString(150),
    utm: z
      .object({
        source: attributionString(150),
        medium: attributionString(150),
        campaign: attributionString(150),
        term: attributionString(150),
        content: attributionString(150),
      })
      .partial()
      .optional(),
    gclid: attributionString(200),
    pages: z.array(attributionPathname).max(20).optional(),
  })
  .optional()
  .catch(undefined);

export type AttributionInput = z.infer<typeof attributionSchema>;

export const agentChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
});

export const agentChatRequestSchema = z
  .object({
    email: trimmedEmail(),
    name: optionalTrimmedString(120),
    companyName: optionalTrimmedString(160),
    phone: optionalTrimmedString(80),
    messages: z
      .array(agentChatMessageSchema)
      .max(AGENT_CHAT_MAX_MESSAGES)
      .optional(),
    leadOnly: z.boolean().optional(),
    leadMessage: optionalTrimmedString(AGENT_LEAD_MESSAGE_MAX_LENGTH),
    leadId: optionalTrimmedString(120),
    leadToken: optionalTrimmedString(240),
    odooLeadId: z.number().int().positive().optional(),
    odooLeadToken: optionalTrimmedString(128),
    sessionId: optionalTrimmedString(160),
    pageUrl: optionalTrimmedString(600),
    referrer: optionalTrimmedString(600),
    utm: utmSchema,
    attribution: attributionSchema,
    gaClientId: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .regex(/^\d{1,20}\.\d{1,20}$/)
        .optional(),
    ),
    turnstileToken: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional(),
    ),
  })
  .superRefine((value, ctx) => {
    const messages = value.messages ?? [];
    if (!value.leadOnly && messages.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "messages must include at least one item",
        path: ["messages"],
      });
    }
    if (!value.leadOnly) {
      if (!value.leadId || !value.leadToken) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "leadId and leadToken required",
          path: ["leadId"],
        });
      }
    }
  });

export type AgentChatMessage = z.infer<typeof agentChatMessageSchema>;
export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>;

export type AgentChatRequestValidationResult =
  | { success: true; data: AgentChatRequest }
  | {
      success: false;
      error: "invalid_request" | "lead_required" | "payload_too_large";
      status: 400 | 401 | 413;
    };

const isLeadRequiredIssue = (issue: z.ZodIssue) =>
  issue.code === z.ZodIssueCode.custom && issue.path.includes("leadId");

export function parseAgentChatRequest(
  value: unknown,
): AgentChatRequestValidationResult {
  const result = agentChatRequestSchema.safeParse(value);
  if (!result.success) {
    const leadRequired = result.error.issues.some(isLeadRequiredIssue);
    if (leadRequired) {
      return { success: false, error: "lead_required", status: 401 };
    }
    return { success: false, error: "invalid_request", status: 400 };
  }

  // Only validate the latest user message for length — not the full history.
  // Previous assistant responses and historical messages can be arbitrarily
  // long (the Foundry API itself enforces a 1.5M-char per-message limit).
  const messages = result.data.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser && lastUser.content.length > AGENT_CHAT_MESSAGE_MAX_LENGTH) {
    return { success: false, error: "payload_too_large", status: 413 };
  }

  return { success: true, data: result.data };
}
