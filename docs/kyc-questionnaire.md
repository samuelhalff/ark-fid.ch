# KYC questionnaire (kyc.ark-fid.ch)

Client form replacing Dima's Word KYC forms (KYC PP, KYC PM operating, KYC PM non-operating,
29.10.2026). Ark prepares and sends each case from **Cadence**; this app only shows the form to
the client, stores everything on the SharePoint site **LBA - OAR** and exposes a signed API to
Cadence. It sends no e-mail except the one-time login code.

## Routes (chosen by Ark before sending, never by the client)

| Route | Form | Section B |
|---|---|---|
| `pp` | Natural person | Beneficial owner (self or others) |
| `pm-op` | Operating legal entity | Art. 2a al. 3 LBA: ≥ 25 % (alone or in concert) → other control → most senior manager; listed company: art. 4 al. 1 LBA, Ark decides |
| `pm-nonop` | Non-operating legal entity (art. 2a al. 6 LBA, in particular domiciliary companies) | Every beneficial owner of the assets, no threshold |

Trusts, foundations and other complex structures stay outside the web form (manual route).
The client's own description of the company (`a.activityKind`) is compared with Ark's route:
an operating form for a company that only holds assets, or a non-operating form for a company
that runs or supports a business, sends the submission back to Ark (`returned`) with nothing to
sign. Ark then reopens the case with the right route.

## Flow

1. Cadence creates a case (client folder on LBA - OAR, route, language, e-mail, prefill) and gets
   the client link. Cadence sends the invitation.
2. The client opens the link, receives a 6-digit code by e-mail, fills the form (saved as they
   go), uploads the documents of section H and sends it. Without the link (lost, expired, or to
   resume later), the client enters their e-mail address on kyc.ark-fid.ch: a code is sent only if
   a form in progress (open or awaiting signature, not closed) was issued to that address; the page
   answers the same way either way, and the lookup runs after the answer. Several forms for one
   address → the client picks one after entering the code.
3. The revision is frozen: `questionnaire.json` and its SHA-256, and the PDF to sign, whose
   every page carries the reference `<caseId>-R<n>-<first 8 hex of the SHA-256>`.
4. The form is signed online or on paper, one way per revision:
   - **online** (Sam, 01–02.11.2026; `KYC_QF_ONLINE_SIGNATURE=off` disables it). Signatories are
     fixed at submission (`rev.signers`): the client (natural person) at the case address; a
     company's signatories at the addresses given in the form (`i.signers[].email`, one per
     person, duplicates refused); a sole signatory with no address signs at the case address.
     Online is offered when every signatory has an address and a printable name. Each signs in
     their own session opened with one code sent to their own address (never a second code):
     tick the confirmation, type their name (compared without case, accents or word order), and
     draw their signature with a finger, mouse or pen. The server rejects an empty drawing and
     stores the checked PNG with that signer's evidence. The
     app e-mails each signatory other than the contact a request with a link bound to their
     address (fixed wording, from `info@ark-fid.ch`); they may also request a code at
     kyc.ark-fid.ch. A signatory's session only reads the PDF and signs (no answers, documents
     or scans). Each signature is saved at once; when the last one signs, the PDF gets a page
     listing every signatory (declared name, name typed, drawn signature, code address, Swiss
     time, SHA-256 of the PDF and of the JSON) and is filed in `Signé/` (`Pièces/` for a case with the layout folders) as
     `… - R<n> - signé en ligne.pdf`. The PDF to sign points to the final signature page, so it
     does not show an unexplained blank signature line. Older signed PDFs stay unchanged. Once
     someone has signed online, the paper path is closed; a scan already uploaded blocks online
     until it is deleted;
   - **on paper**: the contact downloads the PDF, has it signed, uploads the scan (several files
     allowed), then confirms. The scans are hashed.
   Either way the revision is `signed`. A new contact link (reminder) does not revoke the
   signatories' links; reopen and close revoke everything.
5. Ark reviews in Cadence (internal LBA note, risk, four eyes). Corrections = `reopen`: a new
   revision pre-filled with the previous answers; nothing of the old revision is rewritten.

Revision states: `open` → `awaiting_signature` → `signed`, or `open` → `returned`; any
revision may become `superseded` (reopened) or `closed`.

## SharePoint (site LBA - OAR)

