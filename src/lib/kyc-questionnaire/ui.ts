/** Interface texts of the KYC questionnaire (fr/en). French is the reference. Pure module. */
import type { FieldError } from "./engine";
import { t, type L } from "./types";

export const CONTACT = {
  name: "Ark Fiduciaire SA",
  phone: "+41 22 512 50 50",
  phoneHref: "tel:+41225125050",
  email: "info@ark-fid.ch",
} as const;

export const UI = {
  pageTitle: t("Formulaire KYC", "KYC form"),
  pageIntro: t(
    "Vérifiez les informations pré-remplies par Ark, complétez le formulaire et joignez les documents demandés. Vous signerez ensuite le formulaire généré.",
    "Check the information pre-filled by Ark, complete the form and attach the requested documents. You will then sign the generated form.",
  ),
  eyebrow: t("Ark Fiduciaire · KYC", "Ark Fiduciaire · KYC"),
  language: t("Langue", "Language"),
  stepOf: t("Étape {n} sur {total}", "Step {n} of {total}"),
  section: t("Section {letter}", "Section {letter}"),
  back: t("Retour", "Back"),
  next: t("Continuer", "Continue"),
  edit: t("Modifier", "Edit"),
  remove: t("Supprimer", "Remove"),
  carried: t("Transmis lors d'une version précédente", "Provided with an earlier version"),
  addRow: t("Ajouter : {item}", "Add: {item}"),
  addAnother: t("Ajouter une autre entrée : {item}", "Add another: {item}"),
  noRows: t("Aucune entrée pour l'instant.", "No entries yet."),
  optional: t("facultatif", "optional"),
  yes: t("Oui", "Yes"),
  no: t("Non", "No"),
  choose: t("Choisir…", "Choose…"),
  datePlaceholder: t("jj.mm.aaaa", "dd.mm.yyyy"),
  errorSummary: t("Merci de corriger les points signalés.", "Please correct the highlighted fields."),
  prefilled: t("Pré-rempli par Ark — à vérifier", "Pre-filled by Ark — please check"),
  prefilledStep: t(
    "Ark a pré-rempli certaines réponses de cet écran. Vérifiez chacune d'elles et corrigez-les si nécessaire.",
    "Ark pre-filled some answers on this screen. Please check each of them and correct them if needed.",
  ),

  // access
  linkOpening: t("Ouverture de votre formulaire…", "Opening your form…"),
  noLinkTitle: t("Ouvrez le lien reçu d'Ark", "Open the link you received from Ark"),
  noLinkText: t(
    "Pour accéder à votre formulaire, ouvrez le lien personnel qu'Ark Fiduciaire vous a envoyé par e-mail.",
    "To access your form, open the personal link Ark Fiduciaire sent you by e-mail.",
  ),
  expiredText: t(
    "Votre session a expiré. Ouvrez à nouveau le lien personnel reçu par e-mail : vos réponses enregistrées sont conservées.",
    "Your session has expired. Open the personal link you received by e-mail again: your saved answers are kept.",
  ),
  loggedOut: t(
    "Vous êtes déconnecté. Vos réponses sont enregistrées : rouvrez le lien reçu par e-mail pour continuer.",
    "You are signed out. Your answers are saved: open the link you received by e-mail again to continue.",
  ),
  codeTitle: t("Vérifiez votre e-mail", "Check your e-mail"),
  codeText: t("Nous avons envoyé un code à 6 chiffres à {email}. Il est valable 10 minutes.", "We sent a 6-digit code to {email}. It is valid for 10 minutes."),
  codeLabel: t("Code reçu par e-mail", "Code received by e-mail"),
  verify: t("Valider", "Confirm"),
  resendCode: t("Renvoyer un code", "Send a new code"),
  codeResent: t("Un nouveau code vous a été envoyé.", "A new code has been sent to you."),
  logout: t("Se déconnecter", "Sign out"),

  // autosave
  saving: t("Enregistrement…", "Saving…"),
  savedAt: t("Enregistré à {time}", "Saved at {time}"),
  saveFailed: t("Enregistrement impossible pour l'instant", "Could not save for now"),
  draftStored: t(
    "Vos réponses sont enregistrées au fur et à mesure chez Ark Fiduciaire. Vous pouvez vous arrêter et reprendre plus tard avec le même lien.",
    "Your answers are saved as you go at Ark Fiduciaire. You can stop and come back later with the same link.",
  ),

  // documents
  docsMissing: t("Joignez ce document ou indiquez que vous l'envoyez séparément.", "Attach this document or say that you will send it separately."),
  later: t("Je l'envoie séparément", "I will send it separately"),
  na: t("Sans objet", "Not applicable"),
  received: t("Reçu", "Received"),
  chooseFiles: t("Choisir des fichiers", "Choose files"),
  addFiles: t("Ajouter des fichiers", "Add files"),
  uploading: t("Envoi… {pct} %", "Uploading… {pct}%"),
  cancel: t("Annuler", "Cancel"),
  uploadsBusy: t("Des fichiers sont encore en cours d'envoi.", "Files are still uploading."),
  docsDone: t("{done} sur {total} documents traités", "{done} of {total} documents handled"),

  // review
  reviewIntro: t("Relisez vos réponses avant l'envoi. Vous pouvez revenir à chaque écran pour corriger.", "Check your answers before sending. You can go back to each screen to correct them."),
  reviewDocs: t("Documents", "Documents"),
  docUploadedOne: t("Joint (1 fichier)", "Attached (1 file)"),
  docUploadedMany: t("Joint ({n} fichiers)", "Attached ({n} files)"),
  docLater: t("Envoyé séparément", "Sent separately"),
  docNa: t("Sans objet", "Not applicable"),
  docMissing: t("Manquant", "Missing"),
  docOptionalNone: t("Aucun", "None"),
  mismatchNote: t(
    "Certaines de vos réponses demandent un examen par Ark. Ark vérifiera vos réponses avant que quoi que ce soit ne soit signé.",
    "Some of your answers need to be looked at by Ark. Ark will review your answers before anything is signed.",
  ),
  submit: t("Envoyer le formulaire", "Send the form"),
  submitForReview: t("Envoyer à Ark pour vérification", "Send to Ark for review"),
  submitting: t("Envoi en cours…", "Sending…"),
  filesRejected: t("Ces fichiers ont été refusés et supprimés, joignez-les à nouveau (PDF, image ou document lisible) :", "These files were rejected and removed, please attach them again (PDF, image or readable document):"),

  // after submission
  signTitle: t("Signature du formulaire", "Signing the form"),
  signIntro: t("Merci, vos réponses sont enregistrées. Il reste à signer le formulaire.", "Thank you, your answers are saved. The form now needs to be signed."),
  reference: t("Référence : {ref}", "Reference: {ref}"),
  signStep1: t("Téléchargez le formulaire à signer (PDF).", "Download the form to sign (PDF)."),
  downloadPdf: t("Télécharger le PDF", "Download the PDF"),
  signStep2: t("Imprimez-le, vérifiez-le, datez-le et signez-le.", "Print it, check it, date it and sign it."),
  signStep2Pm: t("Imprimez-le, vérifiez-le, datez-le et faites-le signer par chaque signataire indiqué :", "Print it, check it, date it and have it signed by each signatory listed:"),
  signStep3: t(
    "Téléversez le formulaire signé : copie numérisée ou photo lisible de toutes les pages (PDF, JPG, PNG ou HEIC). Vous pouvez ajouter plusieurs fichiers.",
    "Upload the signed form: legible scanned copy or photograph of every page (PDF, JPG, PNG or HEIC). You can add several files.",
  ),
  signStep4: t("Confirmez l'envoi une fois tous les fichiers téléversés.", "Confirm once all files are uploaded."),
  signedDone: t("J'ai téléversé le formulaire signé", "I have uploaded the signed form"),
  signedNone: t("Téléversez d'abord le formulaire signé.", "Please upload the signed form first."),
  postOriginals: t(
    "N'oubliez pas d'envoyer par courrier les originaux des copies certifiées conformes des pièces d'identité (voir les indications des documents) à Ark Fiduciaire SA, boulevard Georges-Favon 26, 1204 Genève.",
    "Remember to send the originals of the certified copies of the identity documents by post (see the document instructions) to Ark Fiduciaire SA, boulevard Georges-Favon 26, 1204 Geneva, Switzerland.",
  ),
  returnedTitle: t("Merci", "Thank you"),
  returnedText: t("Merci. Ark vérifie vos réponses et vous contactera.", "Thank you. Ark is reviewing your answers and will contact you."),
  signedTitle: t("Merci, votre formulaire est complet", "Thank you, your form is complete"),
  signedText: t("Nous avons bien reçu votre formulaire signé le {date}. Ark vous contactera si nécessaire.", "We received your signed form on {date}. Ark will contact you if necessary."),
  supersededTitle: t("Une version plus récente existe", "A newer version exists"),
  supersededText: t(
    "Ark vous a envoyé une version plus récente de ce formulaire. Ouvrez le lien du dernier e-mail reçu ou contactez Ark.",
    "Ark has sent you a newer version of this form. Open the link in the latest e-mail you received or contact Ark.",
  ),
  closedTitle: t("Formulaire clôturé", "Form closed"),
  closedText: t("Ce formulaire a été clôturé par Ark. Pour toute question, contactez Ark.", "This form has been closed by Ark. For any question, please contact Ark."),
  linkInvalidTitle: t("Lien plus valable", "Link no longer valid"),
  linkInvalidText: t(
    "Ce lien n'est plus valable. Ouvrez le lien du dernier e-mail reçu d'Ark ou contactez Ark pour en recevoir un nouveau.",
    "This link is no longer valid. Open the link in the latest e-mail from Ark or contact Ark to receive a new one.",
  ),
  helpTitle: t("Besoin d'aide ?", "Need help?"),
  retry: t("Réessayer", "Try again"),
} as const;

