/** Interface texts of the questionnaire (fr/en/de). Pure module. */
import { t, type L } from "./types";
import type { FieldError } from "./logic";

export const CONTACT = {
  name: "Ark Fiduciaire SA",
  phone: "+41 22 512 50 50",
  phoneHref: "tel:+41225125050",
  email: "info@ark-fid.ch",
} as const;

/** Bump when the privacy notice text changes (recorded with each submission). */
export const PRIVACY_VERSION = "2026-10";

export const UI = {
  pageTitle: t("Questionnaire fiscal", "Tax questionnaire", "Steuerfragebogen"),
  pageIntro: t(
    "Répondez aux questions qui vous concernent et déposez vos documents. Nous recevons le tout de façon sécurisée pour préparer votre déclaration d'impôt.",
    "Answer the questions that apply to you and upload your documents. We receive everything securely to prepare your tax return.",
    "Beantworten Sie die Fragen, die Sie betreffen, und laden Sie Ihre Dokumente hoch. Wir erhalten alles sicher, um Ihre Steuererklärung vorzubereiten.",
  ),
  stepOf: t("Étape {n} sur {total}", "Step {n} of {total}", "Schritt {n} von {total}"),
  back: t("Retour", "Back", "Zurück"),
  next: t("Continuer", "Continue", "Weiter"),
  edit: t("Modifier", "Edit", "Bearbeiten"),
  add: t("Ajouter", "Add", "Hinzufügen"),
  remove: t("Supprimer", "Remove", "Entfernen"),
  optional: t("facultatif", "optional", "freiwillig"),
  yes: t("Oui", "Yes", "Ja"),
  no: t("Non", "No", "Nein"),
  choose: t("Choisir…", "Choose…", "Auswählen…"),
  datePlaceholder: t("jj.mm.aaaa", "dd.mm.yyyy", "tt.mm.jjjj"),
  errorSummary: t("Merci de corriger les points signalés.", "Please correct the highlighted fields.", "Bitte korrigieren Sie die markierten Felder."),
  noRows: t("Aucune entrée pour l'instant.", "No entries yet.", "Noch keine Einträge."),
  draftTitle: t("Brouillon enregistré sur cet appareil", "Draft saved on this device", "Entwurf auf diesem Gerät gespeichert"),
  draftText: t(
    "Vos réponses sont gardées dans ce navigateur pour que vous puissiez reprendre plus tard (jamais vos fichiers). Sur un ordinateur partagé, effacez le brouillon en partant. Il est effacé automatiquement après l'envoi ou après 30 jours.",
    "Your answers are kept in this browser so you can come back later (never your files). On a shared computer, delete the draft when you leave. It is deleted automatically after you submit or after 30 days.",
    "Ihre Antworten werden in diesem Browser gespeichert, damit Sie später weitermachen können (nie Ihre Dateien). Löschen Sie den Entwurf auf einem gemeinsam genutzten Computer. Er wird nach dem Absenden oder nach 30 Tagen automatisch gelöscht.",
  ),
  draftDelete: t("Effacer mon brouillon", "Delete my draft", "Entwurf löschen"),
  draftDeleteConfirm: t("Effacer toutes vos réponses de cet appareil ?", "Delete all your answers from this device?", "Alle Antworten von diesem Gerät löschen?"),
  draftRestored: t("Nous avons repris vos réponses enregistrées.", "We restored your saved answers.", "Ihre gespeicherten Antworten wurden wiederhergestellt."),
  // documents step
  docsTitle: t("Vos documents", "Your documents", "Ihre Dokumente"),
  docsIntro: t(
    "Voici la liste établie d'après vos réponses. Pour chaque document, déposez le fichier, ou indiquez que vous l'enverrez plus tard ou qu'il ne vous concerne pas. Formats acceptés : PDF, JPG, PNG, HEIC, Excel, Word, CSV, TXT (50 Mo max. par fichier).",
    "This list is based on your answers. For each document, upload the file, or say that you will send it later or that it does not apply. Accepted formats: PDF, JPG, PNG, HEIC, Excel, Word, CSV, TXT (max. 50 MB per file).",
    "Diese Liste beruht auf Ihren Antworten. Laden Sie pro Dokument die Datei hoch oder geben Sie an, dass Sie sie später senden oder dass sie nicht zutrifft. Formate: PDF, JPG, PNG, HEIC, Excel, Word, CSV, TXT (max. 50 MB pro Datei).",
  ),
  privacyAck: t(
    "J'ai lu la notice de confidentialité ci-dessous et j'accepte que mes réponses et documents soient transmis à Ark Fiduciaire SA.",
    "I have read the privacy notice below and agree that my answers and documents are sent to Ark Fiduciaire SA.",
    "Ich habe den Datenschutzhinweis unten gelesen und bin einverstanden, dass meine Antworten und Dokumente an Ark Fiduciaire SA übermittelt werden.",
  ),
  startUploads: t("Activer le dépôt de documents", "Enable document upload", "Dokument-Upload aktivieren"),
  verifying: t("Vérification en cours…", "Verifying…", "Überprüfung läuft…"),
  humanCheck: t("Une courte vérification anti-robot est nécessaire avant le dépôt de fichiers.", "A short anti-robot check is needed before uploading files.", "Vor dem Hochladen ist eine kurze Anti-Roboter-Prüfung nötig."),
  upload: t("Déposer un fichier", "Upload a file", "Datei hochladen"),
  uploading: t("Envoi… {pct} %", "Uploading… {pct}%", "Wird hochgeladen… {pct} %"),
  cancel: t("Annuler", "Cancel", "Abbrechen"),
  later: t("Je l'enverrai plus tard", "I'll send it later", "Ich sende es später"),
  na: t("Ne me concerne pas", "Does not apply", "Trifft nicht zu"),
  received: t("Reçu", "Received", "Erhalten"),
  extraTitle: t("Autres documents", "Other documents", "Weitere Dokumente"),
  extraIntro: t("Tout autre document utile (courriers de l'administration, justificatifs divers).", "Any other useful document (letters from the tax authority, other receipts).", "Alle weiteren nützlichen Dokumente (Schreiben der Steuerverwaltung, sonstige Belege)."),
  docsMissingStatus: t("Indiquez un fichier ou un statut pour chaque document.", "Give a file or a status for each document.", "Geben Sie für jedes Dokument eine Datei oder einen Status an."),
  uploadsBusy: t("Des fichiers sont encore en cours d'envoi.", "Files are still uploading.", "Es werden noch Dateien hochgeladen."),
  // review
  reviewTitle: t("Vérification et envoi", "Review and submit", "Prüfen und absenden"),
  reviewIntro: t("Relisez vos réponses avant l'envoi.", "Check your answers before submitting.", "Prüfen Sie Ihre Antworten vor dem Absenden."),
  certify: t(
    "Je certifie que les informations données sont exactes et complètes, pour moi et, le cas échéant, mon conjoint ou partenaire, qui en a pris connaissance.",
    "I certify that the information given is true and complete, for myself and, where applicable, my spouse or partner, who has seen it.",
    "Ich bestätige, dass die Angaben für mich und gegebenenfalls meinen Ehegatten oder meine Partnerin / meinen Partner, der/die davon Kenntnis hat, richtig und vollständig sind.",
  ),
  submit: t("Envoyer à Ark Fiduciaire", "Send to Ark Fiduciaire", "An Ark Fiduciaire senden"),
  submitting: t("Envoi en cours…", "Sending…", "Wird gesendet…"),
  doneTitle: t("Merci, c'est envoyé", "Thank you, it's sent", "Vielen Dank, gesendet"),
  doneText: t(
    "Nous avons bien reçu votre questionnaire et vos documents. Une confirmation vous est envoyée par e-mail. Nous revenons vers vous rapidement.",
    "We have received your questionnaire and documents. A confirmation is on its way by email. We will get back to you shortly.",
    "Wir haben Ihren Fragebogen und Ihre Dokumente erhalten. Eine Bestätigung erhalten Sie per E-Mail. Wir melden uns in Kürze.",
  ),
  donePending: t("Documents encore attendus (à nous envoyer en répondant à l'e-mail de confirmation) :", "Documents still expected (send them by replying to the confirmation email):", "Noch ausstehende Dokumente (als Antwort auf die Bestätigungs-E-Mail senden):"),
  helpTitle: t("Besoin d'aide ?", "Need help?", "Brauchen Sie Hilfe?"),
  privacyTitle: t("Confidentialité", "Privacy", "Datenschutz"),
  privacyText: t(
    "Vos réponses et documents sont transmis à Ark Fiduciaire SA (responsable du traitement) et conservés dans son espace Microsoft 365 à accès restreint, pour préparer votre déclaration d'impôt et le devis correspondant. Ils sont consultés par les collaborateurs chargés de votre dossier, y compris ceux de notre partenaire PBM Avocats qui y participent. Ils sont conservés pendant la durée du mandat, puis selon les obligations légales de conservation ; les dossiers non envoyés sont supprimés. Votre brouillon reste dans votre navigateur jusqu'à l'envoi. Vous pouvez demander l'accès, la rectification ou l'effacement de vos données (loi fédérale sur la protection des données) à info@ark-fid.ch.",
    "Your answers and documents are sent to Ark Fiduciaire SA (controller) and stored in its restricted Microsoft 365 workspace, to prepare your tax return and the related quote. They are seen by the staff handling your file, including those of our partner firm PBM Avocats who take part in it. They are kept for the duration of the engagement and then as required by legal retention obligations; files that are never submitted are deleted. Your draft stays in your browser until you submit. You may request access, correction or deletion of your data (Swiss Federal Act on Data Protection) at info@ark-fid.ch.",
    "Ihre Antworten und Dokumente werden an Ark Fiduciaire SA (Verantwortliche) übermittelt und in deren zugangsbeschränkter Microsoft-365-Umgebung gespeichert, um Ihre Steuererklärung und die zugehörige Offerte vorzubereiten. Einsicht haben die mit Ihrem Dossier betrauten Mitarbeitenden, einschliesslich jener unserer Partnerkanzlei PBM Avocats, die daran mitwirken. Sie werden für die Dauer des Mandats und danach gemäss den gesetzlichen Aufbewahrungspflichten aufbewahrt; nie abgesendete Dossiers werden gelöscht. Ihr Entwurf bleibt bis zum Absenden in Ihrem Browser. Auskunft, Berichtigung oder Löschung Ihrer Daten (Datenschutzgesetz) können Sie unter info@ark-fid.ch verlangen.",
  ),
  privacyLink: t("Politique de confidentialité", "Privacy policy", "Datenschutzerklärung"),
  networkError: t("Problème de connexion. Réessayez.", "Connection problem. Please try again.", "Verbindungsproblem. Bitte erneut versuchen.") as L,
} as const;

