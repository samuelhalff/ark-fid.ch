/**
 * Public pages of ark-fid.ch in French and English, read from the same
 * translation files the pages render. Shared by /llms-full.txt (full text
 * for LLMs) and the per-page Open Graph images (/assets/og-pages/<key>.webp).
 *
 * Only pages listed in the sitemap are included: no API, forms internals,
 * questionnaires, agent or noindex article versions. DE, ES and PT are left
 * out: they translate the same content and would triple the size.
 */
import fs from "fs";
import path from "path";
import { localizePath } from "./paths";
import { teamMembers, getMemberSlug } from "./team";
import { getArticles, getIndexableLocalesForSlug } from "./articles";

export const SITE_URL = "https://ark-fid.ch";
export type PublicLocale = "fr" | "en";
export const PUBLIC_LOCALES: readonly PublicLocale[] = ["fr", "en"];

export type PublicPage = {
  /** Base path, e.g. "/services/accounting" (not localized). */
  path: string;
  locale: PublicLocale;
  url: string;
  title: string;
  /** Short section label shown above the title on the share image. */
  rubric: string;
  updated?: string;
  /** One-sentence summary (meta description), for llms.txt. */
  description?: string;
  /** Markdown body (without the title), built on demand. */
  body: () => string;
};

type Json = Record<string, unknown>;

const jsonCache = new Map<string, Json | null>();
function readNs(locale: PublicLocale, ns: string): Json | null {
  const key = `${locale}/${ns}`;
  if (jsonCache.has(key)) return jsonCache.get(key)!;
  let value: Json | null = null;
  try {
    const file = path.join(process.cwd(), "src", "translations", locale, `${ns}.json`);
    value = JSON.parse(fs.readFileSync(file, "utf8")) as Json;
  } catch {
    value = null;
  }
  jsonCache.set(key, value);
  return value;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const get = (o: unknown, dotted: string): unknown =>
  dotted.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Json)[k] : undefined), o);

export const pageUrl = (p: string, locale: PublicLocale) => {
  const localized = localizePath(p, locale);
  return `${SITE_URL}/${locale}${localized === "/" ? "" : localized}/`;
};