- Client folder (given by Cadence, must be in the "Documents" library of LBA - OAR). Cadence owns the
  layout (`app/kyc/layout.py`): readable documents in `<Client>/<YYYY>/Pièces/`, the app's data in
  `<Client>/Données techniques/`, the year being the case's. The site builds no path: `POST /cases`
  carries `piecesFolder` and `technicalFolder` (`{driveId, itemId}`, both or neither, same library as
  `clientFolder`) and the case keeps them. Several cases share the two folders, told apart by name:
  - data in `Données techniques/`: `KYC <caseId> - case.json` (state) and, per revision,
    `KYC <caseId> R<n> - draft.json`, `… - questionnaire.json`, `… - questionnaire.sha256`;
  - documents in `Pièces/`: uploads `[code] <document> - <original name> (<caseId> R<n>).<ext>`, the PDF to
    sign `Formulaire KYC - … - à signer (<caseId> R<n>).pdf`, signed scans
    `Formulaire signé <name> (<caseId> R<n>).<ext>` and the online-signed PDF `… - signé en ligne (<caseId> R<n>).pdf`.
    A file is the revision's only if its name ends with that tag (before the extension, and SharePoint's
    " 1" on a taken name), so one case never reads or deletes another's, whatever a client names a file.
  The summary's `folder` and `latestRevision.folder` are the `Pièces/` folder (where the PDFs are).
  A case created without the two folders (every case before the layout, or one Cadence sent while
  SharePoint did not answer it) keeps its own `KYC <caseId>/` with `case.json` and `Révision <n>/`
  (`draft.json`, `Documents/` — uploads named `[code] <document> - <original name>`, PDF or images
  only —, `questionnaire.json`, `questionnaire.sha256`, `Formulaire KYC - … - R<n> - à signer.pdf`,
  `Signé/`), read and written as before; nothing is moved. Documents sent with an earlier revision count
  for the next one and are never touched again. At submission every document is listed with its item id and
  SHA-256 (`questionnaire.json`, `latestRevision.documents`); the signed scans likewise at confirmation.
  Files added to a folder after that are not part of the record.
