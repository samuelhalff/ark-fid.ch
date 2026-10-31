import os from "node:os";
import path from "node:path";
import { getGraph, MockStorage, StorageError, type Json, type TaxStorage } from "../../tax-questionnaire/server/storage";
import { GraphStorage } from "../../tax-questionnaire/server/storage";
import { ACCESS_LIST, KYC_SITE_ID, mailSender, mockStorageEnabled, TRACKER_LIST } from "./config";
import { memoryAccess, memoryTracker, type AccessPort, type AccessRecord, type KycPorts, type RevisionState, type TrackerPort, type TrackerRow } from "./ports";

/**
 * SharePoint adapters on the "LBA - OAR" site: the lists are created on first use and missing
 * columns are added (never changed). Graph errors carry codes only, never list content.
 */

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;

type Column = Json;
const text = (name: string, displayName: string): Column => ({ name, displayName, text: {} });
/** Indexed: used in list filters (non-indexed filters fail past SharePoint's view threshold). */
const indexed = (column: Column): Column => ({ ...column, indexed: true });
const note = (name: string, displayName: string): Column => ({ name, displayName, text: { allowMultipleLines: true } });
const num = (name: string, displayName: string): Column => ({ name, displayName, number: {} });
const bool = (name: string, displayName: string): Column => ({ name, displayName, boolean: {} });
const choice = (name: string, displayName: string, choices: string[]): Column => ({ name, displayName, choice: { choices, displayAs: "dropDownMenu" } });
const link = (name: string, displayName: string): Column => ({ name, displayName, hyperlinkOrPicture: { isPicture: false } });

