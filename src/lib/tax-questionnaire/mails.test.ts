import assert from "node:assert/strict";
import test from "node:test";

import { campaignMail } from "./server/campaign.ts";
import { firstNameOf } from "./server/email.ts";
import { givenName, personName, splitPersonName } from "./format.ts";
import { linkMail, otpMail, regularisationClientMail } from "./server/mails.ts";

/** Visible text of a mail, paragraphs separated by blank lines. */
export const textOf = (html: string) =>
  html
    .replace(/<li>/g, "- ")
    .replace(/<\/(p|li)>|<br>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();

const BANNED = /quelques minutes|en toute simplicité|sécuris|cordialement|n'hésitez pas|few minutes|secure|do not hesitate|!/i;

test("invitation (renewal) follows the owner-approved French model", () => {
  const mail = campaignMail("invitation", "fr", "a@b.ch", 2025, "https://tax.ark-fid.ch/fr/#acces=x", "https://o", { firstName: "Anne", variant: "renewal" });
  assert.equal(mail.subject, "Votre déclaration d'impôt 2025");
  assert.equal(
    textOf(mail.html).split("Ne plus recevoir")[0].trim(),
    [
      "Bonjour Anne,",
      "J'espère que vous allez bien.",
      "Nous préparons votre déclaration d'impôt 2025.",
      "Votre questionnaire reprend les informations de l'an dernier. Merci de corriger ce qui a changé et d'ajouter vos documents 2025 :",
      "Ouvrir le questionnaire",
      "Un code vous sera envoyé par email pour l'ouvrir.",
      "A votre disposition pour toute question.",
      "Bien à vous,",
      "Samuel Halff",
      "Ark Fiduciaire SA",
    ].join("\n"),
  );
  assert.equal(mail.replyTo, "samuel.halff@ark-fid.ch");
});

test("reminder: one line, the missing documents, the link", () => {
  const mail = campaignMail("reminder", "fr", "a@b.ch", 2025, "https://l", "https://o", { firstName: "Anne", missing: ["Certificat de salaire 2025 – Acme SA"] });
  assert.match(mail.subject, /Rappel/);
  assert.match(textOf(mail.html), /^Bonjour Anne,\nAvez-vous pu remplir votre questionnaire 2025 \? Il nous manque encore :\n- Certificat de salaire 2025 – Acme SA\nOuvrir le questionnaire\nBien à vous,/);
});

test("no marketing phrasing in any client mail, in any language", () => {
  for (const locale of ["fr", "en", "de"] as const) {
    const mails = [
      campaignMail("notice", locale, "a@b.ch", 2025, null, "https://o", { firstName: "Anne" }),
      campaignMail("invitation", locale, "a@b.ch", 2025, "https://l", "https://o", { variant: "fresh" }),
      campaignMail("invitation", locale, "a@b.ch", 2025, "https://l", "https://o", { variant: "prepared" }),
      campaignMail("reminder", locale, "a@b.ch", 2025, "https://l", "https://o"),
      otpMail(locale, "a@b.ch", "123456"),
      linkMail(locale, "a@b.ch", "https://l", "resume", 30, "", "MARTIN Anne"),
      linkMail(locale, "a@b.ch", "https://l", "status", 30),
      linkMail(locale, "a@b.ch", "https://l", "partner", 14, "MARTIN Anne"),
      regularisationClientMail(locale, "a@b.ch"),
    ];
    for (const mail of mails) {
      assert.ok(!BANNED.test(textOf(mail.html) + mail.subject), `${locale}: ${mail.subject}`);
      assert.ok(!/background:#|padding:10px 16px/.test(mail.html), "no button or banner");
    }
  }
  assert.equal(textOf(otpMail("fr", "a@b.ch", "123456").html), "Votre code : 123456\nIl est valable 10 minutes.");
});

test("first name from the CRM convention", () => {
  assert.equal(firstNameOf("MARTIN Anne"), "Anne");
  assert.equal(firstNameOf("DE LA TOUR Jean-Paul"), "Jean-Paul");
  assert.equal(firstNameOf("DÉMO Renouvellement"), "Renouvellement");
  assert.equal(firstNameOf("SMITH"), "");
  assert.equal(firstNameOf("Pauline Allamand"), "", "not in the house format: no guess");
});

test("names follow the house convention NOM Prénom whatever the client typed", () => {
  assert.equal(personName("constantinescu", "ALEX"), "CONSTANTINESCU Alex");
  assert.equal(personName(" de la  tour ", "jean-paul"), "DE LA TOUR Jean-Paul");
  assert.equal(personName("L'Estrange-Fawcett", "robert"), "L'ESTRANGE-FAWCETT Robert");
  assert.equal(personName("Martin", "Anne-Sophie"), "MARTIN Anne-Sophie");
  assert.equal(personName("Smith", "McKenzie"), "SMITH McKenzie");
  assert.equal(givenName("éLODIE"), "éLODIE");
  assert.equal(givenName("ÉLODIE"), "Élodie");
  assert.equal(firstNameOf(personName("granath", "ANDERS")), "Anders");
});

test("invitation names split back into last and first name without guessing", () => {
  assert.deepEqual(splitPersonName("DE LA TOUR Jean-Paul"), { lastName: "DE LA TOUR", firstName: "Jean-Paul" });
  assert.deepEqual(splitPersonName("GRANATH Anders"), { lastName: "GRANATH", firstName: "Anders" });
  assert.deepEqual(splitPersonName("PAULINE ALLAMAND"), { lastName: "PAULINE ALLAMAND", firstName: "" });
  assert.deepEqual(splitPersonName("Pauline Allamand"), { lastName: "Pauline Allamand", firstName: "" });
});
