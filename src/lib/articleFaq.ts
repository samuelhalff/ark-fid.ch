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
export function extractFaqFromContent(content: string): FAQEntry[] {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => /^##\s+FAQ\b/i.test(line));
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
  return entries;
}
