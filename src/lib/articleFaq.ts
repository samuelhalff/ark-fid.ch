import type { FAQEntry } from "./structuredData";

const stripMarkdown = (value: string) =>
  value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Reads the visible FAQ of an article ("## FAQ ..." followed by "### question"
 * blocks) so the FAQPage JSON-LD always matches what the page shows.
 */
/** "## FAQ…" or the localized "frequently asked questions" heading. */
export const FAQ_HEADING =
  /^##\s+(?:FAQ\b|Questions fréquentes|Frequently asked questions|Häufige Fragen|Preguntas frecuentes|Perguntas frequentes)/i;

export function extractFaqFromContent(content: string): FAQEntry[] {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => FAQ_HEADING.test(line));
  if (start === -1) return [];
  const entries: FAQEntry[] = [];
  let question = "";
  let answer: string[] = [];
  const flush = () => {
    const text = stripMarkdown(answer.join(" "));
    if (question && text) entries.push({ question, answer: text });
    question = "";
    answer = [];
  };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line) || /^---\s*$/.test(line)) break;
    const heading = line.match(/^###\s+(.*)$/);
    if (heading) {
      flush();
      question = stripMarkdown(heading[1].replace(/^\d+\.\s*/, ""));
    } else if (question) {
      answer.push(line);
    }
  }
  flush();
  // Only real questions: a heading that does not end with "?" is a section
  // title, not an FAQ entry.
  return entries.filter((e) => /[?？]\s*$/.test(e.question));
}
