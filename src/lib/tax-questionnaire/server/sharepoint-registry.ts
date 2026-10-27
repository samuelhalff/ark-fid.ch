/**
 * SharePoint adapters of the ports:
 * - ClientRegistry → CRM site, list "Clients" (master registry; minimal, rule-bound writes);
 * - ReturnTracker → tax site, list "Suivi questionnaires" (one row per return and year);
 * - PreferenceStore → tax site, list "Préférences questionnaires" (client-level campaign choices);
 * - AccessStore → tax site, list "Accès questionnaires" (HMACs only, never usable without the key).
 * In-memory adapters (memoryPorts) serve the local mock mode and the tests.
 */
import { givenName, personName } from "../format";
import type { AccessRecord, AccessStore, ClientIdentity, ClientMatch, ClientPreferences, ClientRegistry, PreferenceStore, ReturnRecord, ReturnTracker } from "./ports";
import { DEFAULT_SITE_ID, getGraph, mockStorageEnabled, TRACKING_LIST, TRACKING_STATUSES, type Json } from "./storage";

export interface Ports {
  registry: ClientRegistry;
  tracker: ReturnTracker;
  prefs: PreferenceStore;
  access: AccessStore;
}

const env = (name: string) => (process.env[name] || "").trim();
const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
export const normalise = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@.+-]+/g, " ").trim();

// ---- CRM "Clients" --------------------------------------------------------------------------------

export const CRM_SITE_ID = "arkfiduciaire.sharepoint.com,a7500568-cb11-4b28-8122-1537cf5c2bab,9742fdaa-bf32-44d6-ba07-25d6a1be39aa";
export const CRM_LIST_ID = "bb771b3b-048a-432f-a49f-f61b17f4b275";

interface CrmItem {
  id: string;
  title: string;
  firstName: string;
  email: string;
  acquis: string;
  actif: boolean;
  etendue: string[];
  webUrl: string;
  hasDocumentsLink?: boolean;
}

/** Pure matching (tested): e-mail first; a name-only match is "ambiguous" and never written to. */
export function matchCrm(items: CrmItem[], identity: ClientIdentity): ClientMatch {
  const email = normalise(identity.email);
  const byEmail = items.filter((item) => item.email && normalise(item.email) === email);
  if (byEmail.length === 1) {
    const item = byEmail[0];
    return { status: "matched", id: item.id, url: item.webUrl, isClient: item.acquis === "Client", hasTaxScope: item.etendue.includes("Fiscal") };
  }
  if (byEmail.length > 1) return { status: "ambiguous", candidateIds: byEmail.map((i) => i.id) };
  const last = normalise(identity.lastName);
  const first = normalise(identity.firstName);
  // Title is unique in the list, so a second person with the same last name is stored as "NOM Prénom".
  const byName = items.filter((item) => {
    const title = normalise(item.title);
    return (title === last && (!item.firstName || normalise(item.firstName) === first)) || (!!first && title === `${last} ${first}`);
  });
  return byName.length ? { status: "ambiguous", candidateIds: byName.map((i) => i.id) } : { status: "none" };
}

/**
 * CRM Title for a new person: "NOM", or "NOM Prénom" when that last name is already taken (Title is
 * unique). Null when even that is taken or there is no first name to tell them apart.
 */
export function crmTitle(items: CrmItem[], identity: ClientIdentity): string | null {
  const last = identity.lastName.trim().replace(/\s+/g, " ").toUpperCase();
  const taken = (title: string) => items.some((item) => normalise(item.title) === normalise(title));
  if (!taken(last)) return last;
  const full = personName(identity.lastName, identity.firstName);
  return identity.firstName.trim() && !taken(full) ? full : null;
}

/** Last name of a CRM person: the Title, minus the first name when the Title is "NOM Prénom". */
export function crmLastName(title: string, firstName: string): string {
  const t = title.trim();
  const first = firstName.trim();
  if (!first || !normalise(t).endsWith(` ${normalise(first)}`)) return t;
  const words = t.split(/\s+/);
  const firstWords = first.split(/\s+/).length;
  return words.length > firstWords ? words.slice(0, words.length - firstWords).join(" ") : t;
}