export const SERVER_ERRORS: Record<string, L> = {
  rate_limited: t("Trop de tentatives. Réessayez dans quelques minutes.", "Too many attempts. Try again in a few minutes.", "Zu viele Versuche. Bitte in einigen Minuten erneut versuchen."),
  turnstile_failed: t("La vérification anti-robot a échoué. Réessayez.", "The anti-robot check failed. Please try again.", "Die Anti-Roboter-Prüfung ist fehlgeschlagen. Bitte erneut versuchen."),
  session_expired: t("Votre session de dépôt a expiré. Réactivez le dépôt de documents.", "Your upload session expired. Enable document upload again.", "Ihre Upload-Sitzung ist abgelaufen. Aktivieren Sie den Upload erneut."),
  already_submitted: t("Ce questionnaire a déjà été envoyé.", "This questionnaire has already been sent.", "Dieser Fragebogen wurde bereits gesendet."),
  file_type: t("Format de fichier non accepté.", "File type not accepted.", "Dateiformat nicht akzeptiert."),
  file_size: t("Fichier trop volumineux (50 Mo max.).", "File too large (max. 50 MB).", "Datei zu gross (max. 50 MB)."),
  file_empty: t("Le fichier est vide.", "The file is empty.", "Die Datei ist leer."),
  too_many_files: t("Nombre ou volume maximal de fichiers atteint.", "Maximum number or size of files reached.", "Maximale Anzahl oder Grösse der Dateien erreicht."),
  invalid_answers: t("Certaines réponses sont incomplètes. Vérifiez les étapes signalées.", "Some answers are incomplete. Check the flagged steps.", "Einige Antworten sind unvollständig. Prüfen Sie die markierten Schritte."),
  notify_failed: t(
    "Vos réponses et documents sont enregistrés, mais la confirmation n'a pas pu partir. Réessayez dans un instant ou appelez-nous.",
    "Your answers and documents are saved, but the confirmation could not be sent. Try again in a moment or call us.",
    "Ihre Antworten und Dokumente sind gespeichert, die Bestätigung konnte aber nicht gesendet werden. Versuchen Sie es gleich nochmals oder rufen Sie uns an.",
  ),
  generic: t("Une erreur est survenue. Réessayez ou contactez-nous.", "Something went wrong. Try again or contact us.", "Ein Fehler ist aufgetreten. Bitte erneut versuchen oder uns kontaktieren."),
};

