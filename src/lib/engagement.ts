/**
 * Pure helpers for the GA4 engagement events sent by EngagementTracker
 * (scroll depth, outbound clicks, file downloads, CTA and service-card
 * clicks, FAQ opens). Only page structure goes out (paths, domains, fixed
 * labels), never anything the visitor typed. Dependency-free for `node --test`.
 */

export const SCROLL_THRESHOLDS = [25, 50, 75, 90] as const;

/** Thresholds newly reached at `percent` that were not sent yet. */
export function newScrollThresholds(percent: number, sent: ReadonlySet<number>): number[] {
  if (!Number.isFinite(percent)) return [];
  return SCROLL_THRESHOLDS.filter((t) => percent >= t && !sent.has(t));
}

/** Scrolled share of the page in %, 0-100. A page shorter than the viewport counts as 100. */
export function scrollPercent(scrollY: number, viewportHeight: number, documentHeight: number): number {
  const scrollable = documentHeight - viewportHeight;
  if (scrollable <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((scrollY / scrollable) * 100)));
}

export const DOWNLOAD_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "zip", "txt", "rtf", "odt", "ods", "ics", "vcf",
];

const CTA_PATH = /^\/(?:[a-z]{2}\/)?(contact|agent)(\/|$)/;
const SERVICE_PATH = /^\/(?:[a-z]{2}\/)?(services|products|solutions)\/([a-z0-9-]+)\/?$/;

export type LinkClick =
  | { event: "click"; params: { link_domain: string; link_url: string; outbound: true } }
  | { event: "file_download"; params: { file_extension: string; file_name: string; link_url: string; link_domain: string } }
  | { event: "select_content"; params: { content_type: string; item_id: string } };

function strip(url: URL) {
  return `${url.origin}${url.pathname}`.slice(0, 300);
}

/**
 * Classifies a click on a link. `explicit` = data-track-content-type /
 * data-track-id on the element or an ancestor (wins over the heuristics).
 */
export function classifyLinkClick(
  href: string,
  currentHref: string,
  explicit?: { contentType?: string | null; itemId?: string | null },
): LinkClick[] {
  const out: LinkClick[] = [];
  if (explicit?.contentType) {
    out.push({
      event: "select_content",
      params: { content_type: explicit.contentType.slice(0, 40), item_id: (explicit.itemId || "").slice(0, 100) },
    });
  }
  let url: URL;
  let here: URL;
  try {
    here = new URL(currentHref);
    url = new URL(href, here);
  } catch {
    return out;
  }
  if (url.protocol === "mailto:" || url.protocol === "tel:") {
    if (!explicit?.contentType) out.push({ event: "select_content", params: { content_type: "cta", item_id: url.protocol.slice(0, -1) } });
    return out;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return out;
  const host = url.hostname.replace(/^www\./, "");
  const own = here.hostname.replace(/^www\./, "");
  const external = host !== own && !host.endsWith(`.${own}`) && !own.endsWith(`.${host}`);
  const ext = (url.pathname.split(".").pop() || "").toLowerCase();
  const isFile = url.pathname.includes(".") && DOWNLOAD_EXTENSIONS.includes(ext);
  if (isFile) {
    out.push({
      event: "file_download",
      params: {
        file_extension: ext,
        file_name: decodeSafe(url.pathname.split("/").pop() || "").slice(0, 100),
        link_url: strip(url),
        link_domain: host,
      },
    });
    return out;
  }
  if (external) {
    out.push({ event: "click", params: { link_domain: host, link_url: strip(url), outbound: true } });
    if (!explicit?.contentType && /(^|\.)wa\.me$|whatsapp\.com$/.test(host)) {
      out.push({ event: "select_content", params: { content_type: "cta", item_id: "whatsapp" } });
    }
    return out;
  }
  if (explicit?.contentType) return out;
  const cta = url.pathname.match(CTA_PATH);
  if (cta) {
    out.push({ event: "select_content", params: { content_type: "cta", item_id: cta[1] } });
    return out;
  }
  const service = url.pathname.match(SERVICE_PATH);
  if (service) out.push({ event: "select_content", params: { content_type: "service_card", item_id: `${service[1]}/${service[2]}` } });
  return out;
}

function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Web vitals as a GA4 event: CLS scaled ×1000 so every value is an integer (ms or CLS‰). */
export function webVitalParams(metric: { name: string; value: number; rating?: string; navigationType?: string }) {
  const value = metric.name === "CLS" ? metric.value * 1000 : metric.value;
  return {
    metric_name: metric.name,
    metric_value: Math.round(value),
    metric_rating: metric.rating || "",
    non_interaction: true,
  };
}