/** Error codes of /api/kyc-questionnaire/* (and of the browser upload). */
export const SERVER_ERRORS: Record<string, L> = {
  otp_invalid: t("Code incorrect.", "Incorrect code."),
  otp_expired: t("Code expiré. Demandez-en un nouveau.", "Code expired. Request a new one."),
  otp_locked: t("Trop d'essais. Demandez un nouveau code.", "Too many attempts. Request a new code."),
  link_invalid: t("Ce lien n'est plus valable.", "This link is no longer valid."),
  case_closed: t("Ce formulaire a été clôturé.", "This form has been closed."),
  revision_superseded: t("Une version plus récente de ce formulaire existe.", "A newer version of this form exists."),
  rate_limited: t("Trop de tentatives. Réessayez dans quelques minutes.", "Too many attempts. Try again in a few minutes."),
  session_expired: t("Votre session a expiré. Rouvrez le lien reçu par e-mail.", "Your session has expired. Open the link you received by e-mail again."),
  storage_unavailable: t("Service momentanément indisponible. Réessayez dans un instant.", "Service temporarily unavailable. Try again shortly."),
  not_editable: t("Ce formulaire ne peut plus être modifié.", "This form can no longer be changed."),
  unknown_document: t("Ce document n'est plus demandé d'après vos réponses.", "This document is no longer requested based on your answers."),
  file_type: t("Format de fichier non accepté.", "File type not accepted."),
  file_size: t("Fichier trop volumineux ({mb} Mo max.).", "File too large (max. {mb} MB)."),
  file_empty: t("Le fichier est vide.", "The file is empty."),
  file_not_found: t("Ce fichier n'existe plus.", "This file no longer exists."),
  too_many_files: t("Nombre maximal de fichiers atteint.", "Maximum number of files reached."),
  upload_failed: t("L'envoi du fichier a échoué. Réessayez.", "The upload failed. Please try again."),
  invalid_answers: t("Certaines réponses sont incomplètes. Vérifiez les points signalés.", "Some answers are incomplete. Check the highlighted fields."),
  missing_documents: t("Pour chaque document demandé, joignez le fichier ou indiquez que vous l'envoyez séparément.", "For each requested document, attach the file or say that you will send it separately."),
  file_rejected: t("Certains fichiers ont été refusés.", "Some files were rejected."),
  signed_missing: t("Téléversez d'abord le formulaire signé.", "Please upload the signed form first."),
  pdf_not_ready: t("Le PDF n'est pas encore prêt. Réessayez dans un instant.", "The PDF is not ready yet. Try again shortly."),
  network: t("Problème de connexion. Réessayez.", "Connection problem. Please try again."),
  generic: t("Une erreur est survenue. Réessayez ou contactez Ark.", "Something went wrong. Try again or contact Ark."),
};

export const FIELD_ERRORS: Record<FieldError, L> = {
  required: t("Champ obligatoire.", "Required."),
  invalid_email: t("Adresse e-mail invalide.", "Invalid e-mail address."),
  invalid_date: t("Date invalide (jj.mm.aaaa).", "Invalid date (dd.mm.yyyy)."),
  invalid_amount: t("Montant invalide (ex. 1'234.50).", "Invalid amount (e.g. 1'234.50)."),
  invalid_number: t("Nombre entier attendu.", "Whole number expected."),
  invalid_percent: t("Pourcentage entre 0 et 100.", "Percentage between 0 and 100."),
  invalid_phone: t("Numéro de téléphone invalide.", "Invalid phone number."),
  invalid_option: t("Choix invalide.", "Invalid choice."),
  too_long: t("Texte trop long.", "Text too long."),
  min_rows: t("Ajoutez au moins une entrée.", "Add at least one entry."),
};
