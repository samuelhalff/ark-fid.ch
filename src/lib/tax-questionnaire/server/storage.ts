import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Where submissions go: a SharePoint document library through Microsoft Graph (production), or
 * a local folder (development and tests, TAX_QF_STORAGE=mock, never in production).
 */

export interface FolderRef {
  driveId: string;
  folderId: string;
  name: string;
  webUrl: string;
}

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  /** Name of the sub-folder holding the file ("" for the submission folder itself). */
  folder: string;
}

export interface MailAttachment {
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface MailMessage {
  from: string;
  to: string[];
  cc: string[];
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

export const TRACKING_LIST = "Suivi questionnaires";
export const TRACKING_STATUSES = ["À valider", "Nouveau", "Offre envoyée", "Mandat", "En cours", "Déposé", "Clos"];

export interface TaxStorage {
  readonly kind: "graph" | "mock";
  createSubmissionFolder(year: number, name: string): Promise<FolderRef>;
  getFolder(driveId: string, folderId: string): Promise<FolderRef | null>;
  ensureSubfolder(driveId: string, parentId: string, name: string): Promise<string>;
  createUploadSession(driveId: string, parentId: string, fileName: string, size: number): Promise<{ uploadUrl: string }>;
  /** Files of the submission folder and of its direct sub-folders. */
  listFiles(driveId: string, folderId: string): Promise<StoredFile[]>;
  readHead(driveId: string, itemId: string, bytes: number): Promise<Uint8Array>;
  putFile(driveId: string, parentId: string, name: string, content: Uint8Array, contentType: string): Promise<StoredFile>;
  readFile(driveId: string, parentId: string, name: string): Promise<Uint8Array | null>;
  moveFile(driveId: string, itemId: string, newParentId: string): Promise<void>;
  deleteFile(driveId: string, itemId: string): Promise<void>;
  /** Appends one immutable event file under `_events/` of a folder. */
  appendEvent(driveId: string, folderId: string, event: Record<string, unknown>): Promise<void>;
  sendMail(message: MailMessage): Promise<void>;
}

const env = (name: string) => (process.env[name] || "").trim();

// Dedicated SharePoint site "Questionnaires fiscaux" (sites/questionnaires-fiscaux), library "Documents".
export const DEFAULT_DRIVE_ID = "b!5lshxwRqwUWzR-kUlUUYaZSdQ9ceAZVHldT2SsQ2PxvBKzTHRvKXR4qntxFnXi4O";
export const DEFAULT_ROOT_FOLDER = "Questionnaires";
export const EVENTS_FOLDER = "_events";
export const DEFAULT_SITE_ID = "arkfiduciaire.sharepoint.com,c7215be6-6a04-45c1-b347-e91495451869,d7439d94-011e-4795-95d4-f64ac4363f1b";

export class StorageError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

// ---- Microsoft Graph ------------------------------------------------------------------------------

const GRAPH = "https://graph.microsoft.com/v1.0";
const TIMEOUT_MS = 20_000;

export type Json = Record<string, unknown>;

export class GraphStorage implements TaxStorage {
  readonly kind = "graph" as const;
  private token = { value: "", expiresAt: 0 };

  private credentials() {
    const tenant = env("TAX_QF_GRAPH_TENANT_ID") || env("MSGRAPH_TENANT_ID");
    const clientId = env("TAX_QF_GRAPH_CLIENT_ID") || env("MSGRAPH_CLIENT_ID");
    const secret = env("TAX_QF_GRAPH_CLIENT_SECRET") || env("MSGRAPH_CLIENT_SECRET");
    if (!tenant || !clientId || !secret) throw new StorageError("graph_not_configured");
    return { tenant, clientId, secret };
  }

  private async accessToken(): Promise<string> {
    if (this.token.value && this.token.expiresAt - 60_000 > Date.now()) return this.token.value;
    const { tenant, clientId, secret } = this.credentials();
    const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!res.ok || !payload.access_token) throw new StorageError("graph_token_failed", res.status);
    this.token = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in || 3000) * 1000 };
    return this.token.value;
  }

  private async request(pathOrUrl: string, init: RequestInit & { raw?: boolean } = {}, attempt = 0): Promise<Response> {
    const token = await this.accessToken();
    const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH}${pathOrUrl}`;
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < 2) {
      const wait = Math.min(Number(res.headers.get("Retry-After")) || 2, 8) * 1000;
      await new Promise((resolve) => setTimeout(resolve, wait));
      return this.request(pathOrUrl, init, attempt + 1);
    }
    return res;
  }

  /** Graph call returning JSON (also used by the SharePoint list adapters). */
  async json(pathOrUrl: string, init: RequestInit = {}): Promise<Json> {
    const res = await this.request(pathOrUrl, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Graph error codes only (no request content): safe to log.
      const code = /"code"\s*:\s*"([^"]+)"/.exec(text)?.[1] || "";
      throw new StorageError(`graph_${res.status}${code ? `_${code}` : ""}`, res.status);
    }
    // 202/204 (sendMail, DELETE) have no body.
    const text = await res.text();
    return text ? (JSON.parse(text) as Json) : {};
  }

  private driveRoot() {
    return { drive: env("TAX_QF_SP_DRIVE_ID") || DEFAULT_DRIVE_ID, root: env("TAX_QF_SP_ROOT_FOLDER") || DEFAULT_ROOT_FOLDER };
  }

  private async childFolder(driveId: string, parentId: string, name: string): Promise<Json> {
    try {
      return await this.json(`/drives/${driveId}/items/${parentId}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
      });
    } catch (error) {
      if (error instanceof StorageError && error.status === 409) {
        return this.json(`/drives/${driveId}/items/${parentId}:/${encodeURIComponent(name)}?$select=id,name,webUrl,folder`);
      }
      throw error;
    }
  }

  async createSubmissionFolder(year: number, name: string): Promise<FolderRef> {
    const { drive, root } = this.driveRoot();
    const rootItem = await this.json(`/drives/${drive}/root:/${encodeURIComponent(root)}?$select=id`).catch(async (error) => {
      if (error instanceof StorageError && error.status === 404) return this.childFolder(drive, "root", root);
      throw error;
    });
    const yearItem = await this.childFolder(drive, String(rootItem.id), String(year));
    const folder = await this.childFolder(drive, String(yearItem.id), name);
    return { driveId: drive, folderId: String(folder.id), name: String(folder.name), webUrl: String(folder.webUrl || "") };
  }

  async getFolder(driveId: string, folderId: string): Promise<FolderRef | null> {
    try {
      const item = await this.json(`/drives/${driveId}/items/${folderId}?$select=id,name,webUrl,folder`);
      if (!item.folder) return null;
      return { driveId, folderId, name: String(item.name), webUrl: String(item.webUrl || "") };
    } catch (error) {
      if (error instanceof StorageError && error.status === 404) return null;
      throw error;
    }
  }

  async ensureSubfolder(driveId: string, parentId: string, name: string): Promise<string> {
    return String((await this.childFolder(driveId, parentId, name)).id);
  }

  async createUploadSession(driveId: string, parentId: string, fileName: string, _size: number) {
    const session = await this.json(`/drives/${driveId}/items/${parentId}:/${encodeURIComponent(fileName)}:/createUploadSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
    });
    const uploadUrl = String(session.uploadUrl || "");
    if (!uploadUrl.startsWith("https://")) throw new StorageError("graph_upload_session_invalid");
    return { uploadUrl };
  }

  private async children(driveId: string, folderId: string): Promise<Json[]> {
    const out: Json[] = [];
    let next: string | null = `/drives/${driveId}/items/${folderId}/children?$select=id,name,size,webUrl,folder,file&$top=200`;
    for (let page = 0; next && page < 20; page++) {
      const data = await this.json(next);
      out.push(...((data.value as Json[]) || []));
      next = typeof data["@odata.nextLink"] === "string" ? (data["@odata.nextLink"] as string) : null;
    }
    return out;
  }

  async listFiles(driveId: string, folderId: string): Promise<StoredFile[]> {
    const files: StoredFile[] = [];
    const toFile = (item: Json, folder: string): StoredFile => ({
      id: String(item.id),
      name: String(item.name),
      size: Number(item.size) || 0,
      webUrl: String(item.webUrl || ""),
      folder,
    });
    for (const item of await this.children(driveId, folderId)) {
      if (item.folder) {
        for (const child of await this.children(driveId, String(item.id))) if (child.file) files.push(toFile(child, String(item.name)));
      } else if (item.file) {
        files.push(toFile(item, ""));
      }
    }
    return files;
  }

  async readHead(driveId: string, itemId: string, bytes: number): Promise<Uint8Array> {
    const item = await this.json(`/drives/${driveId}/items/${itemId}`);
    const url = String(item["@microsoft.graph.downloadUrl"] || "");
    if (!url.startsWith("https://")) throw new StorageError("graph_download_url_missing");
    // Pre-authenticated URL: no Authorization header.
    const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new StorageError("graph_download_failed", res.status);
    return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
  }

  async putFile(driveId: string, parentId: string, name: string, content: Uint8Array, contentType: string): Promise<StoredFile> {
    if (content.byteLength > 4 * 1024 * 1024) throw new StorageError("file_too_large_for_simple_upload");
    const item = await this.json(`/drives/${driveId}/items/${parentId}:/${encodeURIComponent(name)}:/content?@microsoft.graph.conflictBehavior=replace`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: Buffer.from(content),
    });
    return { id: String(item.id), name: String(item.name), size: Number(item.size) || 0, webUrl: String(item.webUrl || ""), folder: "" };
  }

  async readFile(driveId: string, parentId: string, name: string): Promise<Uint8Array | null> {
    const res = await this.request(`/drives/${driveId}/items/${parentId}:/${encodeURIComponent(name)}:/content`);
    if (res.status === 404) return null;
    if (!res.ok) throw new StorageError(`graph_${res.status}`, res.status);
    return new Uint8Array(await res.arrayBuffer());
  }

  async moveFile(driveId: string, itemId: string, newParentId: string) {
    await this.json(`/drives/${driveId}/items/${itemId}?@microsoft.graph.conflictBehavior=rename`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentReference: { id: newParentId } }),
    });
  }

  async deleteFile(driveId: string, itemId: string) {
    await this.json(`/drives/${driveId}/items/${itemId}`, { method: "DELETE" });
  }

  async appendEvent(driveId: string, folderId: string, event: Record<string, unknown>) {
    const folder = await this.ensureSubfolder(driveId, folderId, EVENTS_FOLDER);
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}-${String(event.type || "event").replace(/[^a-z0-9-]/gi, "")}.json`;
    await this.putFile(driveId, folder, name, new TextEncoder().encode(JSON.stringify(event)), "application/json");
  }

  async sendMail(message: MailMessage) {
    const recipients = (list: string[]) => list.map((address) => ({ emailAddress: { address } }));
    await this.json(`/users/${encodeURIComponent(message.from)}/sendMail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: "HTML", content: message.html },
          toRecipients: recipients(message.to),
          ccRecipients: recipients(message.cc),
          replyTo: message.replyTo ? recipients([message.replyTo]) : [],
          attachments: (message.attachments || []).map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: a.name,
            contentType: a.contentType,
            contentBytes: Buffer.from(a.bytes).toString("base64"),
          })),
        },
        saveToSentItems: true,
      }),
    });
  }
}

// ---- Local mock (development, tests) ------------------------------------------------------------

const MOCK_DRIVE = "mock-drive";

export class MockStorage implements TaxStorage {
  readonly kind = "mock" as const;
  readonly sent: MailMessage[] = [];
  failMail = false;
  readonly base: string;
  constructor(base = env("TAX_QF_MOCK_DIR") || path.join(os.tmpdir(), "ark-tax-qf-mock")) {
    this.base = base;
  }

  /** Item ids are the base64url of the path relative to the mock root (checked against traversal). */
  idOf(rel: string) {
    return Buffer.from(rel, "utf8").toString("base64url");
  }
  pathOf(id: string): string {
    const rel = id === "root" ? "" : Buffer.from(id, "base64url").toString("utf8");
    const full = path.resolve(this.base, rel);
    if (full !== path.resolve(this.base) && !full.startsWith(path.resolve(this.base) + path.sep)) throw new StorageError("mock_path_invalid", 400);
    return full;
  }
  private rel(full: string) {
    return path.relative(path.resolve(this.base), full);
  }

  async createSubmissionFolder(year: number, name: string): Promise<FolderRef> {
    const rel = path.join(DEFAULT_ROOT_FOLDER, String(year), name);
    await fs.mkdir(path.join(this.base, rel), { recursive: true });
    return { driveId: MOCK_DRIVE, folderId: this.idOf(rel), name, webUrl: `file://${path.join(this.base, rel)}` };
  }
  async getFolder(driveId: string, folderId: string) {
    try {
      const full = this.pathOf(folderId);
      if (!(await fs.stat(full)).isDirectory()) return null;
      return { driveId, folderId, name: path.basename(full), webUrl: `file://${full}` };
    } catch {
      return null;
    }
  }
  async ensureSubfolder(_driveId: string, parentId: string, name: string) {
    const full = path.join(this.pathOf(parentId), name);
    await fs.mkdir(full, { recursive: true });
    return this.idOf(this.rel(full));
  }
  async createUploadSession(_driveId: string, parentId: string, fileName: string) {
    let full = path.join(this.pathOf(parentId), fileName);
    // conflictBehavior=rename
    for (let i = 1; await fs.stat(full).then(() => true, () => false); i++) {
      full = path.join(this.pathOf(parentId), fileName.replace(/(\.[^.]+)?$/, ` ${i}$1`));
    }
    await fs.writeFile(full, ""); // SharePoint also creates a 0-byte placeholder
    return { uploadUrl: `/api/tax-questionnaire/mock-upload/${this.idOf(this.rel(full))}` };
  }
  async listFiles(_driveId: string, folderId: string) {
    const root = this.pathOf(folderId);
    const files: StoredFile[] = [];
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        for (const child of await fs.readdir(full, { withFileTypes: true })) {
          if (!child.isFile()) continue;
          const childPath = path.join(full, child.name);
          files.push({ id: this.idOf(this.rel(childPath)), name: child.name, size: (await fs.stat(childPath)).size, webUrl: `file://${childPath}`, folder: entry.name });
        }
      } else if (entry.isFile()) {
        files.push({ id: this.idOf(this.rel(full)), name: entry.name, size: (await fs.stat(full)).size, webUrl: `file://${full}`, folder: "" });
      }
    }
    return files;
  }
  async readHead(_driveId: string, itemId: string, bytes: number) {
    const handle = await fs.open(this.pathOf(itemId), "r");
    try {
      const buffer = Buffer.alloc(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return new Uint8Array(buffer.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  }
  async putFile(_driveId: string, parentId: string, name: string, content: Uint8Array) {
    const full = path.join(this.pathOf(parentId), name);
    await fs.writeFile(full, content);
    return { id: this.idOf(this.rel(full)), name, size: content.byteLength, webUrl: `file://${full}`, folder: "" };
  }
  async readFile(_driveId: string, parentId: string, name: string) {
    try {
      return new Uint8Array(await fs.readFile(path.join(this.pathOf(parentId), name)));
    } catch {
      return null;
    }
  }
  async moveFile(_driveId: string, itemId: string, newParentId: string) {
    const from = this.pathOf(itemId);
    await fs.rename(from, path.join(this.pathOf(newParentId), path.basename(from)));
  }
  async deleteFile(_driveId: string, itemId: string) {
    await fs.rm(this.pathOf(itemId), { force: true, recursive: true });
  }
  readonly events: Record<string, unknown>[] = [];
  async appendEvent(driveId: string, folderId: string, event: Record<string, unknown>) {
    this.events.push(event);
    const folder = await this.ensureSubfolder(driveId, folderId, EVENTS_FOLDER);
    await this.putFile(driveId, folder, `${Date.now()}-${this.events.length}-${String(event.type || "event")}.json`, new TextEncoder().encode(JSON.stringify(event)));
  }
  async sendMail(message: MailMessage) {
    if (this.failMail) throw new StorageError("graph_403_ErrorAccessDenied", 403);
    this.sent.push(message);
    const outbox = path.join(this.base, "_outbox");
    await fs.mkdir(outbox, { recursive: true });
    const stamp = `${Date.now()}-${this.sent.length}`;
    await fs.writeFile(path.join(outbox, `${stamp}.html`), `<!-- to: ${message.to.join(", ")} | cc: ${message.cc.join(", ")} | subject: ${message.subject} -->\n${message.html}`);
    for (const attachment of message.attachments || []) await fs.writeFile(path.join(outbox, `${stamp}-${attachment.name}`), attachment.bytes);
  }
  /** Appends a chunk for the mock upload route (Content-Range: bytes a-b/total). */
  async appendChunk(itemId: string, start: number, chunk: Uint8Array) {
    const full = this.pathOf(itemId);
    const current = (await fs.stat(full)).size;
    if (start !== current) throw new StorageError("mock_range_mismatch", 416);
    await fs.appendFile(full, chunk);
    return { id: itemId, name: path.basename(full), size: current + chunk.byteLength };
  }
}

const storageHolder = globalThis as unknown as { __tqfStorage?: TaxStorage | null };
let graphInstance: GraphStorage | null = null;

/** Shared Graph client (token cache) for the list adapters. */
export function getGraph(): GraphStorage {
  if (storageHolder.__tqfStorage instanceof GraphStorage) return storageHolder.__tqfStorage;
  if (!graphInstance) graphInstance = new GraphStorage();
  return graphInstance;
}

export const mockStorageEnabled = () => process.env.NODE_ENV !== "production" && env("TAX_QF_STORAGE") === "mock";

export function getStorage(): TaxStorage {
  if (!storageHolder.__tqfStorage) storageHolder.__tqfStorage = mockStorageEnabled() ? new MockStorage() : new GraphStorage();
  return storageHolder.__tqfStorage;
}
