import { createHash } from "node:crypto";

export const SIGNATURE_METHODS = ["auto", "drawn", "image"] as const;
export type SignatureMethod = (typeof SIGNATURE_METHODS)[number];

export interface SignatureProofInput {
  /** SHA-256 (hex) of the exact PDF bytes that were read and signed. */
  pdfSha256: string;
  /** SHA-256 (hex) of the revision's answers (questionnaire.json). */
  jsonSha256: string;
  signerId: string;
  /** The signature image, base64 PNG, as stored. */
  png: string;
  /** ISO time of the signature. */
  at: string;
  method: SignatureMethod;
  /** Ark staff member who signed alongside the signatory, when the signature was given on the firm's screen. */
  presentBy?: string;
}

/** SHA-256 (hex) over every input that makes this signature this one; stored with the proof and printed on the signature page. */
export function signatureHash(input: SignatureProofInput): string {
  const png = createHash("sha256").update(Buffer.from(input.png, "base64")).digest("hex");
  return createHash("sha256")
    .update(JSON.stringify(["kyc-signature-v1", input.pdfSha256, input.jsonSha256, input.signerId, png, input.at, input.method, input.presentBy || ""]))
    .digest("hex");
}

/** The short identifier shown under a signature: the first 16 hex characters, upper case, in four groups. */
export const signatureId = (hash: string) => (hash.slice(0, 16).toUpperCase().match(/.{4}/g) || []).join("-");
