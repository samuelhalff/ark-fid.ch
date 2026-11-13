/**
 * Where a case's files go on LBA - OAR. Cadence owns the layout (`app/kyc/layout.py`): a client's
 * readable documents are in `<Client>/<YYYY>/Pièces/` and the app's data in
 * `<Client>/Données techniques/`, the year being the case's. The site builds no path: when Cadence
 * creates a case it sends the ids of those two folders (`piecesFolder`, `technicalFolder`), and
 * the case keeps them. What this file decides is only how one case's files are told apart inside
 * those two shared folders: by name, never by a folder of its own.
 *
 * A case created without the two folders (every case before the layout, or one sent while
 * SharePoint did not answer Cadence) keeps its own `KYC <id>/Révision <n>/` folders, read and
 * written exactly as before.
 */

export interface CaseFolders {
  piecesFolderId: string;
  technicalFolderId: string;
}

/** The case's state file: `case.json` in its own folder, or one named for it among the shared data. */
export const caseFileName = (caseId: string, shared: boolean) => (shared ? `KYC ${caseId} - case.json` : "case.json");

/** A revision's data file (`draft.json`, `questionnaire.json`…): the same name, told apart by case and revision when shared. */
export const dataFileName = (caseId: string, revision: number, base: string, shared: boolean) => (shared ? `KYC ${caseId} R${revision} - ${base}` : base);

const tag = (caseId: string, revision: number) => `(${caseId} R${revision})`;

/** A readable file of a revision in the shared `Pièces/`: its name ends with the case and revision, before the extension. */
export const pieceFileName = (stem: string, ext: string, caseId: string, revision: number) => `${stem} ${tag(caseId, revision)}.${ext}`;

/**
 * Whether a file of the shared `Pièces/` is this revision's. The tag is the end of the name (SharePoint may
 * add " 1" after it when a name is taken), so a client's own file name can never pass for another case's.
 */
export const isOwnPiece = (name: string, caseId: string, revision: number) =>
  new RegExp(`\\(${caseId} R${revision}\\)( \\d+)?\\.[^.]+$`).test(name);

/** The names of the files this form writes into `Pièces/`, by kind. */
export const SIGNED_SCAN_PREFIX = "Formulaire signé ";
export const ONLINE_SIGNED_MARK = " - signé en ligne";
