/** Upload rules: allowed types, sizes, file naming and content sniffing. Pure module. */
import { docCode } from "./documents";

export const UPLOAD_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxFiles: 120,
  maxTotalBytes: 1024 * 1024 * 1024,
  /** Chunk size for upload sessions: a multiple of 320 KiB, as Graph requires. */
  chunkBytes: 320 * 1024 * 16, // 5 MiB
} as const;

/** Extension → accepted MIME types (an empty browser MIME type is also accepted). */
export const ALLOWED_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  heic: ["image/heic", "image/heif"],
  heif: ["image/heif", "image/heic"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  xls: ["application/vnd.ms-excel"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  doc: ["application/msword"],
  txt: ["text/plain"],
};
export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_TYPES).map((ext) => `.${ext}`).join(",");

export const extensionOf = (name: string) => {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
};

export type FileCheck = { ok: true; ext: string } | { ok: false; error: "file_type" | "file_size" | "file_empty" };

export function checkUpload(name: string, size: number, mime: string): FileCheck {
  const ext = extensionOf(name);
  const allowed = ALLOWED_TYPES[ext];
  if (!allowed) return { ok: false, error: "file_type" };
  if (mime && mime !== "application/octet-stream" && !allowed.includes(mime.toLowerCase())) return { ok: false, error: "file_type" };
  if (!Number.isInteger(size) || size <= 0) return { ok: false, error: "file_empty" };
  if (size > UPLOAD_LIMITS.maxFileBytes) return { ok: false, error: "file_size" };
  return { ok: true, ext };
}

/** Safe file / folder name for SharePoint: no reserved characters, no leading dots, bounded length. */
export function safeName(input: string, max = 80): string {
  const cleaned = input
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"*:<>?/\\|#%~&{}+]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s_-]+|[.\s]+$/g, "")
    .trim();
  const cut = cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
  return cut || "document";
}

/**
 * Name given to an uploaded file: "[<code>] <short label> - <original name>.<ext>".
 * The code ties the file to its checklist item durably (finalisation re-reads it from SharePoint).
 */
export function uploadFileName(docKey: string | null, shortLabel: string, originalName: string): string {
  const ext = extensionOf(originalName);
  const base = safeName(originalName.replace(/\.[^.]+$/, ""), 70);
  if (!docKey) return `${base}.${ext}`;
  return `[${docCode(docKey)}] ${safeName(shortLabel, 50)} - ${base}.${ext}`;
}

/** Reads the checklist code back from a file name. */
export function codeFromFileName(name: string): string | null {
  const match = /^\[([0-9a-f]{6})\] /.exec(name);
  return match ? match[1] : null;
}

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/**
 * Checks the first bytes of an uploaded file against its extension. Returns a reason when the
 * content looks wrong (executable, script, or a different format), null when it looks fine.
 */
export function sniffMismatch(ext: string, head: Uint8Array): string | null {
  if (head.length === 0) return "empty";
  if (startsWith(head, [0x4d, 0x5a])) return "executable (MZ)";
  if (startsWith(head, [0x7f, 0x45, 0x4c, 0x46])) return "executable (ELF)";
  if (startsWith(head, [0xcf, 0xfa, 0xed, 0xfe]) || startsWith(head, [0xfe, 0xed, 0xfa, 0xcf])) return "executable (Mach-O)";
  if (startsWith(head, [0x23, 0x21])) return "script";
  const zip = startsWith(head, [0x50, 0x4b, 0x03, 0x04]);
  const ole = startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  switch (ext) {
    case "pdf":
      // A few producers put bytes before the header; accept %PDF within the first 1 KiB.
      return new TextDecoder("latin1").decode(head.slice(0, 1024)).includes("%PDF") ? null : "not a PDF";
    case "jpg":
    case "jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]) ? null : "not a JPEG";
    case "png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47]) ? null : "not a PNG";
    case "heic":
    case "heif":
      return new TextDecoder("latin1").decode(head.slice(4, 12)).startsWith("ftyp") ? null : "not a HEIC image";
    case "xlsx":
    case "docx":
      return zip ? null : "not an Office document";
    case "xls":
    case "doc":
      return ole ? null : "not an Office document";
    case "csv":
    case "txt": {
      // Text: no NUL bytes in the first KiB.
      return head.slice(0, 1024).includes(0) ? "binary content" : null;
    }
    default:
      return "type not allowed";
  }
}
