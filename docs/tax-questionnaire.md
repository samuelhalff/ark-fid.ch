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
- Si l'e-mail interne échoue, l'envoi reste enregistré et peut être relancé : la même version est réutilisée et rien n'est dupliqué.
- L'Excel liste chaque fichier par document. Il se suffit donc à lui-même pour les destinataires hors du tenant.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `TAX_QF_TOKEN_SECRET` | **obligatoire**, 32 caractères au moins (HMAC des liens, codes et sessions). Sans elle, tout échoue en mode fermé. |
| `MSGRAPH_TENANT_ID` / `MSGRAPH_CLIENT_ID` / `MSGRAPH_CLIENT_SECRET` | application Graph existante (crm-dev). Une application dédiée peut la remplacer via `TAX_QF_GRAPH_*`. |
| `TAX_QF_SP_DRIVE_ID`, `TAX_QF_SP_SITE_ID`, `TAX_QF_SP_ROOT_FOLDER` | valeurs par défaut : le site « Questionnaires fiscaux », la bibliothèque Documents et le dossier `Questionnaires`. |
| `TAX_QF_CRM_SITE_ID`, `TAX_QF_CRM_LIST_ID` | valeurs par défaut : liste CRM « Clients ». |
| `TAX_QF_MAIL_SENDER`, `TAX_QF_MAIL_TO`, `TAX_QF_MAIL_CC` | valeurs par défaut : info@, Samuel, Sébastien + Lassana. `none` donne une liste vide. |
| `TAX_QF_PUBLIC_ORIGIN` | origine des liens envoyés par e-mail. |
| `TAX_QF_ALLOWED_ORIGINS` | origines supplémentaires (préproduction). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | déjà utilisées par le site. |
| `TAX_QF_CRON_SECRET`, `TAX_QF_STAFF_ALERT_TO`, `TAX_QF_CLEANUP_ENABLED` | campagne annuelle et nettoyage (voir plus bas). |
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

Public : clients du CRM « Clients » actifs, avec « Fiscal » dans Etendue et une adresse e-mail, moins les clients exclus (préférences), plus les prospects ayant coché « me rappeler chaque année ».

Règles (année N, déclaration N-1) :
1. **Préavis** (dès le 5 janvier) : une seule fois, aux clients qui n'ont jamais utilisé le questionnaire, avec un lien de désinscription ; mémorisé dans les préférences (`noticeSentYear`).
2. **Invitation** (dès le 1er février) : crée la déclaration N-1 (préremplie depuis la dernière déclaration envoyée s'il y en a une), lien personnel valable 14 jours.
3. **Relances** : 14 jours après l'invitation, puis à J-30 et J-10 avant le délai (`campaignStopDate`), jamais deux messages à moins de 3 jours d'intervalle.
4. **Arrêt** : questionnaire envoyé ou refusé, statut « Déposé » ou « Clos » dans la liste, client exclu, ou délai dépassé.
5. **Suivi interne** : un seul récapitulatif par jour aux collaborateurs (J-30, J-10, et 2 relances sans réponse).
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
