/** Swiss communes (BFS/OFS official register, see scripts/build-communes.mjs): lookup and search. */
import { COMMUNES_DATA } from "./communes-data";

export interface Commune {
  bfs: number;
  name: string;
  canton: string;
  /** Accent- and case-insensitive form used for matching. */
  key: string;
}

export const foldText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const COMMUNES: Commune[] = COMMUNES_DATA.communes.map(([bfs, name, canton]) => ({ bfs, name, canton, key: foldText(name) }));
const BY_BFS = new Map(COMMUNES.map((c) => [c.bfs, c]));

export const communeByBfs = (bfs: unknown): Commune | undefined => BY_BFS.get(Number(bfs));

/**
 * Prefix search, accent-insensitive: matches the start of the name or of any word in it
 * ("geneve" → Genève, "chene" → Chêne-Bougeries). Optional canton filter. Name-start matches first.
 */
export function searchCommunes(query: string, canton?: string, limit = 50): Commune[] {
  const q = foldText(query);
  const pool = canton && canton !== "ABROAD" ? COMMUNES.filter((c) => c.canton === canton) : COMMUNES;
  if (!q) return pool.slice(0, limit);
  const starts: Commune[] = [];
  const words: Commune[] = [];
  for (const c of pool) {
    if (c.key.startsWith(q)) starts.push(c);
    else if (c.key.includes(` ${q}`)) words.push(c);
  }
  return [...starts, ...words].slice(0, limit);
}