class SharePointClientRegistry implements ClientRegistry {
  private cache: { items: CrmItem[]; at: number } | null = null;
  private site = () => env("TAX_QF_CRM_SITE_ID") || CRM_SITE_ID;
  private list = () => env("TAX_QF_CRM_LIST_ID") || CRM_LIST_ID;

  private async items(force = false): Promise<CrmItem[]> {
    if (!force && this.cache && Date.now() - this.cache.at < 5 * 60 * 1000) return this.cache.items;
    const graph = getGraph();
    const out: CrmItem[] = [];
    let next: string | null = `/sites/${this.site()}/lists/${this.list()}/items?$expand=fields($select=Title,FirstName,EMail,Acquis,Actif,Etendue,LienDocuments)&$top=500`;
    for (let page = 0; next && page < 20; page++) {
      const data: Json = await graph.json(next);
      for (const item of (data.value as Json[]) || []) {
        const fields = (item.fields || {}) as Json;
        out.push({
          id: str(item.id),
          title: str(fields.Title),
          firstName: str(fields.FirstName),
          email: str(fields.EMail),
          acquis: str(fields.Acquis),
          actif: fields.Actif === true,
          etendue: Array.isArray(fields.Etendue) ? (fields.Etendue as string[]) : [],
          webUrl: str(item.webUrl),
          hasDocumentsLink: !!(fields.LienDocuments && typeof fields.LienDocuments === "object" && str((fields.LienDocuments as Json).Url)),
        });
      }
      next = typeof data["@odata.nextLink"] === "string" ? (data["@odata.nextLink"] as string) : null;
    }
    this.cache = { items: out, at: Date.now() };
    return out;
  }

  async match(identity: ClientIdentity) {
    return matchCrm(await this.items(), identity);
  }

  async recordTaxClient(identity: ClientIdentity, documentsUrl: string, now: Date) {
    // TAX_QF_CRM_WRITES=0: read-only (tests against the real tenant).
    if (env("TAX_QF_CRM_WRITES") === "0") return null;
    const graph = getGraph();
    const base = `/sites/${this.site()}/lists/${this.list()}/items`;
    const result = matchCrm(await this.items(true), identity);
    if (result.status === "ambiguous") return null;
    if (result.status === "matched") {
      const item = (await this.items()).find((i) => i.id === result.id);
      const patch: Json = {};
      // Only additions, never overwrites: the tax scope for clients, the documents link when empty.
      if (result.isClient && !result.hasTaxScope) Object.assign(patch, { "Etendue@odata.type": "Collection(Edm.String)", Etendue: [...(item?.etendue || []), "Fiscal"] });
      if (item && !item.hasDocumentsLink && documentsUrl.startsWith("https://")) patch.LienDocuments = { Url: documentsUrl, Description: "Questionnaire fiscal" };
      if (Object.keys(patch).length) {
        await graph.json(`${base}/${result.id}/fields`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
        this.cache = null;
      }
      return { id: result.id, url: result.url, created: false };
    }
    const date = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich" }).format(now);
    const items = await this.items();
    const title = crmTitle(items, identity);
    if (!title) return null;
    const created = await graph.json(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          Title: title,
          FirstName: givenName(identity.firstName),
          EMail: identity.email,
          Acquis: "Prospect",
          "Etendue@odata.type": "Collection(Edm.String)",
          Etendue: ["Fiscal"],
          Commentaires: `Créé par tax.ark-fid.ch le ${date}`,
          ...(documentsUrl.startsWith("https://") ? { LienDocuments: { Url: documentsUrl, Description: "Questionnaire fiscal" } } : {}),
        },
      }),
    });
    this.cache = null;
    return { id: str(created.id), url: str(created.webUrl), created: true };
  }

  async listTaxClients() {
    return (await this.items(true))
      .filter((i) => i.actif && i.etendue.includes("Fiscal") && i.email)
      .map((i) => ({ id: i.id, email: i.email, lastName: crmLastName(i.title, i.firstName), firstName: i.firstName }));
  }
}

// ---- generic list helpers -------------------------------------------------------------------------

type Column = Json;
const text = (name: string, displayName: string, extra: Json = {}): Column => ({ name, displayName, text: {}, ...extra });
const num = (name: string, displayName: string, extra: Json = {}): Column => ({ name, displayName, number: {}, ...extra });
const bool = (name: string, displayName: string): Column => ({ name, displayName, boolean: {} });