class SiteList {
  private id = "";
  private readonly displayName: () => string;
  private readonly columns: Column[];
  /** Index the built-in Title column too (the access list is looked up by Title). */
  private readonly indexTitle: boolean;
  constructor(displayName: () => string, columns: Column[], indexTitle = false) {
    this.displayName = displayName;
    this.columns = columns;
    this.indexTitle = indexTitle;
  }
  private site() {
    return KYC_SITE_ID();
  }
  async listId(): Promise<string> {
    if (this.id) return this.id;
    const graph = getGraph();
    const found = await graph.json(`/sites/${this.site()}/lists?$filter=${encodeURIComponent(`displayName eq '${this.displayName()}'`)}&$select=id`);
    const existing = (found.value as Json[] | undefined)?.[0];
    if (existing) {
      this.id = str(existing.id);
      await this.migrate();
      return this.id;
    }
    const created = await graph.json(`/sites/${this.site()}/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: this.displayName(), list: { template: "genericList" }, columns: this.columns }),
    });
    this.id = str(created.id);
    await this.migrate();
    return this.id;
  }
  private async migrate() {
    const graph = getGraph();
    const data = await graph.json(`/sites/${this.site()}/lists/${this.id}/columns?$select=id,name,choice,indexed`);
    const existing = new Map(((data.value as Json[]) || []).map((c) => [str(c.name), c]));
    const title = existing.get("Title");
    if (this.indexTitle && title && !title.indexed) {
      await graph.json(`/sites/${this.site()}/lists/${this.id}/columns/${str(title.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ indexed: true }) });
    }
    for (const column of this.columns) {
      const found = existing.get(str(column.name));
      if (!found) {
        await graph.json(`/sites/${this.site()}/lists/${this.id}/columns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(column) });
        continue;
      }
      if (column.indexed && !found.indexed) {
        await graph.json(`/sites/${this.site()}/lists/${this.id}/columns/${str(found.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ indexed: true }) });
      }
      const wanted = ((column.choice as Json | undefined)?.choices as string[] | undefined) || [];
      const have = (((found.choice as Json | undefined)?.choices as string[] | undefined) || []).map(String);
      const missing = wanted.filter((c) => !have.includes(c));
      if (found.choice && missing.length) {
        await graph.json(`/sites/${this.site()}/lists/${this.id}/columns/${str(found.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choice: { ...(found.choice as Json), choices: [...have, ...missing] } }),
        });
      }
    }
  }
  async query(filter: string | null, top = 200): Promise<{ id: string; fields: Json }[]> {
    const graph = getGraph();
    const list = await this.listId();
    const out: { id: string; fields: Json }[] = [];
    const where = filter ? `&$filter=${encodeURIComponent(filter)}` : "";
    let next: string | null = `/sites/${this.site()}/lists/${list}/items?$expand=fields${where}&$top=${top}`;
    for (let page = 0; next; page++) {
      // Never a silently truncated answer: past the cap the call fails.
      if (page >= 50) throw new StorageError("list_too_large");
      const data: Json = await graph.json(next, { headers: { Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" } });
      for (const item of (data.value as Json[]) || []) out.push({ id: str(item.id), fields: (item.fields || {}) as Json });
      next = typeof data["@odata.nextLink"] === "string" ? (data["@odata.nextLink"] as string) : null;
    }
    return out;
  }
  async create(fields: Json): Promise<string> {
    const created = await getGraph().json(`/sites/${this.site()}/lists/${await this.listId()}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return str(created.id);
  }
  async update(id: string, fields: Json) {
    await getGraph().json(`/sites/${this.site()}/lists/${await this.listId()}/items/${id}/fields`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  }
}

// ---- "Suivi KYC" --------------------------------------------------------------------------------

/** French labels of the revision states (list column for staff reading the list directly). */
export const STATE_FR: Record<RevisionState, string> = {
  open: "Invité / en cours",
  returned: "Renvoyé à Ark",
  awaiting_signature: "Envoyé – à signer",
  signed: "Signé – à contrôler",
  superseded: "Remplacé",
  closed: "Clos",
};
const STATE_BY_FR = new Map(Object.entries(STATE_FR).map(([k, v]) => [v, k as RevisionState]));

const TRACKER_COLUMNS: Column[] = [
  indexed(text("CaseId", "Dossier KYC")),
  num("Revision", "Révision"),
  text("RevisionId", "Id révision"),
  text("ClientRef", "Référence Cadence"),
  choice("Route", "Formulaire", ["pp", "pm-op", "pm-nonop"]),
  choice("Langue", "Langue", ["fr", "en"]),
  choice("Etat", "Etat", Object.values(STATE_FR)),
  text("UpdatedAt", "Mis à jour (UTC)"),
  text("InvitedAt", "Lien créé (UTC)"),
  text("SubmittedAt", "Envoyé (UTC)"),
  text("SignedAt", "Signé reçu (UTC)"),
  note("Flags", "Points d'attention"),
  text("JsonSha256", "Empreinte SHA-256"),
  text("DeclarationId", "Réf. déclaration"),
  text("DriveId", "DriveId"),
  text("FolderId", "FolderId"),
  link("LinkFolder", "Dossier"),
  link("LinkPdf", "PDF à signer"),
  link("LinkSigned", "PDF signé"),
  indexed(text("IdempotencyKey", "Clé de création")),
  text("CreatedBy", "Créé par (clé API)"),
];

const linkValue = (url?: string, label = "Ouvrir") => (url ? { Url: url, Description: label } : undefined);
const linkUrl = (value: unknown) => (value && typeof value === "object" ? str((value as Json).Url) : str(value));

function toFields(row: TrackerRow): Json {
  const fields: Json = {
    Title: row.title.slice(0, 255) || row.caseId,
    CaseId: row.caseId,
    Revision: row.revision,
    RevisionId: row.revisionId,
    ClientRef: row.clientRef,
    Route: row.route,
    Langue: row.language,
    Etat: STATE_FR[row.state],
    UpdatedAt: row.updatedAt,
    DriveId: row.driveId,
    FolderId: row.folderId,
  };
  const optional: [string, unknown][] = [
    ["InvitedAt", row.invitedAt],
    ["SubmittedAt", row.submittedAt],
    ["SignedAt", row.signedAt],
    ["Flags", row.flags],
    ["JsonSha256", row.jsonSha256],
    ["DeclarationId", row.declarationId],
    ["IdempotencyKey", row.idempotencyKey],
    ["CreatedBy", row.createdBy],
  ];
  for (const [key, value] of optional) if (value !== undefined && value !== "") fields[key] = value;
  return fields;
}

function fromFields(f: Json): TrackerRow {
  return {
    caseId: str(f.CaseId),
    revision: Number(f.Revision) || 0,
    revisionId: str(f.RevisionId),
    clientRef: str(f.ClientRef),
    title: str(f.Title),
    route: str(f.Route),
    language: str(f.Langue),
    state: STATE_BY_FR.get(str(f.Etat)) || "open",
    driveId: str(f.DriveId),
    folderId: str(f.FolderId),
    folderUrl: linkUrl(f.LinkFolder),
    updatedAt: str(f.UpdatedAt),
    invitedAt: str(f.InvitedAt) || undefined,
    submittedAt: str(f.SubmittedAt) || undefined,
    signedAt: str(f.SignedAt) || undefined,
    flags: str(f.Flags) || undefined,
    jsonSha256: str(f.JsonSha256) || undefined,
    declarationId: str(f.DeclarationId) || undefined,
    pdfUrl: linkUrl(f.LinkPdf) || undefined,
    signedUrl: linkUrl(f.LinkSigned) || undefined,
    idempotencyKey: str(f.IdempotencyKey) || undefined,
    createdBy: str(f.CreatedBy) || undefined,
  };
}

class SharePointTracker implements TrackerPort {
  private readonly list = new SiteList(TRACKER_LIST, TRACKER_COLUMNS);
  async upsert(row: TrackerRow) {
    const found = (await this.list.query(`fields/CaseId eq ${quote(row.caseId)}`, 50)).find((i) => Number(i.fields.Revision) === row.revision);
    if (found) {
      await this.list.update(found.id, toFields(row));
      return found.id;
    }
    return this.list.create(toFields(row));
  }
  async ofCase(caseId: string) {
    return (await this.list.query(`fields/CaseId eq ${quote(caseId)}`, 50)).map((i) => fromFields(i.fields));
  }
  async byIdempotencyKey(key: string) {
    const found = await this.list.query(`fields/IdempotencyKey eq ${quote(key)}`, 1);
    return found[0] ? fromFields(found[0].fields) : null;
  }
  async all() {
    return (await this.list.query(null, 500)).map((i) => fromFields(i.fields));
  }
}

// ---- "Accès KYC" --------------------------------------------------------------------------------

const ACCESS_COLUMNS: Column[] = [
  choice("Kind", "Type", ["link", "session"]),
  indexed(text("CaseId", "Dossier KYC")),
  num("Revision", "Révision"),
  indexed(text("EmailHash", "Empreinte e-mail")),
  num("ExpiresAt", "Expiration (ms)"),
  bool("Revoked", "Révoqué"),
];

class SharePointAccess implements AccessPort {
  private readonly list = new SiteList(ACCESS_LIST, ACCESS_COLUMNS, true);
  private cache = new Map<string, { record: AccessRecord | null; at: number }>();
  async put(record: AccessRecord) {
    await this.list.create({
      Title: record.keyHash,
      Kind: record.kind,
      CaseId: record.caseId,
      Revision: record.revision,
      EmailHash: record.emailHash,
      ExpiresAt: record.expiresAt,
      Revoked: record.revoked,
    });
    this.cache.delete(record.keyHash);
  }
  async get(keyHash: string) {
    const cached = this.cache.get(keyHash);
    if (cached && Date.now() - cached.at < 30_000) return cached.record;
    const f = (await this.list.query(`fields/Title eq ${quote(keyHash)}`, 1))[0]?.fields;
    const record: AccessRecord | null = f
      ? {
          keyHash,
          kind: str(f.Kind) === "session" ? "session" : "link",
          caseId: str(f.CaseId),
          revision: Number(f.Revision) || 0,
          emailHash: str(f.EmailHash),
          expiresAt: Number(f.ExpiresAt) || 0,
          revoked: f.Revoked === true,
        }
      : null;
    this.cache.set(keyHash, { record, at: Date.now() });
    return record;
  }
  async revoke(keyHash: string) {
    for (const item of await this.list.query(`fields/Title eq ${quote(keyHash)}`, 5)) await this.list.update(item.id, { Revoked: true });
    this.cache.delete(keyHash);
  }
  async revokeCase(caseId: string) {
    for (const item of await this.list.query(`fields/CaseId eq ${quote(caseId)}`)) if (item.fields.Revoked !== true) await this.list.update(item.id, { Revoked: true });
    this.cache.clear();
  }
  async casesByEmail(emailHash: string) {
    const items = await this.list.query(`fields/EmailHash eq ${quote(emailHash)}`, 200);
    return [...new Set(items.filter((i) => str(i.fields.Kind) === "link").map((i) => str(i.fields.CaseId)).filter(Boolean))];
  }
}

// ---- wiring -------------------------------------------------------------------------------------

/** Local mock storage whose upload URLs point to the KYC mock-upload route. */
export class KycMockStorage extends MockStorage {
  async createUploadSession(driveId: string, parentId: string, fileName: string) {
    const session = await super.createUploadSession(driveId, parentId, fileName);
    return { uploadUrl: session.uploadUrl.replace("/api/tax-questionnaire/", "/api/kyc-questionnaire/") };
  }
}

const holder = globalThis as unknown as { __kycPorts?: KycPorts };

export function getPorts(): KycPorts {
  if (holder.__kycPorts) return holder.__kycPorts;
  if (mockStorageEnabled()) {
    const storage = new KycMockStorage(process.env.KYC_QF_MOCK_DIR || path.join(os.tmpdir(), "ark-kyc-qf-mock"));
    holder.__kycPorts = { storage, tracker: memoryTracker(), access: memoryAccess(), sendMail: (m) => storage.sendMail(m) };
  } else {
    const storage: TaxStorage = new GraphStorage();
    holder.__kycPorts = {
      storage,
      tracker: new SharePointTracker(),
      access: new SharePointAccess(),
      sendMail: (m) => storage.sendMail({ ...m, from: m.from || mailSender() }),
    };
  }
  return holder.__kycPorts;
}

/** Tests: install in-memory ports. */
export function setPorts(ports: KycPorts | undefined) {
  holder.__kycPorts = ports;
}
