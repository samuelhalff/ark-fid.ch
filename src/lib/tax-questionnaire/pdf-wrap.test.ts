import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { wrapText } from "./server/pdf.ts";

const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
const SIZE = 9.5;
const WIDTH = 320;

test("an overlong word is broken in linear time into lines that fit (S-F4)", () => {
  const word = "W".repeat(100_000);
  const started = Date.now();
  const lines = wrapText(word, font, SIZE, WIDTH);
  assert.ok(Date.now() - started < 3000, "no cubic scan");
  assert.equal(lines.join(""), word, "nothing lost");
  for (const line of lines) assert.ok(font.widthOfTextAtSize(line, SIZE) <= WIDTH || line.length === 1);
});

test("a long run of narrow glyphs is split too, and nothing is lost (S-F4)", () => {
  const word = "i".repeat(5000);
  const lines = wrapText(word, font, SIZE, WIDTH);
  assert.equal(lines.join(""), word);
  for (const line of lines) assert.ok(font.widthOfTextAtSize(line, SIZE) <= WIDTH);
});

// The previous algorithm, kept as the reference for text that has no overlong word.
function reference(text: string): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, SIZE) <= WIDTH) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let rest = word;
      while (font.widthOfTextAtSize(rest, SIZE) > WIDTH && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), SIZE) > WIDTH) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

test("text wraps at the same places as before, overlong words included (S-F4)", () => {
  const samples = [
    "Le contribuable déclare un revenu de remplacement versé par la caisse de chômage pendant toute l'année fiscale concernée, avec décision jointe.\nDeuxième paragraphe.",
    `avant ${"M".repeat(120)} après ${"abcdefghij".repeat(30)} fin`,
    "  espaces   multiples  ",
  ];
  for (const sample of samples) assert.deepEqual(wrapText(sample, font, SIZE, WIDTH), reference(sample));
});