- List **Suivi KYC**: one row per revision (state, dates, flags, SHA-256, reference, links).
- List **Accès KYC**: HMACs of links and sessions only.
- Lists **Registre LBA clients** and **Registre de transparence**: copied from Interne on
  30.10.2026 (column "Formulaire KYC (route)" added from Dima's Excel). Cadence keeps them.

## Cadence API

Base: `https://kyc.ark-fid.ch/api/kyc-questionnaire/staff`. JSON. Every request is signed:

```
x-kyc-key-id: <keyId>
x-kyc-timestamp: <ms since epoch>          (±5 min)
x-kyc-nonce: <16–64 chars [A-Za-z0-9_-]>   (single use)
x-kyc-signature: base64url(HMAC-SHA256(secret,
    METHOD \n PATH?QUERY \n TIMESTAMP \n NONCE \n sha256hex(body)))
Idempotency-Key: <8–100 chars [A-Za-z0-9_.:-]>   (every POST)
```

Keys: `KYC_QF_API_KEYS="cadence:<secret ≥ 32 chars>"` (two pairs during a rotation). A POST
replayed with the same key and body returns the same case (the case id derives from the key, so
a retry after a partial failure resumes the same case) (a fresh link replaces the old one:
link tokens are never stored); the same key with another body is `409 idempotency_conflict`.

| Call | Body | Result |
|---|---|---|
| `POST /cases` | `{clientRef, displayName, route, language: "fr"\|"en", email, clientFolder: {driveId, itemId}, prefill?: {<answer id>: value}}` | `201` summary + `link: {url, expiresAt}` |
| `GET /cases?cursor=&limit=50` | – | `{items: [{caseId, clientRef, displayName, route, revision, revisionId, state, updatedAt, declarationId, jsonSha256}], nextCursor, more}` (oldest first; keep `nextCursor`) |
| `GET /cases/<caseId>` | – | summary + `answers` of the latest submitted revision |
| `POST /cases/<caseId>` | `{action: "link", expectedRevision, email?}` | new link (old links and sessions revoked); open or awaiting signature only. `email` changes the contact: the link and codes then go to the new address only |
| | `{action: "signers", expectedRevision, signers: [{id, email}]}` | awaiting signature: give or correct signatories' addresses (unsigned ones); each new address gets a request; a replay sends nothing |
| | `{action: "reopen", expectedRevision, prefill?, route?}` | new revision + link; from returned, awaiting signature or signed |
| | `{action: "prefill", expectedRevision, prefill: {<answer id>: value}, overwrite?: boolean, by?: string}` | open revision only (`409 invalid_state` otherwise). Fills **empty** answers only. With `overwrite: true` the given values also replace answers the client already typed (values that differ), each marked entered by Ark (`by`, default `"Cadence"`). Always bumps `staffPrefillVersion` so an open client tab cannot erase them (its next save is `409 draft_changed` and reloads). Result: summary |
| | `{action: "assist", by, ttlMinutes?, expectedRevision?}` | open revision only. Issues a single-use staff access, see "Assisted entry" below. Result: summary + `assist: {link, code, expiresAt}` |
| | `{action: "close", expectedRevision}` | irreversible |

`expectedRevision` must be the latest revision number (`409 revision_conflict` otherwise).
Summary: `caseId, clientRef, displayName, route, language, closed, updatedAt, folder,
actionRequired (await_client | review_route | await_signature | review_kyc | null),
latestRevision {n, id, state, dates, flags, declarationId, json {itemId, sha256}, pdf, signed[], signers? [{id, name, email, emailBy, invitedAt, signedAt, typed}],
folder}, revisions[]`. Flags (`pep`, `sanctions`, `criminal`, `trustOrFoundation`, `nominee`,
`listed`, `forThird`, `cash`, `crypto`, `valuables`, `licence`, `notStarted`, `noSubstance`, `routeMismatch`)
are points for Ark's review, not a risk class.

### Assisted entry (Ark fills the form with or for the client)

`assist` gives an Ark person a short-lived, **single-use** way into the case's open revision,
with no e-mail code (the access itself is the secret):

- request `{action: "assist", by: "<staff name or e-mail>", ttlMinutes?: 1-240 (default 30), expectedRevision?}`
  (`expectedRevision` may be omitted; if given it must be the latest);
- response: the case summary plus `assist: {link, code, expiresAt}`, e.g.
  `{"assist": {"link": "https://kyc.ark-fid.ch/fr/#assist=<43 chars>", "code": "K7MQ-4XPD", "expiresAt": "2026-11-10T14:30:00.000Z"}}`.
  `link` and `code` are two ways into the **same** single use: using either one spends both.
  The code (8 characters, no 0/1/O/I) is typed on the access page under the quiet "Code cabinet"
  entry (case, spaces and dashes are ignored); the link opens the form directly;
- refused with `409 invalid_state` when the revision is not `open` (returned, awaiting signature,
  signed, closed or superseded), `400 invalid_request` for a missing `by` or a bad `ttlMinutes`;
- the secrets are stored only as HMACs; a replay of the same `Idempotency-Key` issues a fresh
  access. A new `link`, `reopen` or `close` revokes outstanding assist access;
- browser side: `POST /api/kyc-questionnaire/auth {action: "assist", token | code}` (10 per IP per
  10 min) sets a session cookie with role **`staff`** (8 hours, bound to the revision; the case
  payload's `signing.role` shows it). Wrong, used or expired: `400 assist_invalid`.

Role `staff` can do everything the contact can on an open revision: save the draft, upload and
delete documents, read the PDF, submit. It can **not** sign: `signOnline`, `confirmSigned` and the
upload of a signed scan answer `403 not_allowed`.

**Provenance.** Every answer whose value changes in a `staff` session (draft save or submit), and
every value written by `prefill` with `overwrite`, is recorded as `enteredBy[<answer id>] = <by>`
("entered by Ark (<by>)"). If the client later changes that answer, the mark is removed. Marks are
kept in `draft.json` (open) and in the frozen `questionnaire.json` (`enteredBy`, plus `submittedBy`
when staff submitted), they are carried into a correction revision while unchanged, and they are
returned to Cadence as `enteredBy` on `GET /cases/<caseId>` (absent when none). The PDF's internal
metadata (Keywords: `ark-assisted`, `ark-entered-ids`) lists them; they are not printed on the form
and never appear in the client's case payload or form UI.

Prefill ids are the answer ids of `src/lib/kyc-questionnaire/schema.ts` (e.g. `a.name`,
`a.uid`, `a.seat`, `a.directors` as rows `{_id, lastName, …}`); unknown ids are dropped and
`route` is always the case's.

## Configuration

| Variable | Use |
|---|---|
| `KYC_QF_TOKEN_SECRET` | HMAC key of links, codes, sessions (≥ 32 chars; required) |
| `KYC_QF_API_KEYS` | Cadence keys `id:secret[,id:secret]` (required for the API) |
| `KYC_QF_MAIL_SENDER` | Sender of the code e-mails (default info@ark-fid.ch) |
| `KYC_QF_PUBLIC_ORIGIN`, `KYC_QF_ALLOWED_ORIGINS` | Defaults https://kyc.ark-fid.ch |
| `KYC_QF_SP_SITE_ID`, `KYC_QF_SP_DRIVE_ID`, `KYC_QF_TRACKING_LIST`, `KYC_QF_ACCESS_LIST` | Defaults: LBA - OAR, "Suivi KYC", "Accès KYC" |
| `KYC_QF_STORAGE=mock`, `KYC_QF_MOCK_DIR` | Development only (local folder, in-memory lists) |

Graph access uses the site's existing app registration (`MSGRAPH_*`). To do: a dedicated app
with `Sites.Selected` on LBA - OAR only.

Live since 30.10.2026: Cloudflare DNS `kyc` A/AAAA (DNS-only, like `lba`), Infomaniak site alias and
certificate, GitHub secrets `KYC_QF_TOKEN_SECRET` and `KYC_QF_API_KEYS`. Cadence holds the same API key.
What Cadence builds around this app: `docs/kyc-cadence-brief.md`. Templates and Dima's internal notes:
LBA - OAR › Documents › "LBA - KYC (modèles)".

Tests: `npm run -s test:kyc-qf` (Node 22).