class SiteList {
  private id = "";
  private readonly displayName: string;
  private readonly columns: Column[];
  constructor(displayName: string, columns: Column[]) {
    this.displayName = displayName;
    this.columns = columns;
  }
  site() {
    return env("TAX_QF_SP_SITE_ID") || DEFAULT_SITE_ID;
  }
  async listId(): Promise<string> {
    if (this.id) return this.id;
    const graph = getGraph();
    const found = await graph.json(`/sites/${this.site()}/lists?$filter=${encodeURIComponent(`displayName eq '${this.displayName}'`)}&$select=id`);
    const existing = (found.value as Json[] | undefined)?.[0];
    if (existing) {
      this.id = str(existing.id);
      await this.migrate();
      return this.id;
    }
    const created = await graph.json(`/sites/${this.site()}/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: this.displayName, list: { template: "genericList" }, columns: this.columns }),
    });
    return (this.id = str(created.id));
  }
  /** Adds the columns missing from an existing list (idempotent; column types are never changed). */
  private async migrate() {
    const graph = getGraph();
    const data = await graph.json(`/sites/${this.site()}/lists/${this.id}/columns?$select=id,name,text,choice`);
    const existing = new Map(((data.value as Json[]) || []).map((c) => [str(c.name), c]));
    for (const column of this.columns) {
      const found = existing.get(str(column.name));
      if (!found) {
        await graph.json(`/sites/${this.site()}/lists/${this.id}/columns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(column) });
        continue;
      }
      // Choice columns: new choices are appended (existing ones and the type are never changed).
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
  async query(filter: string, top = 200): Promise<{ id: string; fields: Json }[]> {
    const graph = getGraph();
    const list = await this.listId();
    const out: { id: string; fields: Json }[] = [];
    let next: string | null = `/sites/${this.site()}/lists/${list}/items?$expand=fields&$filter=${encodeURIComponent(filter)}&$top=${top}`;
    for (let page = 0; next && page < 20; page++) {
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

const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;

// ---- "Suivi questionnaires" ---------------------------------------------------------------------

const TRACKER_COLUMNS: Column[] = [
  text("CaseId", "Dossier", { indexed: true }),
  text("HouseholdId", "Ménage", { indexed: true }),
  text("ClientKey", "Clé client", { indexed: true }),
  text("EmailHash", "Empreinte e-mail", { indexed: true }),
  text("Email", "E-mail"),
  text("Language", "Langue"),
  text("Canton", "Canton"),
  num("TaxYear", "Année fiscale", { indexed: true }),
  { name: "EtatQuestionnaire", displayName: "État questionnaire", choice: { choices: ["Brouillon", "Envoyé", "Invité", "Abandonné"], displayAs: "dropDownMenu" } },
  text("RegimeText", "Régime", { text: { allowMultipleLines: true, textType: "plain" } }),
  bool("OptIn", "Rappel annuel"),
  bool("AiOptIn", "Assistance IA acceptée"),
  { name: "SubmittedAt", displayName: "Envoyé le", dateTime: { format: "dateTime" } },
  num("DocsReceived", "Documents reçus"),
  num("DocsExpected", "Documents attendus"),
  text("DriveId", "Bibliothèque"),
  text("FolderId", "Dossier (id)"),
  text("LinkFolder", "Lien dossier", { text: { allowMultipleLines: true, textType: "plain" } }),
  text("LinkExcel", "Lien Excel", { text: { allowMultipleLines: true, textType: "plain" } }),
  text("LinkPdf", "Lien PDF", { text: { allowMultipleLines: true, textType: "plain" } }),
  text("LinkJson", "Lien JSON", { text: { allowMultipleLines: true, textType: "plain" } }),
  text("CrmId", "Client CRM (id)"),
  text("LinkCrm", "Client CRM (lien)", { text: { allowMultipleLines: true, textType: "plain" } }),
  text("CrmMatch", "Correspondance CRM"),
  text("Source", "Provenance"),
  { name: "InvitedAt", displayName: "Invité le", dateTime: { format: "dateTime" } },
  num("RemindersSent", "Rappels envoyés"),
  { name: "LastReminderAt", displayName: "Dernier rappel", dateTime: { format: "dateTime" } },
  // Staff-owned
  { name: "Status", displayName: "Statut", choice: { choices: TRACKING_STATUSES, displayAs: "dropDownMenu", allowTextEntry: false }, defaultValue: { value: "Nouveau" } },
  { name: "DelaiObtenu", displayName: "Délai obtenu jusqu'au", dateTime: { format: "dateOnly" } },
  bool("PBM", "PBM impliqué"),
  text("DocumentsADemander", "Documents à demander (staff)", { text: { allowMultipleLines: true } }),
  text("Responsable", "Responsable (staff)"),
  bool("ExclureCampagne", "Exclure de la campagne"),
  text("NoteStaff", "Note (staff)", { text: { allowMultipleLines: true } }),
  text("PrefillTax", "Préremplissage .tax disponible"),
  num("DerniereDF", "Dernière DF trouvée"),
  text("DocumentsManquants", "Documents manquants", { text: { allowMultipleLines: true, textType: "plain" } }),
  num("MissingRemindersSent", "Rappels documents envoyés"),
  { name: "LastMissingReminderAt", displayName: "Dernier rappel documents", dateTime: { format: "dateTime" } },
];

const STATE_TO_FR: Record<ReturnRecord["state"], string> = { draft: "Brouillon", submitted: "Envoyé", invited: "Invité", declined: "Abandonné" };
const FR_TO_STATE = Object.fromEntries(Object.entries(STATE_TO_FR).map(([k, v]) => [v, k])) as Record<string, ReturnRecord["state"]>;
const isoDate = (v: unknown) => (typeof v === "string" && v ? v : undefined);

function trackerFields(r: ReturnRecord): Json {
  const fields: Json = {
    Title: r.name,
    CaseId: r.caseId,
    HouseholdId: r.householdId,
    ClientKey: r.clientKey,
    EmailHash: r.emailHash,
    Email: r.email,
    Language: r.language,
    Canton: r.canton,
    TaxYear: r.taxYear,
    EtatQuestionnaire: STATE_TO_FR[r.state],
    RegimeText: r.regime,
    OptIn: r.optIn,
    AiOptIn: r.aiOptIn,
    DocsReceived: r.docsReceived ?? 0,
    DocsExpected: r.docsExpected ?? 0,
    DriveId: r.driveId,
    FolderId: r.folderId,
    LinkFolder: r.folderUrl,
    LinkExcel: r.excelUrl || "",
    LinkPdf: r.pdfUrl || "",
    LinkJson: r.jsonUrl || "",
    CrmId: r.crmId || "",
    LinkCrm: r.crmUrl || "",
    CrmMatch: r.crmMatch || "",
    Source: r.source || "",
    RemindersSent: r.remindersSent ?? 0,
  };
  if (r.submittedAt) fields.SubmittedAt = r.submittedAt;
  if (r.invitedAt) fields.InvitedAt = r.invitedAt;
  if (r.lastReminderAt) fields.LastReminderAt = r.lastReminderAt;
  if (r.missingDocs !== undefined) fields.DocumentsManquants = r.missingDocs;
  if (r.missingRemindersSent !== undefined) fields.MissingRemindersSent = r.missingRemindersSent;
  if (r.lastMissingReminderAt) fields.LastMissingReminderAt = r.lastMissingReminderAt;
  return fields;
}

function trackerRecord(id: string, f: Json): ReturnRecord {
  return {
    trackerId: id,
    caseId: str(f.CaseId),
    householdId: str(f.HouseholdId),
    clientKey: str(f.ClientKey),
    emailHash: str(f.EmailHash),
    name: str(f.Title),
    email: str(f.Email),
    language: str(f.Language),
    canton: str(f.Canton),
    taxYear: Number(f.TaxYear) || 0,
    state: FR_TO_STATE[str(f.EtatQuestionnaire)] || "draft",
    regime: str(f.RegimeText),
    optIn: f.OptIn === true,
    aiOptIn: f.AiOptIn === true,
    submittedAt: isoDate(f.SubmittedAt),
    docsReceived: Number(f.DocsReceived) || 0,
    docsExpected: Number(f.DocsExpected) || 0,
    driveId: str(f.DriveId),
    folderId: str(f.FolderId),
    folderUrl: str(f.LinkFolder),
    excelUrl: str(f.LinkExcel) || undefined,
    pdfUrl: str(f.LinkPdf) || undefined,
    jsonUrl: str(f.LinkJson) || undefined,
    crmId: str(f.CrmId) || undefined,
    crmUrl: str(f.LinkCrm) || undefined,
    crmMatch: (str(f.CrmMatch) || undefined) as ReturnRecord["crmMatch"],
    source: str(f.Source) || undefined,
    invitedAt: isoDate(f.InvitedAt),
    remindersSent: Number(f.RemindersSent) || 0,
    lastReminderAt: isoDate(f.LastReminderAt),
    staffStatus: str(f.Status) || undefined,
    extendedTo: isoDate(f.DelaiObtenu),
    pbmInvolved: f.PBM === true,
    excludedFromCampaign: f.ExclureCampagne === true,
    missingDocs: str(f.DocumentsManquants),
    missingRemindersSent: Number(f.MissingRemindersSent) || 0,
    lastMissingReminderAt: isoDate(f.LastMissingReminderAt),
    staffDocs: str(f.DocumentsADemander),
  };
}

class SharePointTracker implements ReturnTracker {
  private readonly list = new SiteList(env("TAX_QF_TRACKING_LIST") || TRACKING_LIST, TRACKER_COLUMNS);
  async upsert(record: ReturnRecord) {
    const existing = record.trackerId
      ? [{ id: record.trackerId }]
      : await this.list.query(`fields/CaseId eq ${quote(record.caseId)} and fields/TaxYear eq ${record.taxYear}`, 1);
    if (existing[0]) {
      await this.list.update(existing[0].id, trackerFields(record));
      return existing[0].id;
    }
    return this.list.create({ ...trackerFields(record), Status: "Nouveau" });
  }
  private async find(filter: string) {
    return (await this.list.query(filter)).map((item) => trackerRecord(item.id, item.fields));
  }
  findByCase(caseId: string) {
    return this.find(`fields/CaseId eq ${quote(caseId)}`);
  }
  findByEmailHash(emailHash: string) {
    return this.find(`fields/EmailHash eq ${quote(emailHash)}`);
  }
  findByClientKey(clientKey: string) {
    return this.find(`fields/ClientKey eq ${quote(clientKey)}`);
  }
  listByYear(taxYear: number) {
    return this.find(`fields/TaxYear eq ${taxYear}`);
  }
  async setStatus(trackerId: string, status: string) {
    await this.list.update(trackerId, { Status: status });
  }
  async markMissingReminder(trackerId: string, sent: number, at: string) {
    await this.list.update(trackerId, { MissingRemindersSent: sent, LastMissingReminderAt: at });
  }
}

// ---- "Préférences questionnaires" -------------------------------------------------------------------

const PREF_COLUMNS: Column[] = [
  text("ClientKey", "Clé client", { indexed: true }),
  text("Email", "E-mail"),
  text("Language", "Langue"),
  bool("OptIn", "Rappel annuel souhaité"),
  bool("Excluded", "Exclure de la campagne"),
  text("ExcludedReason", "Motif d'exclusion"),
  num("NoticeSentYear", "Préavis envoyé (année)"),
];

class SharePointPreferences implements PreferenceStore {
  private readonly list = new SiteList("Préférences questionnaires", PREF_COLUMNS);
  private toPrefs = (f: Json): ClientPreferences => ({
    clientKey: str(f.ClientKey),
    email: str(f.Email),
    name: str(f.Title),
    language: str(f.Language),
    optIn: f.OptIn === true,
    excluded: f.Excluded === true,
    excludedReason: str(f.ExcludedReason) || undefined,
    noticeSentYear: Number(f.NoticeSentYear) || undefined,
  });
  async get(clientKey: string) {
    const found = await this.list.query(`fields/ClientKey eq ${quote(clientKey)}`, 1);
    return found[0] ? this.toPrefs(found[0].fields) : null;
  }
  async upsert(prefs: ClientPreferences) {
    const fields: Json = {
      Title: prefs.name,
      ClientKey: prefs.clientKey,
      Email: prefs.email,
      Language: prefs.language,
      OptIn: prefs.optIn,
      Excluded: prefs.excluded,
      ExcludedReason: prefs.excludedReason || "",
    };
    if (prefs.noticeSentYear) fields.NoticeSentYear = prefs.noticeSentYear;
    const found = await this.list.query(`fields/ClientKey eq ${quote(prefs.clientKey)}`, 1);
    if (found[0]) await this.list.update(found[0].id, fields);
    else await this.list.create(fields);
  }
  async listOptedIn() {
    return (await this.list.query("fields/OptIn eq 1")).map((item) => this.toPrefs(item.fields));
  }
}

// ---- "Accès questionnaires" -----------------------------------------------------------------------

const ACCESS_COLUMNS: Column[] = [
  text("Kind", "Type"),
  text("CaseId", "Dossier", { indexed: true }),
  text("EmailHash", "Empreinte e-mail"),
  text("Scope", "Portée"),
  text("Purpose", "Usage"),
  num("ExpiresAt", "Expiration (ms)"),
  bool("Revoked", "Révoqué"),
];

class SharePointAccess implements AccessStore {
  private readonly list = new SiteList("Accès questionnaires", ACCESS_COLUMNS);
  private cache = new Map<string, { record: AccessRecord | null; at: number; itemId?: string }>();
  async put(record: AccessRecord) {
    await this.list.create({
      Title: record.keyHash,
      Kind: record.kind,
      CaseId: record.caseId,
      EmailHash: record.emailHash,
      Scope: record.scope,
      Purpose: record.purpose || "",
      ExpiresAt: record.expiresAt,
      Revoked: record.revoked,
    });
    this.cache.delete(record.keyHash);
  }
  async get(keyHash: string) {
    const cached = this.cache.get(keyHash);
    if (cached && Date.now() - cached.at < 60_000) return cached.record;
    const found = await this.list.query(`fields/Title eq ${quote(keyHash)}`, 1);
    const f = found[0]?.fields;
    const record: AccessRecord | null = f
      ? {
          keyHash,
          kind: str(f.Kind) === "session" ? "session" : "link",
          caseId: str(f.CaseId),
          emailHash: str(f.EmailHash),
          scope: str(f.Scope) === "status" ? "status" : "edit",
          purpose: str(f.Purpose) || undefined,
          expiresAt: Number(f.ExpiresAt) || 0,
          revoked: f.Revoked === true,
        }
      : null;
    this.cache.set(keyHash, { record, at: Date.now(), itemId: found[0]?.id });
    return record;
  }
  async revoke(keyHash: string) {
    const found = await this.list.query(`fields/Title eq ${quote(keyHash)}`, 5);
    for (const item of found) await this.list.update(item.id, { Revoked: true });
    this.cache.delete(keyHash);
  }
  async revokeCase(caseId: string, kind?: AccessRecord["kind"]) {
    const found = await this.list.query(`fields/CaseId eq ${quote(caseId)}`);
    for (const item of found) if (!kind || item.fields.Kind === kind) await this.list.update(item.id, { Revoked: true });
    this.cache.clear();
  }
}

// ---- in-memory adapters (mock mode, tests) ---------------------------------------------------------

export interface MemoryCrmItem {
  id: string;
  title: string;
  firstName: string;
  email: string;
  acquis: string;
  actif: boolean;
  etendue: string[];
}

export function memoryPorts(seed: { crm?: MemoryCrmItem[] } = {}) {
  const crm: (MemoryCrmItem & { webUrl: string; comment?: string; documents?: string })[] = (seed.crm || []).map((c) => ({ ...c, webUrl: `crm://${c.id}` }));
  const returns: ReturnRecord[] = [];
  const prefs: ClientPreferences[] = [];
  const access = new Map<string, AccessRecord>();
  let nextId = 1;
  const registry: ClientRegistry = {
    async match(identity) {
      return matchCrm(crm, identity);
    },
    async recordTaxClient(identity, documentsUrl) {
      const result = matchCrm(crm, identity);
      if (result.status === "ambiguous") return null;
      if (result.status === "matched") {
        const item = crm.find((c) => c.id === result.id)!;
        if (item.acquis === "Client" && !item.etendue.includes("Fiscal")) item.etendue = [...item.etendue, "Fiscal"];
        return { id: item.id, url: item.webUrl, created: false };
      }
      const id = `crm${nextId++}`;
      crm.push({ id, title: identity.lastName.toUpperCase(), firstName: givenName(identity.firstName), email: identity.email, acquis: "Prospect", actif: false, etendue: ["Fiscal"], webUrl: `crm://${id}`, documents: documentsUrl });
      return { id, url: `crm://${id}`, created: true };
    },
    async listTaxClients() {
      return crm.filter((c) => c.actif && c.etendue.includes("Fiscal") && c.email).map((c) => ({ id: c.id, email: c.email, lastName: crmLastName(c.title, c.firstName), firstName: c.firstName }));
    },
  };
  const tracker: ReturnTracker = {
    async upsert(record) {
      const index = returns.findIndex((r) => (record.trackerId && r.trackerId === record.trackerId) || (!!record.caseId && r.caseId === record.caseId && r.taxYear === record.taxYear));
      if (index >= 0) {
        // Staff-owned fields are kept.
        const staff = { staffStatus: returns[index].staffStatus, extendedTo: returns[index].extendedTo, pbmInvolved: returns[index].pbmInvolved, excludedFromCampaign: returns[index].excludedFromCampaign, staffDocs: returns[index].staffDocs };
        returns[index] = { ...record, ...staff, trackerId: returns[index].trackerId };
        return returns[index].trackerId!;
      }
      const trackerId = `t${nextId++}`;
      returns.push({ ...record, trackerId, staffStatus: "Nouveau" });
      return trackerId;
    },
    async findByCase(caseId) {
      return returns.filter((r) => r.caseId === caseId).map((r) => ({ ...r }));
    },
    async findByEmailHash(emailHash) {
      return returns.filter((r) => r.emailHash === emailHash).map((r) => ({ ...r }));
    },
    async findByClientKey(clientKey) {
      return returns.filter((r) => r.clientKey === clientKey).map((r) => ({ ...r }));
    },
    async listByYear(taxYear) {
      return returns.filter((r) => r.taxYear === taxYear).map((r) => ({ ...r }));
    },
    async setStatus(trackerId, status) {
      const row = returns.find((r) => r.trackerId === trackerId);
      if (row) row.staffStatus = status;
    },
    async markMissingReminder(trackerId, sent, at) {
      const row = returns.find((r) => r.trackerId === trackerId);
      if (row) Object.assign(row, { missingRemindersSent: sent, lastMissingReminderAt: at });
    },
  };
  const prefStore: PreferenceStore = {
    async get(clientKey) {
      return prefs.find((p) => p.clientKey === clientKey) || null;
    },
    async upsert(value) {
      const index = prefs.findIndex((p) => p.clientKey === value.clientKey);
      if (index >= 0) prefs[index] = value;
      else prefs.push(value);
    },
    async listOptedIn() {
      return prefs.filter((p) => p.optIn);
    },
  };
  const accessStore: AccessStore = {
    async put(record) {
      access.set(record.keyHash, { ...record });
    },
    async get(keyHash) {
      return access.get(keyHash) || null;
    },
    async revoke(keyHash) {
      const record = access.get(keyHash);
      if (record) record.revoked = true;
    },
    async revokeCase(caseId, kind) {
      for (const record of access.values()) if (record.caseId === caseId && (!kind || record.kind === kind)) record.revoked = true;
    },
  };
  return { ports: { registry, tracker, prefs: prefStore, access: accessStore } as Ports, crm, returns, prefsList: prefs, access };
}

// Kept on globalThis: Next.js bundles each route separately, and the in-memory (mock) ports must be
// shared by all routes of the process.
const holder = globalThis as unknown as { __tqfPorts?: Ports | null };

export function sharePointPorts(): Ports {
  if (holder.__tqfPorts) return holder.__tqfPorts;
  holder.__tqfPorts = mockStorageEnabled()
    ? memoryPorts({ crm: [{ id: "crm-demo", title: "EXEMPLE", firstName: "Client", email: "client@example.com", acquis: "Client", actif: true, etendue: ["Fiscal"] }] }).ports
    : { registry: new SharePointClientRegistry(), tracker: new SharePointTracker(), prefs: new SharePointPreferences(), access: new SharePointAccess() };
  return holder.__tqfPorts;
}

/** For tests: replace the singleton. */
export function setPortsForTests(value: Ports | null) {
  holder.__tqfPorts = value;
}
