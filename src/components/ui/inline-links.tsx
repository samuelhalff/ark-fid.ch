import { Fragment, type ReactNode } from "react";

/**
 * Renders `[label](https://…)` links inside a translation string as real,
 * visibly styled links (dofollow: no rel=nofollow). Text without that pattern
 * is returned unchanged, so it is safe on any plain paragraph.
 */
const LINK_RE = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;

export const inlineLinkClass =
  "font-medium text-[#b6542b] underline decoration-[#b6542b]/50 underline-offset-4 transition-colors hover:decoration-2 hover:decoration-[#b6542b] dark:text-[#f2b294] dark:decoration-[#f2b294]/60 dark:hover:decoration-[#f2b294]";

export function renderInlineLinks(text: string): ReactNode {
  if (typeof text !== "string" || !text.includes("](")) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(
      <a key={index} href={match[2]} className={inlineLinkClass}>
        {match[1]}
      </a>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
