/**
 * FAQ content checks: every page FAQ ("Faq" / team.json "MemberFaq") and
 * every article FAQ must give valid FAQPage JSON-LD (name + acceptedAnswer
 * text), built from the exact text the page shows. Typography (U+202F,
 * no em dash) is enforced on page FAQs; article text keeps its own history.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { parseFaq } from "./page-faq.ts";
import { extractFaqFromContent } from "./articleFaq.ts";
import { buildFAQPage } from "./structuredData.ts";

const LOCALES = ["fr", "en", "de", "es", "pt"];
const dir = (l: string) => path.join(process.cwd(), "src", "translations", l);
const read = (l: string, ns: string) => JSON.parse(fs.readFileSync(path.join(dir(l), `${ns}.json`), "utf8"));

function checkEntries(where: string, locale: string, entries: { question: string; answer: string }[], min: number, max: number, style = true) {
  assert.ok(entries.length >= min && entries.length <= max, `${where}: ${entries.length} questions`);
  const ld = JSON.parse(JSON.stringify(buildFAQPage(entries)));
  assert.equal(ld["@type"], "FAQPage");
  ld.mainEntity.forEach((q: { name: string; acceptedAnswer: { text: string } }, i: number) => {
    assert.equal(q.name, entries[i].question, `${where}: JSON-LD question differs from visible text`);
    assert.equal(q.acceptedAnswer.text, entries[i].answer, `${where}: JSON-LD answer differs from visible text`);
    assert.match(q.name, /\?$/, `${where}: question without "?": ${q.name}`);
    if (style) assert.ok(!/—/.test(q.name + q.acceptedAnswer.text), `${where}: em dash`);
    if (style && locale === "fr") assert.ok(!/ [?!:;]/.test(q.name + " " + q.acceptedAnswer.text), `${where}: plain space before ?!:; (needs U+202F)`);
  });
}

test("page FAQs are complete and valid in every locale", () => {
  let pages = 0;
  for (const locale of LOCALES) {
    for (const file of fs.readdirSync(dir(locale)).filter((f) => f.endsWith(".json"))) {
      const ns = file.replace(/\.json$/, "");
      const data = read(locale, ns);
      if (data.Faq) {
        const faq = parseFaq(data.Faq);
        assert.ok(faq, `${locale}/${ns}: Faq unreadable`);
        checkEntries(`${locale}/${ns}`, locale, faq.entries, 3, 6);
        pages++;
      }
      for (const [slug, raw] of Object.entries(data.MemberFaq ?? {})) {
        const faq = parseFaq(raw);
        assert.ok(faq, `${locale}/${ns}/${slug}: MemberFaq unreadable`);
        checkEntries(`${locale}/team/${slug}`, locale, faq.entries, 3, 6);
        pages++;
      }
    }
  }
  assert.ok(pages > 0);
});

test("every locale has the same page FAQs as French", () => {
  const keys = (l: string) =>
    fs.readdirSync(dir(l)).filter((f) => f.endsWith(".json")).flatMap((f) => {
      const d = read(l, f.replace(/\.json$/, ""));
      return [...(d.Faq ? [f] : []), ...Object.keys(d.MemberFaq ?? {}).map((s) => `${f}:${s}`)];
    }).sort();
  const has = (l: string) => new Set(fs.readdirSync(dir(l)));
  for (const l of LOCALES) {
    // Compare only namespaces the locale has (ai-profile exists in fr/en only).
    const own = has(l);
    const expected = keys("fr").filter((k) => own.has(k.split(":")[0]));
    assert.deepEqual(keys(l), expected, `${l}: FAQ pages differ from fr`);
  }
});

test("article FAQs give valid FAQPage JSON-LD", () => {
  for (const locale of LOCALES) {
    for (const a of read(locale, "ressources").Articles as { slug: string; content?: string }[]) {
      const entries = extractFaqFromContent(a.content ?? "");
      if (entries.length >= 3) checkEntries(`${locale}/${a.slug}`, locale, entries, 3, 12, false);
    }
  }
});
