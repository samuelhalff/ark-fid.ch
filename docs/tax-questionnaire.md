# Questionnaire fiscal — tax.ark-fid.ch

Formulaire adaptatif pour la déclaration d'impôt des particuliers (fr/en/de). Il remplace l'ancien fichier Excel « Questionnaire fiscal ». Les réponses et documents arrivent dans le site SharePoint « Questionnaires fiscaux » ; l'équipe reçoit un e-mail avec l'Excel et le résumé PDF.

## Adresses

- https://tax.ark-fid.ch/fr/ (ainsi que /en/ et /de/) : le middleware réécrit vers `app/[locale]/questionnaire-fiscal`. Les autres chemins de ce domaine renvoient vers ark-fid.ch.
- https://ark-fid.ch/fr/questionnaire-fiscal/ : la même page sur le site principal. Les versions es et pt redirigent vers en.
- Les deux adresses sont en `noindex` et absentes du sitemap ; la canonique est celle du site principal.
- Les liens envoyés par e-mail pointent sur `TAX_QF_PUBLIC_ORIGIN` (par défaut https://tax.ark-fid.ch).

## Parcours (le contenu se modifie dans `src/lib/tax-questionnaire/`)

1. **start** : années (par défaut l'année précédente ; plusieurs années pour les arriérés), ménage, canton et commune au 31.12, coordonnées, dernière déclaration, avis de taxation déjà reçu. Ensuite : prise de connaissance de la notice de confidentialité, Turnstile, puis code envoyé par e-mail. Le dossier n'est créé qu'une fois l'adresse vérifiée.
2. **regime** : des faits (domicile pendant l'année, arrivée ou départ, changement de canton, raisons du rattachement pour les non-résidents, impôt à la source sur la fiche de salaire, accord de forfait…). Le régime est déduit de ces faits, jamais demandé comme une catégorie. Le délai du 31 mars, qui ne se prolonge pas, est affiché dès que des faits d'imposition à la source sont présents.
3. **baseDocs** (peut être sauté) : dernière déclaration, dernier avis, permis, attestation d'arrivée ou de départ.
4. **router** : des cartes par domaine. « Inchangé depuis l'an dernier » n'apparaît qu'à côté d'éléments concrets repris de l'année précédente.
5. Écrans de détail, seulement pour ce qui a été coché : famille, travail, comptes et dettes, immobilier (une fiche complète par bien), autres, régularisation (route protégée), forfait.
6. **documents** : la liste à fournir est calculée à partir des réponses (`documents.ts`), avec pour chaque document « où le trouver » et un texte pour le demander (`hints.ts`). Pour chaque document : déposer, « plus tard » ou « ne me concerne pas ».
7. **review** : délai, remarques, rappel annuel, certification d'exactitude, puis envoi.
8. **Page de suivi** (après l'envoi) : dates importantes (`deadlines.ts`), documents encore attendus avec dépôt, « j'ai terminé », « corriger mes réponses » (crée une nouvelle version), invitation du partenaire (couple non marié), provenance.

Le contenu est entièrement décrit par des données. `schema.ts` contient les questions, les conditions d'affichage et les libellés fr/en/de. `documents.ts` contient les règles de la liste de documents, `attention.ts` les points d'attention de l'Excel et `ui.ts` les textes d'interface. Les tests de scénarios (`scenarios.test.ts`) couvrent 13 cas types et doivent rester verts.

## Stockage (SharePoint « Questionnaires fiscaux »)

- Bibliothèque « Documents » : un dossier par contribuable (ou couple marié) et par année fiscale, `/Questionnaires/<année>/<NOM Prénom> - <date> - <caseId>/`. Il contient :
  - les sous-dossiers par catégorie (`00 Documents de base`, `02 Activité lucrative`…). Les fichiers sont téléversés directement du navigateur vers SharePoint par sessions d'upload Graph, en tranches de 5 Mo. Le nom de chaque fichier commence par un code `[xxxxxx]` qui le relie à son document dans la liste.
  - `draft.json` : le brouillon, sauvegardé automatiquement. Rien n'est conservé dans le navigateur.
  - `_events/` : un fichier par événement, avec des identifiants seulement, jamais de réponses.
  - `Envoi AAAA-MM-JJ HHhMM <clé>/` : une version immuable par envoi, avec `questionnaire.json`, `consent.json`, l'Excel et le PDF.
  - `_A verifier/` : les fichiers dont le contenu ne correspond pas au type annoncé (exécutable, faux PDF, fichier vide). Ils sont signalés dans l'Excel et ne sont jamais supprimés.
- Listes créées automatiquement par l'application sur ce site :
  - « Suivi questionnaires » : une ligne par déclaration et par année. L'application écrit l'état, le régime, les nombres de documents, les liens et l'identifiant CRM. Le personnel gère les colonnes **Statut**, **Délai obtenu jusqu'au** (lu par la page de suivi et par la campagne), **PBM impliqué** et **Documents à demander**.
  - « Préférences questionnaires » : par client, rappel annuel, exclusion de la campagne et préavis envoyé.
  - « Accès questionnaires » : uniquement des empreintes HMAC de liens et de sessions, inutilisables sans la clé du serveur.
- Note de migration : les premières lignes de test avaient créé des colonnes à une seule ligne `FolderUrl`, `ExcelUrl`, `PdfUrl`, `JsonUrl`, `CrmUrl` et `Regime`. Les URL dépassent 255 caractères, donc l'application écrit désormais dans `LinkFolder`, `LinkExcel`, `LinkPdf`, `LinkJson`, `LinkCrm` et `RegimeText`, qui acceptent plusieurs lignes. Les anciennes colonnes peuvent être masquées ou supprimées dans SharePoint.

## Registre clients (CRM) et interfaces

Le registre maître est la liste « Clients » du site CRM. Il n'y a pas de second registre. Les règles appliquées à chaque envoi, l'adresse e-mail étant vérifiée :

- **Correspondance par e-mail** : le lien est enregistré. Si Acquis = Client et que « Fiscal » manque dans Etendue, il est ajouté. Aucun autre champ n'est modifié.
- **Correspondance par le nom seulement** : statut « ambiguous », aucune écriture ; l'équipe tranche.
- **Aucune correspondance** : création d'un Prospect (Title en majuscules, FirstName, EMail, Etendue = Fiscal, Commentaires « Créé par tax.ark-fid.ch … », LienDocuments = dossier).
- `TAX_QF_CRM_WRITES=0` rend le CRM en lecture seule (tests).

**Liste tenue par Cadence (`TAX_QF_CLIENTS_SOURCE=cadence`).** Le registre devient `server/cadence-registry.ts` : la campagne invite les personnes que Cadence lui donne pour l'année (`GET https://app.ark-fid.ch/api/tax-form/clients?year=<année fiscale>`, signé comme les appels du KYC vers Cadence, avec la paire `cadence` de `TAX_QF_API_KEYS`) : une obligation fiscale de l'année encore à déposer dans l'Odoo du bureau, une personne (pas une société) avec une adresse e-mail, non exclue de la campagne dans Cadence. Chaque invitation porte la référence Cadence du client (`clientRef`). Le CRM SharePoint n'est plus ni lu ni écrit (`match` et `recordTaxClient` ne font rien : Cadence rattache les déclarations en relevant le fil). **Si Cadence ne répond pas ou ne donne pas toute la liste, la campagne saute ce passage** (rien n'est envoyé, la route répond 503 `clients_unavailable`, la clé n'est pas enregistrée) : jamais d'invitation depuis une liste ancienne ou partielle. Le récapitulatif quotidien aux collaborateurs est coupé dans ce mode (les écrans de Cadence le remplacent) ; l'e-mail interne à chaque envoi reste.

Le formulaire, l'Excel, le PDF et la campagne ne passent que par les interfaces de `server/ports.ts` : `ClientRegistry`, `ReturnTracker`, `PreferenceStore` et `AccessStore`. Les implémentations SharePoint se trouvent dans `server/sharepoint-registry.ts`.

## Accès (sans compte)

- **Lien magique** : un jeton opaque placé dans le fragment `#acces=`, donc jamais envoyé aux serveurs ni à l'analytique. Seul son HMAC est stocké. Durée : 30 jours pour reprendre, 14 jours pour une invitation.
- **Code à 6 chiffres** envoyé par e-mail à chaque ouverture : 10 minutes, usage unique, 5 essais. Des limites s'appliquent par IP et par adresse.
- **Session** : cookie `__Host-tqf` (HttpOnly, Secure, SameSite=Lax), 7 jours au maximum, révocable. Toute modification exige l'origine exacte et l'en-tête `x-tqf: 1`.
- **« Vous avez déjà commencé ? »** : un lien est envoyé si un dossier existe ; la réponse est identique dans tous les cas.
- **Campagne** : la renouvellement ne renvoie jamais les réponses de l'année précédente sans code e-mail. Les comptes clients par mot de passe ne sont pas prévus.

## E-mails

- **Interne** :
  - envoyé à samuel.halff@ark-fid.ch, en copie à sebastien.gallie@ark-fid.ch et lassana.dioum@pbm.law, depuis info@ark-fid.ch par Graph (`/users/info@ark-fid.ch/sendMail`) ;
  - l'Excel et le PDF sont joints, avec le lien du dossier et les points d'attention ;
  - l'objet est préfixé `[TOU 31.03]`, `[URGENT]` (impôt à la source jusqu'au 31 mars) ou `[Régularisation]` selon le cas.
- **Client** : contient les documents reçus et attendus (libellés seulement, jamais les noms de fichiers) et le contact. Sur la route de régularisation, il dit seulement « demande reçue ».
- **Cas de test ou de démonstration** : si l'adresse du client est en @ark-fid.ch ou @pbm.law, ou si le nom du client ou du dossier commence par TEST ou DÉMO/DEMO, les e-mails internes (envoi, documents complémentaires, relances groupées) partent au seul destinataire principal, sans copie (`isInternalCase` dans `server/email.ts`).
- Si l'e-mail interne échoue, l'envoi reste enregistré et peut être relancé : la même version est réutilisée et rien n'est dupliqué.
- L'Excel liste chaque fichier par document. Il se suffit donc à lui-même pour les destinataires hors du tenant.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `TAX_QF_TOKEN_SECRET` | **obligatoire**, 32 caractères au moins (HMAC des liens, codes et sessions). Sans elle, tout échoue en mode fermé. |
| `MSGRAPH_TENANT_ID` / `MSGRAPH_CLIENT_ID` / `MSGRAPH_CLIENT_SECRET` | application Graph existante (crm-dev). Une application dédiée peut la remplacer via `TAX_QF_GRAPH_*`. |
| `TAX_QF_SP_DRIVE_ID`, `TAX_QF_SP_SITE_ID`, `TAX_QF_SP_ROOT_FOLDER` | valeurs par défaut : le site « Questionnaires fiscaux », la bibliothèque Documents et le dossier `Questionnaires`. |
| `TAX_QF_CRM_SITE_ID`, `TAX_QF_CRM_LIST_ID` | valeurs par défaut : liste CRM « Clients ». |
| `TAX_QF_MAIL_SENDER`, `TAX_QF_MAIL_TO`, `TAX_QF_MAIL_CC` | valeurs par défaut : frontdesk@ (Sam 2026-11-14 : les retours d’erreur arrivent là où on les lit), Samuel, Sébastien + Lassana. `none` donne une liste vide. Supprimer le secret GitHub retire aussi la ligne du `.env` du serveur au déploiement suivant. |
| `TAX_QF_PUBLIC_ORIGIN` | origine des liens envoyés par e-mail. |
| `TAX_QF_ALLOWED_ORIGINS` | origines supplémentaires (préproduction). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | déjà utilisées par le site. |
| `TAX_QF_CRON_SECRET`, `TAX_QF_STAFF_ALERT_TO`, `TAX_QF_CLEANUP_ENABLED` | campagne annuelle et nettoyage (voir plus bas). |
| `TAX_QF_CLIENTS_SOURCE` | `cadence` : la campagne lit sa liste dans Cadence (voir « Registre clients ») ; vide : CRM SharePoint. Variable de dépôt GitHub (pas un secret) reportée par le déploiement ; la supprimer la retire du serveur. `TAX_QF_CADENCE_CLIENTS_URL` (facultatif) change l'adresse (défaut https://app.ark-fid.ch/api/tax-form/clients). |
| `TAX_QF_API_KEYS` | clés de l'API bureau (Cadence), `cadence:<secret de 32 caractères ou plus>` ; deux paires séparées par une virgule pendant une rotation. Distinctes de `KYC_QF_API_KEYS`. Sans elles, l'API refuse tout. |
| `TAX_QF_AI_*` | assistance IA, désactivée par défaut (voir plus bas). |
| Tests uniquement | `TAX_QF_STORAGE=mock`, `TAX_QF_MOCK_DIR`, `TAX_QF_SKIP_TURNSTILE=1` (hors production), `TAX_QF_FOLDER_PREFIX="TEST - "`, `TAX_QF_CRM_WRITES=0`. |

## Avant la mise en ligne (propriétaire)

1. **Infomaniak** : alias tax.ark-fid.ch et certificat SSL qui contient ce nom (le DNS existe déjà). Vérifier https://tax.ark-fid.ch/fr/.
2. **Secrets de production** : ajouter `TAX_QF_TOKEN_SECRET` (aléatoire, 48 caractères ou plus) et `TAX_QF_CRON_SECRET`. Ajouter aussi les secrets GitHub `TAX_QF_CRON_SECRET` et `TAX_QF_CRON_URL` pour le workflow.
3. **SharePoint** :
   - étiquette de sensibilité « Confidentiel – fiscal » sur le site ou la bibliothèque ;
   - partage externe limité aux invités existants, aucun lien anonyme ;
   - gestion des versions activée ;
   - rétention : brouillons abandonnés supprimés après 90 jours (`TAX_QF_CLEANUP_ENABLED=1`), prospects non acceptés 12 mois, mandats 10 ans après la fin (à aligner sur la politique d'Ark) ;
   - Lassana est déjà invité ; il doit accepter l'invitation pour ouvrir les liens.
4. **Mail.Send** est accordé sur crm-dev pour toutes les boîtes. Pour limiter l'envoi à info@ark-fid.ch :
   ```powershell
   Connect-ExchangeOnline
   New-DistributionGroup -Name "TaxQF Senders" -Type Security -Members info@ark-fid.ch
   New-ApplicationAccessPolicy -AppId <MSGRAPH_CLIENT_ID> -PolicyScopeGroupId "TaxQF Senders" -AccessRight RestrictAccess -Description "tax.ark-fid.ch: envoi depuis info@ uniquement"
   Test-ApplicationAccessPolicy -Identity info@ark-fid.ch -AppId <MSGRAPH_CLIENT_ID>
   ```
   Attention : la politique s'applique à **toute** l'application crm-dev. Si d'autres usages de crm-dev envoient des e-mails depuis d'autres boîtes, ajoutez-les au groupe, ou créez une application dédiée au questionnaire (Mail.Send + Sites.Selected) et renseignez `TAX_QF_GRAPH_*`.
   Application dédiée, droit Sites.Selected sur le seul site :
   ```http
   POST https://graph.microsoft.com/v1.0/sites/arkfiduciaire.sharepoint.com,c7215be6-6a04-45c1-b347-e91495451869,d7439d94-011e-4795-95d4-f64ac4363f1b/permissions
   { "roles": ["write"], "grantedToIdentities": [{ "application": { "id": "<APP_ID>", "displayName": "tax-questionnaire" } }] }
   ```
   (Elle a aussi besoin de lire et d'écrire la liste CRM : appliquez le même droit sur le site CRM.)
5. **Protection des données** :
   - DPIA d'une page ;
   - inscription au registre des traitements ;
   - note Ark–PBM (co-destinataire / responsable conjoint) ;
   - vérifier la notice de confidentialité (`ui.ts`, `PRIVACY_VERSION`). La durée de conservation y reste générale, à préciser selon la politique d'Ark.
6. **Nettoyage des tests** : les dossiers `TEST - …` sous `Questionnaires/2025` et leurs lignes dans « Suivi questionnaires », ainsi que le fichier de 0 octet `tax-qf-cors-probe.txt` à la racine des Documents du site CRM (sonde CORS). Ils sont à supprimer par le propriétaire ; l'agent n'a rien supprimé dans le tenant.

## Tests

- `npm run test:tax-qf` (Node 22) : 13 scénarios, service sur stockage simulé (codes, sessions, envoi, reprise après échec d'e-mail, route de régularisation, CRM), Excel et PDF, consignes « où le trouver », IA (fetch simulé), délais, campagne.
- De bout en bout en local : `TAX_QF_STORAGE=mock TAX_QF_SKIP_TURNSTILE=1 TAX_QF_TOKEN_SECRET=… npx next dev`. Les e-mails, dont les codes, sont écrits dans `$TAX_QF_MOCK_DIR/_outbox`. L'en-tête Host `tax.localhost` simule le sous-domaine.
- Le passage Turnstile demande un humain (les navigateurs automatisés ne le passent pas).

## Évolution prévue

Quand l'application Cadence d'Ark (`/home/sam/dev/cadence`), avec Odoo comme CRM, sera en service, la gestion des clients et le suivi des déclarations y seront probablement mieux placés que dans des listes SharePoint. SharePoint restera le stockage des documents.

- **Ce qui change** : il suffira d'écrire des adaptateurs Cadence/Odoo pour `ClientRegistry`, `ReturnTracker` et `PreferenceStore` (`server/ports.ts`). Le formulaire, l'Excel, le PDF, le service d'envoi et la campagne restent tels quels.
- **Données à migrer** :
  - identifiants et liens CRM des déclarations (CrmId, LinkCrm) ;
  - statuts et colonnes du personnel (Statut, Délai obtenu, PBM, Documents à demander) ;
  - délais ;
  - préférences et exclusions de campagne (liste « Préférences questionnaires ») ;
  - identifiants de ménage (HouseholdId) et clés client (ClientKey) ;
  - historique des événements (`_events/` de chaque dossier).

## Délais

Module : `src/lib/tax-questionnaire/deadlines.ts` (pur, testé par `deadlines.test.ts`).

- Table `CANTON_DEADLINES`, à revérifier chaque janvier (`verifiedOn`, `source`) :
  - **GE** : délai ordinaire 31 mars N+1 ; prolongation en ligne (déclaration 2025 : jusqu'au 30.10.2026). Source : https://www.ge.ch/document/42643/telecharger
  - **VD** : 15 mars N+1 ; tolérance au 30 juin, prolongation gratuite au 30 septembre. Source : https://www.vd.ch/e-delai
  - Autres cantons : pas de date (non vérifiée) ; le client voit « date indiquée sur votre déclaration ou sur le courrier de l'administration ».
- `deadlinesFor(answers, { extendedTo })` renvoie, selon les réponses :
  - `tou` — imposé(e) à la source : demande de TOU / rectification au plus tard le **31.03.N+1, non prolongeable** (priorité haute) ;
  - `reclamation` — avis de taxation déjà reçu : 30 jours dès la date indiquée (« à vérifier selon la date de notification effective ») ;
  - `extension` — délai obtenu saisi par le personnel (colonne « délai obtenu » de la liste, `ReturnRecord.extendedTo`), qui remplace le délai ordinaire ;
  - `ordinary` — délai du canton de domicile au 31.12 (note seule pour les non-résidents).
- `campaignStopDate(...)` : date de fin des relances = délai obtenu, sinon délai ordinaire du canton, sinon 31.03.N+1 ; 31.03.N+1 pour les personnes imposées à la source.

## Campagne annuelle

Logique : `src/lib/tax-questionnaire/server/campaign.ts` (`runCampaign`, testé par `campaign.test.ts`). Déclenchement : `.github/workflows/tax-qf-cron.yml`, tous les jours à 06:15 UTC, qui appelle `POST /api/tax-questionnaire/cron` (tâches `campaign` puis `cleanup`).

Public : la liste de Cadence quand `TAX_QF_CLIENTS_SOURCE=cadence` (sinon les clients du CRM « Clients » actifs, avec « Fiscal » dans Etendue et une adresse e-mail), moins les clients exclus (préférences), plus les prospects ayant coché « me rappeler chaque année ».

Règles (année N, déclaration N-1) :
1. **Préavis** (dès le 5 janvier) : une seule fois, aux clients qui n'ont jamais utilisé le questionnaire, avec un lien de désinscription ; mémorisé dans les préférences (`noticeSentYear`).
2. **Invitation** (dès le 1er février) : crée la déclaration N-1 (préremplie depuis la dernière déclaration envoyée s'il y en a une), lien personnel valable 14 jours.
3. **Relances** : 14 jours après l'invitation, puis à J-30 et J-10 avant le délai (`campaignStopDate`), jamais deux messages à moins de 3 jours d'intervalle.
4. **Arrêt** : questionnaire envoyé ou refusé, statut « Déposé » ou « Clos » dans la liste, client exclu, ou délai dépassé.
5. **Suivi interne** : un seul récapitulatif par jour aux collaborateurs (J-30, J-10, et 2 relances sans réponse) — sauf quand la liste vient de Cadence, qui le remplace.
6. Chaque message (fr/en/de selon la langue du client) contient un lien de désinscription ; aucune donnée personnelle dans les liens (jeton opaque).
7. Idempotence : décisions tirées des champs de la liste (`invitedAt`, `remindersSent`, `lastReminderAt`) ; la route garde en plus un registre des clés traitées dans SharePoint (`/_system/cron-ledger`, un fichier par clé date+tâche). Au plus 40 envois par exécution (le reste suit le lendemain).

Le préremplissage, les liens et la création de la déclaration invitée sont fournis par l'application (`createInvitedReturn`, `issueLink`) ; le nettoyage des brouillons abandonnés (`cleanup`) ne tourne que si `TAX_QF_CLEANUP_ENABLED=1`.

### Configuration

Variables du serveur (`.env` de production) :
- `TAX_QF_CRON_SECRET` — secret partagé, **au moins 32 caractères** (sinon la route refuse tout), p. ex. `openssl rand -hex 32`.
- `TAX_QF_STAFF_ALERT_TO` — destinataires du récapitulatif (défaut : samuel.halff@ark-fid.ch, sebastien.gallie@ark-fid.ch).
- `TAX_QF_PUBLIC_ORIGIN` — origine des liens (défaut : https://tax.ark-fid.ch).
- `TAX_QF_CLEANUP_ENABLED=1` — active la suppression des brouillons abandonnés (désactivée par défaut).

Secrets GitHub (Settings → Secrets and variables → Actions) :
- `TAX_QF_CRON_SECRET` — même valeur que sur le serveur ;
- `TAX_QF_CRON_URL` — facultatif (défaut : https://tax.ark-fid.ch/api/tax-questionnaire/cron).

### Tester sans rien envoyer

GitHub → Actions → « Tax questionnaire daily jobs » → Run workflow, avec `dryRun` coché (par défaut) : la route calcule et renvoie les compteurs (`notices`, `invitations`, `reminders`, `escalations`, `skipped`) sans envoyer ni écrire. En local :

```bash
curl -sS -X POST http://localhost:3000/api/tax-questionnaire/cron \
  -H "Content-Type: application/json" -H "x-tax-qf-cron: $TAX_QF_CRON_SECRET" \
  -d '{"task":"campaign","dryRun":true,"idempotencyKey":"test-dry-1"}'
```

### Renouvellement (client existant)

L'invitation de février reprend le dernier questionnaire envoyé (`previousAnswers`) : l'écran de départ est prérempli (le client confirme ses coordonnées et l'année) et l'écran de tri montre la situation reprise. Sur chaque écran de détail, chaque élément de l'an dernier (banque, employeur, bien, enfant, prêt, assurance, rente, société…) est une ligne compacte : « Toujours là » / « Terminé en {année} » (avec la date, dans l'année fiscale) / « Modifié » (ouvre la fiche). Le bouton « Tout est identique à {année} » confirme tout d'un clic et note « aucun nouvel élément » ; « Ajouter… » reste disponible pour les nouveaux éléments. La liste de documents suit : élément reconduit, modifié ou nouveau → document de l'année ; terminé dans l'année → document de l'année ou de clôture (relevé de clôture, attestation de remboursement…) ; bien vendu → documents de vente et point d'attention gains immobiliers. L'Excel et le PDF indiquent pour chaque élément : reconduit, nouveau, terminé le …, modifié. L'écran « documents de base » n'est pas montré (Ark a le dossier de l'an dernier).

### Invitation manuelle (staff)

GitHub → Actions → « Tax questionnaire manual invitation » (ou `scripts/tax-qf-invite.mjs` avec `TAX_QF_CRON_SECRET`) : même chemin que la campagne (dossier de l'année prérempli, lien, e-mail).

- `client` : la clé client (colonne « Clé client » du suivi) ; `email` : l'adresse à inviter si elle diffère.
- **Cas préparé par Ark** : déposer `_system/staff-prefill/<ref>.json` dans la bibliothèque des questionnaires (`{ identity: { email, firstName, lastName }, language, answers, notes }`) puis lancer avec `prefillRef=<ref>`. Les réponses sont marquées « pré-rempli par Ark — à vérifier » (`start.arkPrefilled`), les documents supplémentaires vont dans `start.arkDocs` ; les notes restent côté serveur (« Points d'attention (Ark).txt » dans le dossier) et rejoignent les points d'attention à l'envoi. Ces valeurs ne peuvent pas être modifiées par le navigateur.
- `noEmail` : aucun e-mail au client ; le lien est écrit dans `_system/staff-prefill/<ref>.result.json` (jamais dans les journaux) pour être transmis par le staff. À l'ouverture, le code part toujours à l'adresse du client.

### Colonnes du staff dans « Suivi questionnaires »

Statut (dont « À valider », « Documents manquants », « Dossier complet »), délai obtenu, PBM impliqué, documents à demander, responsable, note, préremplissage .tax disponible, et « Exclure de la campagne » (aucun avis, invitation ni rappel pour ce client).

Lignes de l'inventaire (Provenance « inventaire », sans dossier) : ce sont des clients à inviter, pas des déclarations. La campagne les invite une fois le statut passé de « À valider » à un autre statut et l'e-mail renseigné ; le dossier est alors créé sur la même ligne.

### Documents manquants après l'envoi

La colonne « Documents manquants » liste ce qui manque (documents annoncés « plus tard », non reçus, et lignes ajoutées par le staff dans « Documents à demander », qui rejoignent la liste du client). Elle est recalculée à l'envoi, quand le client signale des ajouts depuis sa page de suivi, et chaque jour par la tâche planifiée. Le statut passe de lui-même à « Documents manquants » puis « Dossier complet » (un statut choisi par le staff n'est jamais remplacé). Rappel au client 7 jours après l'envoi puis tous les 14 jours, jusqu'à : plus rien de manquant, statut « Dossier complet », « Déposé » ou « Clos », échéance passée, désinscription ou exclusion. Résumé au staff après deux rappels sans réponse et à J-30 / J-10. À chaque ajout signalé : e-mail interne (reçus / encore manquants, lien du dossier) et nouveau fichier « Suivi documents <date>.xlsx » dans le dossier.

## API bureau (Cadence)

Cadence suit les déclarations depuis ses écrans ; le site reste le seul expéditeur des e-mails fiscaux. Requêtes signées comme celles du KYC (`METHOD\nPATH?QUERY\nTS\nNONCE\nsha256hex(BODY)`, en-têtes `x-kyc-key-id`, `x-kyc-timestamp`, `x-kyc-nonce`, `x-kyc-signature`, `Idempotency-Key` sur chaque POST), vérifiées avec les seules clés `TAX_QF_API_KEYS` : une clé KYC ne signe jamais une requête fiscale, ni l'inverse. Code : `src/lib/tax-questionnaire/server/staff.ts`, routes `app/api/tax-questionnaire/staff/returns/`.

- `POST /api/tax-questionnaire/staff/returns` — `{clientRef, spouseRef?, firstName, lastName, email, language, canton, taxYear, prefill?: {answers, notes}, sendInvitation}`. Trouve la déclaration de `(clientRef, année)` (ou dont il est le conjoint), puis de `(e-mail, année)` : une déclaration existante (campagne) est reprise (`adopted: true`) et reçoit le `clientRef`. Trouvée par une adresse partagée alors qu'elle porte déjà un autre `clientRef` : reprise seulement pour un couple (le `spouseRef` demandé est ce client, ou la ligne le nomme conjoint ; le demandeur devient `spouseRef`), sinon refus `client_ref_conflict`. Sinon elle est créée par le chemin de la campagne, l'identifiant de dossier dérivé de la clé d'idempotence (une reprise retrouve la même ; `replayed: true`), et l'invitation part si `sendInvitation`. Réponse 201 (200 reprise ou adoption) : résumé + `link: {url, expiresAt}` (lien `staff`). Refus : `client_excluded`, `client_ref_conflict`, `invalid_*`.
- `GET …/returns?cursor=&limit=` — fil : une ligne par (dossier, année), triée sur la date « Modifié » de SharePoint, lignes de plus de 10 s seulement, curseur inclusif (`>=` : la dernière ligne revient une fois ; Cadence applique de façon idempotente), lignes sans dossier (inventaire) sautées. `{items, nextCursor, more}`, au moins deux lignes par page.
- `GET …/returns/<caseId>?year=` — le résumé, `documents: [{key, code, label, status: received|later|na|missing, fileUrl?}]`, `answers` (seul endroit où les réponses sortent), `filledBy` (réponse → qui chez Ark l'a saisie) et `questions` : les questions que le client voit maintenant pour ces réponses, dans l'ordre du formulaire, en français — écrans visibles (sauf documents de base, documents et vérification), blocs visibles, sans les champs masqués (posés par l'application), ni `start.arkPrefilled` / `start.arkDocs`, ni `start.email`. Chacune `{id, kind: "field"|"group", step, stepTitle, label, type?, options?: [{value, label}] (options visibles seulement), required?: true, fields?: [{id, label, type, options?, required?}], maxRows?}`. Et `pages` (`?lang=fr|en|de`, français par défaut) : les réponses à lire, calculées par le formulaire à partir des réponses, jamais gardées par Cadence — onglets Situation / Revenus / Fortune / Déductions (`STAFF_PAGES`) → écrans visibles → questions visibles qui ont une réponse : `[{id, title, sections: [{id, title, items: [{kind: "field", id, label, value, valid} | {kind: "group", id, label, rows: [{title, fields}]}]}]}]` ; valeur telle que le formulaire l’affiche (libellés d’options, Oui/Non) ; réponses vides, écrans et onglets vides omis ; de l’écran « Qu’est-ce qui vous concerne », seules les cartes « Déductions et autres ».
- `POST …/returns/<caseId>` — `{action, …}` : `link` (par dossier ; révoque les liens `staff` seulement, `email` change l'adresse de toutes les années et révoque tout — une reprise après échec termine le changement, `send` envoie le lien ; une reprise émet un lien de plus sans rien révoquer ni envoyer) ; `remind {taxYear}` (invitation si jamais invité, documents manquants si envoyé, sinon rappel ; mêmes compteurs que la campagne ; refus `{sent: false, kind, reason}` : `too_soon` (moins de 3 jours, avec `nextAt`), `excluded` (client exclu ou désinscrit), `closed`, `nothing_missing`, `nothing_to_send` (dossier ouvert par le client sans invitation : la campagne ne relance que les invités) ; une reprise rend le `kind` envoyé) ; `exclude` / `include {taxYear}` (colonne « Exclure de la campagne » de la ligne) ; `deadline {taxYear, extendedTo: "AAAA-MM-JJ" | null}` ; `staffDocs {taxYear, staffDocs: string[]}` ; `attach {clientRef}` (toutes les années du dossier ; l'an suivant reprend `clientRef` et `spouseRef`) ; `assist {taxYear, by, ttlMinutes?}` (accès bureau « Code cabinet ») ; `prefill {taxYear, by, answers: {<id>: valeur}}` — Cadence remplit le questionnaire comme une session bureau : les réponses changées sont marquées « rempli par Ark » (`filledBy` = `by`). `by` obligatoire (≤ 120, sinon `invalid_by`) ; refus comme `assist` : `not_found` 404, `case_closed` 409, `already_submitted` 409, et `not_started` 409 (questionnaire jamais ouvert : pas de brouillon). `answers` : 1 à 200 clés, chacune un id de question (champ ou groupe) que Cadence peut remplir (pas masquée, pas `start.arkPrefilled` / `start.arkDocs` / `start.email`) ; un champ est vérifié par le validateur du formulaire et jamais vide (`prefill` écrit, n'efface pas) ; un groupe reçoit la liste entière des lignes `[{_id?, <champ>: valeur}]` (champs visibles du groupe, au plus `maxRows`) : un `_id` d'une ligne enregistrée la garde (avec ses champs masqués : reprise de l'an passé, statut), sinon nouvelle ligne. Une commune saisie ainsi est en texte libre (le n° OFS d'une autre commune est retiré). Tout ou rien : 400 `{error: "invalid_answers", fields: [{id, error}]}` (`unknown`, `not_allowed`, `empty`, `invalid_rows`, `too_many_rows`, ou le code du validateur ; une ligne : `<groupe>[<index>].<champ>`). Une question masquée par une autre réponse n'est pas refusée. Réponse : résumé + `prefill: {written: [ids changés], unchanged: [ids déjà à cette valeur], hidden: [ids écrits que le client ne voit pas maintenant]}`. Une reprise (même clé, même contenu) n'écrit rien : `{written: [], unchanged: [tous les ids], hidden: []}`, `replayed: true`.
- Résumé : `{caseId, taxYear, clientRef?, spouseRef?, householdId, name, email, emailVerified, language, canton, state, submittedAt?, invitedAt?, remindersSent, lastReminderAt?, missingRemindersSent, lastMissingReminderAt?, docsReceived, docsExpected, folderUrl, excelUrl?, pdfUrl?, excluded, extendedTo?, staffDocs, updatedAt}` — jamais de réponses.
- Colonnes ajoutées à « Suivi questionnaires » (créées d'elles-mêmes) : « Client Cadence », « Conjoint Cadence », « Clé de création (Cadence) ». Ajoutées au premier accès ; un échec (ou un 409 d'une requête concurrente) ne fait jamais échouer l'appel et la migration est retentée à l'accès suivant. Les reprises d'actions sont notées dans `_system/cron-ledger`.

## Assistance IA (désactivée par défaut)

Trois fonctions sont prêtes dans le code mais **inactives** tant que la porte ci-dessous n'est pas franchie :

| Fonction | Route | Ce qu'elle fait | Garde-fous |
|---|---|---|---|
| Aide « ? » par question | `POST /api/tax-questionnaire/ai/help` | Explique la question et le document qui y répond | Contexte = libellé/aide/options du schéma uniquement ; refuse les questions sur le cas du client ; aucun chiffre ni seuil ; phrase finale fixe ajoutée par le serveur (« Ark vérifiera dans votre dossier. ») ; jamais sur l'écran Régularisation |
| Suggestions de cartes | `POST /api/tax-questionnaire/ai/suggest` | Texte libre → cartes du routeur **suggérées** avec la raison | Liste blanche côté serveur ; jamais « régularisation » ni forfait / impôt à la source (questions de régime) ; le client confirme chaque carte |
| Lecture de la dernière déclaration | `POST /api/tax-questionnaire/ai/extract` | Avis / déclaration déposé → n° de contribuable, commune, ménage, noms d'employeurs, banques, assureurs, prêteurs, biens, déductions utilisées | Sortie JSON stricte, chaînes nettoyées et tronquées ; aucun montant, n° AVS ni n° de compte ; le document est traité comme une donnée (instructions ignorées) ; pré-remplissage à confirmer |

Appels **sans état** (chat completions, pas d'agent ni de fil conservé), température 0, sans outils, sortie `json_schema` stricte, délai 30 s, contenu jamais journalisé. Chaque route exige : drapeau actif, origine autorisée, session valide, limite par IP, et le **consentement IA séparé** du client (`aiOptIn: true` ou `review.aiOptIn = "yes"`). Sans consentement, le questionnaire fonctionne à l'identique.

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `TAX_QF_AI_ENABLED` | `1` pour activer ; toute autre valeur = désactivé (routes en 404 `ai_disabled`) |
| `TAX_QF_AI_ENDPOINT` | `https://<ressource>.openai.azure.com` |
| `TAX_QF_AI_DEPLOYMENT` | Nom du déploiement (modèle compatible entrées PDF/image et `json_schema`) |
| `TAX_QF_AI_API_KEY` | Clé de la ressource |
| `TAX_QF_AI_API_VERSION` | Facultatif, défaut `2024-10-21` (une version plus récente peut être nécessaire pour l'entrée PDF `type: "file"`) |

### Porte à franchir avant `TAX_QF_AI_ENABLED=1` (propriétaire / admin)

1. **Région et type de déploiement** : déploiement **Standard régional en Switzerland North** (ou Data Zone UE seulement après revue juridique). **Jamais Global Standard** (les requêtes peuvent être traitées hors Suisse/UE). Vérifier le SKU du déploiement choisi sur la ressource PBM `pbmch8303697696` (ressource en Switzerland North ; SKU par déploiement non vérifié à ce jour) :
   `az cognitiveservices account deployment list -g <rg> -n pbmch8303697696 --query "[].{name:name, sku:sku.name, model:properties.model.name}" -o table` → `sku` doit valoir `Standard`.
2. **Surveillance des abus modifiée** : demander l'exemption (Limited Access, formulaire Microsoft « modified abuse monitoring ») pour que les prompts ne soient ni stockés ni relus par des humains ; attendre l'approbation.
3. **Note de traitement Ark–PBM** : la ressource est dans le tenant PBM ; signer une note de sous-traitance / co-responsabilité (nLPD art. 9) avant tout envoi de données client.
4. **Notice de confidentialité** : mentionner Microsoft (Azure OpenAI) comme sous-traitant pour les clients qui cochent l'option IA (texte `AI_DISCLOSURE`).
5. **Tests** : vérifier sur un dossier TEST l'aide, les suggestions et l'extraction (PDF et photo) ; relire 10 réponses d'aide pour s'assurer qu'aucune ne donne de conseil ni de chiffre.

Puis définir les variables ci-dessus sur l'hébergement et redémarrer. Pour couper : `TAX_QF_AI_ENABLED=0` (effet immédiat au redémarrage).

## Limites connues (acceptées, à revoir si l'hébergement change)

- **Mémoire du processus** : compteurs d'essais des codes, limites par IP et verrou d'envoi. Ils supposent une seule instance Node, comme sur Infomaniak. Un redémarrage remet ces compteurs à zéro ; un code reste de toute façon valable 10 minutes au plus et sert une seule fois par processus.
- **Envoi** :
  - Les e-mails internes et client sont marqués « envoyés » dans `etat.json` de la version, donc une reprise ne les renvoie pas.
  - Si la confirmation client échoue, l'envoi est quand même clôturé : le client voit la confirmation à l'écran, l'équipe a reçu l'e-mail interne.
- **Fichiers ajoutés après un envoi** (« corriger mes réponses ») : ils ne peuvent plus être supprimés par le client ; le bouton est masqué. Les fichiers douteux vont dans `_A verifier`.
- **Volume total** : il est contrôlé à la création des sessions d'upload, puis à l'envoi. Un dépassement par sessions simultanées est signalé dans l'Excel, pas bloqué.
- **Campagne** :
  - Pour les cantons dont le délai n'est pas vérifié (hors GE et VD), les rappels s'arrêtent par défaut au 31 mars. Renseigner « Délai obtenu jusqu'au » pour prolonger.
  - Un départ en cours d'année n'avance pas l'arrêt des rappels.
  - La course entre deux exécutions simultanées du cron n'est pas couverte (une seule exécution par jour).
  - Les noms des invitations de campagne sont découpés selon la convention du CRM (« NOM Prénom », mots en majuscules = nom). Les noms entièrement en majuscules doivent être vérifiés.
- **Journal** : un fichier par événement (`_events/`), plutôt qu'un seul `events.jsonl`, pour éviter les écritures concurrentes sur un même fichier SharePoint. Les journaux du serveur contiennent l'identifiant opaque du dossier, jamais de nom, d'e-mail ni de réponse.
- **Tests** : `npm run test:tax-qf` exige Node 22 (exécution TypeScript native), comme `test:unit`. La compilation (`npm run build`) se fait avec Node 20.
