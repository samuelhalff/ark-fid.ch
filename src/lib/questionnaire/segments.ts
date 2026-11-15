/** How a questionnaire screen (KYC or tax) is split into what renders together. Pure module. */
import type { KitBlock } from "./kit";

export type FieldBlock = Extract<KitBlock, { kind: "field" }>;
export type GroupBlock = Extract<KitBlock, { kind: "group" }>;
export type HeadingBlock = Extract<KitBlock, { kind: "heading" }>;
export type NoteBlock = Extract<KitBlock, { kind: "note" }>;

export type Segment =
  | { kind: "fields"; items: FieldBlock[] }
  /** Prefilled rows: in one card under their heading, or a single bordered row (heading null). */
  | { kind: "prefilled"; heading: HeadingBlock | null; items: FieldBlock[] }
  | { kind: "heading"; heading: HeadingBlock }
  | { kind: "note"; note: NoteBlock }
  | { kind: "group"; group: GroupBlock };


/**
 * Splits a screen into what renders together: consecutive questions share a two-column grid; a
 * heading followed by prefilled answers becomes their « déjà rempli » card.
 */
export function segmentBlocks(blocks: KitBlock[], isRow: (b: KitBlock) => boolean): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.kind === "heading") {
      const rows: FieldBlock[] = [];
      const own = block.prefill?.ids ? new Set(block.prefill.ids) : null;
      while (i + 1 < blocks.length && isRow(blocks[i + 1]) && (!own || own.has(blocks[i + 1].id))) rows.push(blocks[++i] as FieldBlock);
      if (rows.length) segments.push({ kind: "prefilled", heading: block, items: rows });
      else if (!block.prefill?.onlyWhenPrefilled) segments.push({ kind: "heading", heading: block });
    } else if (block.kind === "field") {
      const last = segments[segments.length - 1];
      if (isRow(block)) segments.push({ kind: "prefilled", heading: null, items: [block] });
      else if (last?.kind === "fields") last.items.push(block);
      else segments.push({ kind: "fields", items: [block] });
    } else if (block.kind === "note") segments.push({ kind: "note", note: block });
    else segments.push({ kind: "group", group: block });
  }
  return segments;
}

