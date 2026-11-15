/**
 * Browser calls of the questionnaires (KYC and tax), shared: same origin, a CSRF header per form,
 * no PII in URLs; the chunked upload to a pre-authenticated SharePoint session (or the dev mock);
 * the submission key. Each form keeps its own endpoints and payload types in its api.ts.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: Record<string, unknown>;
  constructor(code: string, status: number, detail: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export type ApiCall = <T>(path: string, init?: RequestInit & { action?: string }) => Promise<T>;

/**
 * The call helper of one form: `/api/<base>/<path>`, its CSRF header (`header: "1"`) and the
 * action header (`<header>-action`). A refusal throws ApiError with the server's code and body.
 */
export function apiCaller(base: string, header: string, fetcher: typeof fetch = (...args) => fetch(...args)): ApiCall {
  return async <T>(path: string, init: RequestInit & { action?: string } = {}): Promise<T> => {
    const { action, ...rest } = init;
    const headers = new Headers(rest.headers);
    headers.set(header, "1");
    if (rest.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (action) headers.set(`${header}-action`, action);
    let res: Response;
    try {
      res = await fetcher(`/api/${base}/${path}`, { ...rest, headers, credentials: "same-origin", cache: "no-store" });
    } catch {
      throw new ApiError("network", 0);
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new ApiError(typeof data.error === "string" ? data.error : "generic", res.status, data);
    return data as T;
  };
}

export interface UploadHandle {
  promise: Promise<{ name: string; size: number }>;
  cancel: () => void;
}

/**
 * Sends a file in chunks to the upload session `open()` returns (Content-Range only, no credentials),
 * three tries per chunk; the stored name and size as the storage reports them.
 */
export function uploadInChunks(
  file: File,
  open: () => Promise<{ uploadUrl: string; chunkBytes?: number }>,
  onProgress: (fraction: number) => void,
  fetcher: typeof fetch = (...args) => fetch(...args),
): UploadHandle {
  const controller = new AbortController();
  const promise = (async () => {
    const session = await open();
    const chunk = session.chunkBytes || 5 * 1024 * 1024;
    let result: { name: string; size: number } = { name: file.name, size: file.size };
    for (let start = 0; start < file.size; start += chunk) {
      const end = Math.min(start + chunk, file.size) - 1;
      let attempt = 0;
      for (;;) {
        try {
          // Pre-authenticated upload URL: no credentials, no custom headers besides Content-Range.
          const res = await fetcher(session.uploadUrl, {
            method: "PUT",
            headers: { "Content-Range": `bytes ${start}-${end}/${file.size}` },
            body: file.slice(start, end + 1),
            signal: controller.signal,
            credentials: "omit",
          });
          if (res.status === 200 || res.status === 201) {
            const item = (await res.json().catch(() => ({}))) as { name?: string; size?: number };
            result = { name: item.name || file.name, size: item.size || file.size };
          } else if (res.status !== 202) {
            throw new ApiError("upload_failed", res.status);
          }
          break;
        } catch (error) {
          if (controller.signal.aborted) throw new ApiError("cancelled", 0);
          if (++attempt >= 3) throw error instanceof ApiError ? error : new ApiError("network", 0);
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        }
      }
      onProgress((end + 1) / file.size);
    }
    return result;
  })();
  return { promise, cancel: () => controller.abort() };
}

/** Submission key: date of the first attempt (yyyymmdd) + random part. */
export const newSubmitKey = () => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return date + Array.from(bytes, (b) => (b % 36).toString(36)).join("");
};
