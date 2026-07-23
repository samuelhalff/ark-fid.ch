import { createHash, timingSafeEqual } from "crypto";

const INDEXNOW_HOST = "ark-fid.ch";
const INDEXNOW_MIN_SECRET_BYTES = 32;

export type IndexNowAuthResult = "authorized" | "unauthorized" | "misconfigured";

/**
 * Constant-time secret check. Never falls back to a hardcoded value — the old
 * hardcoded 'arkfid2025' is in git history and is considered compromised.
 */
export function checkIndexNowSecret(
  provided: string | null,
  configured: string | undefined,
): IndexNowAuthResult {
  const secret = (configured || "").trim();
  if (Buffer.byteLength(secret, "utf8") < INDEXNOW_MIN_SECRET_BYTES) {
    return "misconfigured";
  }
  if (!provided) return "unauthorized";
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b) ? "authorized" : "unauthorized";
}

/**
 * Accept only canonical https URLs on the ark-fid.ch host. Rejects the whole
 * batch on any invalid entry so the endpoint can't be used as an open relay.
 */
export function parseIndexNowUrls(
  value: unknown,
): { success: true; urls: string[] } | { success: false } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1000) {
    return { success: false };
  }
  const out = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || entry.length > 2048) return { success: false };
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      return { success: false };
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== INDEXNOW_HOST ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    ) {
      return { success: false };
    }
    out.add(url.toString());
  }
  return { success: true, urls: [...out] };
}

export async function submitToIndexNow(urls: string[]) {
  const hostDomain = INDEXNOW_HOST;
  const sitemapUrl = `https://${hostDomain}/sitemap.xml`;
  // Defense in depth: never submit an off-host URL even if a caller skipped
  // parseIndexNowUrls.
  urls = urls.filter((u) => {
    try {
      return new URL(u).hostname === INDEXNOW_HOST;
    } catch {
      return false;
    }
  });
  const indexNowKey = "ebd95385d7154f45ba37d076b4efd008"; // Hosted at https://ark-fid.ch/ebd95385d7154f45ba37d076b4efd008.txt

  console.log(
    "[Search Indexing] Notifying search engines about",
    urls.length,
    "updated URLs"
  );

  // Use IndexNow for Yandex, sitemap ping for Bing (since IndexNow 403s for Bing)
  const searchEngines = [
    {
      name: "Bing",
      method: "sitemap",
      url: `https://www.bing.com/webmaster/ping.aspx?sitemap=${encodeURIComponent(
        sitemapUrl
      )}`,
    },
    {
      name: "Yandex",
      method: "indexnow",
      url: "https://yandex.com/indexnow",
    },
  ];

  const results = await Promise.allSettled(
    searchEngines.map(async (engine) => {
      try {
        let response: Response;
        if (engine.method === "sitemap") {
          response = await fetch(engine.url, {
            method: "GET",
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
        } else if (engine.method === "indexnow") {
          response = await fetch(engine.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
            },
            body: JSON.stringify({
              host: hostDomain,
              key: indexNowKey,
              urlList: urls,
            }),
            signal: AbortSignal.timeout(10000),
          });
        } else {
          throw new Error(`Unknown method: ${engine.method}`);
        }

        if (
          response.ok ||
          response.status === 202 ||
          (engine.name === "Bing" && response.status === 410)
        ) {
          console.log(
            `[Search Indexing] ✓ ${engine.name} notified successfully`
          );
          return { engine: engine.name, success: true };
        } else {
          console.warn(
            `[Search Indexing] ⚠ ${engine.name} returned ${response.status}`
          );
          return {
            engine: engine.name,
            success: false,
            status: response.status,
          };
        }
      } catch (error) {
        console.warn(
          `[Search Indexing] ⚠ ${engine.name} notification failed:`,
          error
        );
        return { engine: engine.name, success: false, error };
      }
    })
  );

  const successful = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;
  console.log(
    `[Search Indexing] ✓ Completed: ${successful}/${searchEngines.length} search engines notified`
  );

  // Return true if at least one succeeded
  return successful > 0;
}