/** Root-relative links in Markdown become absolute: the file is read off-site. */
export const absoluteLinks = (md: string) => md.replace(/\]\(\//g, `](${SITE_URL}/`);

const clean = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

/* UI strings that are not page content (buttons, badges, form fields, alt texts, links). */
const SKIP_EXACT = new Set(["meta", "alt", "form", "error", "errors", "success", "sending", "lastupdated", "eyebrow", "scrollhint", "readmore", "showmore", "showless", "website", "logo", "icon", "href", "url"]);
/* Sections present in the JSON files but not rendered on the pages (never published here). */
const NOT_RENDERED = new Set(["commonquestions", "usecases", "whothisisfor", "processtimeline", "memberfaq"]);
const SKIP_PART = ["cta", "button", "badge", "imagealt", "placeholder", "label", "calltoaction"];
const skipKey = (k: string) => {
  const l = k.toLowerCase();
  return SKIP_EXACT.has(l) || NOT_RENDERED.has(l) || SKIP_PART.some((p) => l.includes(p)) || l.startsWith("map");
};
const isTitleKey = (k: string) => /^(title|name|question\d*)$/i.test(k);
const isSubHeadingKey = (k: string) => /.title$/i.test(k) && !/^subtitle$/i.test(k);
const heading = (depth: number, text: string) => `${"#".repeat(Math.min(Math.max(depth, 2), 4))} ${text}`;

/** Translation JSON to Markdown: titles become headings, string arrays bullets, the rest paragraphs. */
function jsonToMarkdown(node: unknown, depth: number, out: string[]) {
  if (typeof node === "string") {
    const t = clean(node);
    if (t) out.push(t, "");
    return;
  }
  if (Array.isArray(node)) {
    if (node.every((x) => typeof x === "string")) {
      const items = node.map((x) => clean(x as string)).filter(Boolean);
      if (!items.length) return;
      // Long items are paragraphs on the page, short ones a list.
      const long = items.reduce((n, x) => n + x.length, 0) / items.length > 160;
      if (long) out.push(...items.flatMap((x) => [x, ""]));
      else out.push(...items.map((x) => `- ${x}`), "");
      return;
    }
    for (const x of node) jsonToMarkdown(x, depth, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const entries = Object.entries(node as Json).filter(([k]) => !skipKey(k));
  const titleEntry = entries.find(([k, v]) => isTitleKey(k) && typeof v === "string");
  if (titleEntry) out.push(heading(depth, clean(titleEntry[1] as string)), "");
  for (const [k, v] of entries) {
    if (titleEntry && k === titleEntry[0]) continue;
    if (typeof v === "string" && /^question\d*$/i.test(k)) {
      out.push(heading(depth + 1, clean(v)), "");
      continue;
    }
    if (typeof v === "string" && isSubHeadingKey(k)) {
      out.push(heading(depth + 1, clean(v)), "");
      continue;
    }
    jsonToMarkdown(v, depth + 1, out);
  }
}

function nsMarkdown(locale: PublicLocale, ns: string, pick?: string, only?: string[]) {
  let data: unknown = readNs(locale, ns);
  if (pick) data = get(data, pick);
  if (only && data && typeof data === "object") {
    data = Object.fromEntries(Object.entries(data as Json).filter(([k]) => only.includes(k)));
  }
  const out: string[] = [];
  jsonToMarkdown(data, 1, out);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Meta description of a static page (lead paragraph). */
function metaDescription(locale: PublicLocale, p: string): string {
  const pages = (readNs(locale, "metadata")?.pages ?? {}) as Record<string, { description?: string }>;
  return clean(str(pages[p]?.description));
}

/** Page title from metadata.json without the trailing brand. */
function metaTitle(locale: PublicLocale, p: string): string {
  const meta = readNs(locale, "metadata");
  const pages = (meta?.pages ?? {}) as Record<string, { title?: string }>;
  const raw = str(pages[p]?.title);
  return raw.replace(/\s+[|–-]\s+Ark Fiduciaire[^|–]*$/i, "").trim() || "Ark Fiduciaire";
}

const nav = (locale: PublicLocale, key: string) => str(readNs(locale, "navbar")?.[key]);

type Spec = { path: string; rubric: (l: PublicLocale) => string; sections: { ns: string; pick?: string; only?: string[] }[] };

const SERVICES: [string, string][] = [
  ["/services/accounting", "accounting"],
  ["/services/taxes", "taxes"],
  ["/services/payroll", "payroll"],
  ["/services/incorporation", "incorporation"],
  ["/services/outsourcing", "outsourcing"],
  ["/services/corporate", "corporate"],
  ["/services/domiciliation", "domiciliation"],
  ["/services/odoo", "odoo"],
  ["/services/family-office", "family-office"],
  ["/services/mergers-acquisitions", "mna"],
  ["/services/immigration", "immigration"],
];

const SPECS: Spec[] = [
  { path: "/", rubric: (l) => str(get(readNs(l, "home"), "Hero.Badge")), sections: [{ ns: "home", only: ["Hero", "Services", "Trust", "About"] }, { ns: "faq" }] },
  { path: "/about", rubric: (l) => nav(l, "About"), sections: [{ ns: "about-us" }] },
  { path: "/ai-profile", rubric: (l) => nav(l, "About"), sections: [{ ns: "ai-profile" }] },
  { path: "/services", rubric: (l) => nav(l, "Services"), sections: [{ ns: "servicesItems" }] },
  ...SERVICES.map(([p, ns]): Spec => ({ path: p, rubric: (l) => nav(l, "Services"), sections: [{ ns }] })),
  { path: "/partners", rubric: (l) => nav(l, "Our partners"), sections: [{ ns: "partners" }] },
  { path: "/contact", rubric: (l) => nav(l, "Contact"), sections: [{ ns: "contact", only: ["Title", "Subtitle"] }] },
  { path: "/ressources", rubric: (l) => nav(l, "Ressources"), sections: [] },
  { path: "/legal/terms", rubric: () => "", sections: [{ ns: "legal", pick: "Terms" }] },
  { path: "/legal/privacy", rubric: () => "", sections: [{ ns: "legal", pick: "Privacy" }] },
  { path: "/legal/cookies", rubric: () => "", sections: [{ ns: "legal", pick: "Cookies" }] },
  { path: "/legal/app-privacy", rubric: () => "", sections: [{ ns: "legal", pick: "AppPrivacy" }] },
];

function teamPages(locale: PublicLocale): PublicPage[] {
  const team = readNs(locale, "team");
  const bios = readNs(locale, "team-bios");
  const details = readNs(locale, "team-details");
  const role = (r: string) => str(get(team, `Role.${r}`)) || r;
  const label = (k: string) => str(get(team, `Labels.${k}`)) || k;

  const index: PublicPage = {
    path: "/team",
    locale,
    url: pageUrl("/team", locale),
    title: metaTitle(locale, "/team"),
    rubric: nav(locale, "Team"),
    body: () => {
      const out = [str(team?.Subtitle), ""];
      for (const m of teamMembers) {
        const slug = getMemberSlug(m);
        out.push(`## ${m.name}`, "", role(m.role), "", clean(str(get(bios, `Bios.${slug}.short`)) || m.bioShort), "", `${pageUrl(`/team/${slug}`, locale)}`, "");
      }
      return out.join("\n").trim();
    },
  };

  const members = teamMembers.map((m): PublicPage => {
    const slug = getMemberSlug(m);
    const p = `/team/${slug}`;
    return {
      path: p,
      locale,
      url: pageUrl(p, locale),
      title: m.name,
      rubric: nav(locale, "Team"),
      body: () => {
        const bio = str(get(bios, `Bios.${slug}.long`)) || m.bioLong || str(get(bios, `Bios.${slug}.short`)) || m.bioShort;
        const out = [role(m.role), "", ...clean(bio).split(/\n+/).flatMap((x) => [x, ""])];
        for (const k of ["education", "languages", "memberships", "credentials"] as const) {
          const fromJson = get(details, `Details.${slug}.${k}`);
          const items = Array.isArray(fromJson) ? (fromJson as string[]) : (m[k] ?? []);
          if (items.length) out.push(`## ${label(k.charAt(0).toUpperCase() + k.slice(1))}`, "", ...items.map((x) => `- ${clean(x)}`), "");
        }
        return out.join("\n").trim();
      },
    };
  });
  return [index, ...members];
}

function articlePages(locale: PublicLocale): PublicPage[] {
  return getArticles(locale)
    .filter((a) => getIndexableLocalesForSlug(a.slug).includes(locale))
    .map((a): PublicPage => {
      const p = `/ressources/articles/${a.slug}`;
      return {
        path: p,
        locale,
        url: pageUrl(p, locale),
        title: a.title,
        rubric: nav(locale, "Ressources"),
        updated: a.updated ?? a.date,
        description: a.description ? clean(a.description) : undefined,
        body: () => [a.description ? clean(a.description) : "", "", absoluteLinks(a.content ?? "").trim()].join("\n").trim(),
      };
    });
}

const pagesCache = new Map<PublicLocale, PublicPage[]>();

/** Every public page of a locale: static pages, services, team, then articles. */
export function publicPages(locale: PublicLocale): PublicPage[] {
  const cached = pagesCache.get(locale);
  if (cached) return cached;
  const statics = SPECS.map(
    (s): PublicPage => ({
      path: s.path,
      locale,
      url: pageUrl(s.path, locale),
      title: metaTitle(locale, s.path),
      description: metaDescription(locale, s.path),
      rubric: s.rubric(locale),
      body: () =>
        [metaDescription(locale, s.path), ...s.sections.map((x) => nsMarkdown(locale, x.ns, x.pick, x.only))]
          .filter(Boolean)
          .join("\n\n"),
    }),
  );
  const team = teamPages(locale);
  // Team pages sit after the static pages, before legal pages.
  const legalStart = statics.findIndex((p) => p.path.startsWith("/legal/"));
  const pages = [...statics.slice(0, legalStart), ...team, ...statics.slice(legalStart), ...articlePages(locale)];
  pagesCache.set(locale, pages);
  return pages;
}

/* ---- Open Graph images ---- */

/** "/" -> "fr", "/services/accounting" -> "fr--services--accounting". */
export const ogKey = (locale: PublicLocale, p: string) => (p === "/" ? locale : `${locale}${p.replace(/\/+$/, "").replace(/\//g, "--")}`);

const shortHash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

let ogIndex: Map<string, PublicPage> | null = null;
export function ogPages(): Map<string, PublicPage> {
  if (ogIndex) return ogIndex;
  // Team member pages already share the member's photo (app/[locale]/team/[slug]).
  ogIndex = new Map(
    PUBLIC_LOCALES.flatMap((l) =>
      publicPages(l)
        .filter((p) => !p.path.startsWith("/team/"))
        .map((p) => [ogKey(l, p.path), p] as const),
    ),
  );
  return ogIndex;
}

/**
 * Share image of a page, or null when it has none (DE/ES/PT, pages outside
 * the sitemap): callers then keep the per-language image. The query string
 * changes with the title, so caches drop an outdated image.
 */
export function ogImageFor(locale: string, p: string): string | null {
  if (locale !== "fr" && locale !== "en") return null;
  const normalized = p === "/" ? "/" : p.replace(/\/+$/, "");
  const key = ogKey(locale, normalized);
  const page = ogPages().get(key);
  return page ? `/assets/og-pages/${key}.webp?v=${shortHash(page.title + page.rubric)}` : null;
}
