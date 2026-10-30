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
   go), uploads the documents of section H and sends it.
3. The revision is frozen: `questionnaire.json` and its SHA-256, and the PDF to sign, whose
   every page carries the reference `<caseId>-R<n>-<first 8 hex of the SHA-256>`.
4. The client downloads the PDF, signs it and uploads the scan (several files allowed), then
   confirms. The scans are hashed; the revision is `signed`.
5. Ark reviews in Cadence (internal LBA note, risk, four eyes). Corrections = `reopen`: a new
   revision pre-filled with the previous answers; nothing of the old revision is rewritten.

Revision states: `open` → `awaiting_signature` → `signed`, or `open` → `returned`; any
revision may become `superseded` (reopened) or `closed`.

## SharePoint (site LBA - OAR)

- Client folder (given by Cadence, must be in the "Documents" library of LBA - OAR):
  `KYC <caseId>/` with `case.json` (state) and `Révision <n>/` (`draft.json`,
  `Documents/` — uploads named `[code] <document> - <original name>`, PDF or images only —,
  `questionnaire.json`, `questionnaire.sha256`, `Formulaire KYC - … - R<n> - à signer.pdf`,
  `Signé/`). Documents sent with an earlier revision count for the next one and are never
  touched again. At submission every document is listed with its item id and SHA-256
  (`questionnaire.json`, `latestRevision.documents`); the signed scans likewise at confirmation.
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
| `POST /cases/<caseId>` | `{action: "link", expectedRevision}` | new link (old links and sessions revoked); open or awaiting signature only |
| | `{action: "reopen", expectedRevision, prefill?, route?}` | new revision + link; from returned, awaiting signature or signed |
| | `{action: "close", expectedRevision}` | irreversible |

`expectedRevision` must be the latest revision number (`409 revision_conflict` otherwise).
Summary: `caseId, clientRef, displayName, route, language, closed, updatedAt, folder,
actionRequired (await_client | review_route | await_signature | review_kyc | null),
latestRevision {n, id, state, dates, flags, declarationId, json {itemId, sha256}, pdf, signed[],
folder}, revisions[]`. Flags (`pep`, `sanctions`, `criminal`, `trustOrFoundation`, `nominee`,
`listed`, `forThird`, `cash`, `crypto`, `valuables`, `licence`, `notStarted`, `noSubstance`, `routeMismatch`)
are points for Ark's review, not a risk class.

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

Go-live: DNS `kyc` + Infomaniak site alias + certificate (manual, like tax.), GitHub secrets
`KYC_QF_TOKEN_SECRET` and `KYC_QF_API_KEYS`, the same API key in Cadence.

Tests: `npm run -s test:kyc-qf` (Node 22).