export const FIELD_ERRORS: Record<FieldError, L> = {
  required: t("Champ obligatoire.", "Required.", "Pflichtfeld."),
  invalid_email: t("Adresse e-mail invalide.", "Invalid email address.", "Ungültige E-Mail-Adresse."),
  invalid_date: t("Date invalide (jj.mm.aaaa).", "Invalid date (dd.mm.yyyy).", "Ungültiges Datum (tt.mm.jjjj)."),
  invalid_amount: t("Montant invalide (ex. 1'234.50).", "Invalid amount (e.g. 1'234.50).", "Ungültiger Betrag (z. B. 1'234.50)."),
  invalid_number: t("Nombre entier attendu.", "Whole number expected.", "Ganze Zahl erwartet."),
  invalid_percent: t("Pourcentage entre 0 et 100.", "Percentage between 0 and 100.", "Prozentsatz zwischen 0 und 100."),
  invalid_phone: t("Numéro de téléphone invalide.", "Invalid phone number.", "Ungültige Telefonnummer."),
  invalid_option: t("Choix invalide.", "Invalid choice.", "Ungültige Auswahl."),
  too_long: t("Texte trop long.", "Text too long.", "Text zu lang."),
  min_rows: t("Ajoutez au moins une entrée.", "Add at least one entry.", "Fügen Sie mindestens einen Eintrag hinzu."),
};
