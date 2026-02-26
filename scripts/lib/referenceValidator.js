// Existing code...

const defaultBlockedDomains = [
    // Other domains...
    "pwc.ch",
    "bdo.ch",
    "ey.com",
    "kpmg.ch",
    "deloitte.ch",
    "taxpartner.ch",
    "mazars.ch",
    "grantthornton.ch",
    "pkf.swiss",
    "obt.ch",
    "kendris.com",
    "balmer-etienne.ch",
    "caminada.com",
    "fidinam.com",
    "fidag-sa.ch",
    "rister.ch",
    "findea.ch",
    "fidulex.ch",
    "entreprendre.ch",
    "acctive.ch",
    "fbk-conseils.ch",
    "karpeo.ch",
    "safe-fiduciaire.ch",
    "berneyassocies.com",
    "alltax.ch",
    "omnitax.ch",
    "retax.ch",
    "wadsack.ch",
    "core-partner.ch",
    "adbtax.ch",
    "cofidest.ch",
    "cofidest-swiss-audit.ch",
    "tax-services.ch",
    "eurexsuisse.com",
    "ftrust.ch",
    "aaretax.ch",
    "aapartnertreuhand.ch",
    "ackermann-treuhand.ch",
    "treuco.ch",
    "rnptreuhand.ch",
    "nexova.ch",
    "financialkeepers.ch",
    "fg-fiduciaire.ch",
    "roux-associes.ch",
    "fidurolle.ch",
    "zuffereypanigas.ch",
    "fiduciaire-rutz-menger.ch",
    "grf-societe-fiduciaire.ch",
    "y-fiduciaire.ch",
    "fiducom.ch",
    "swissdomiciliation.ch",
    "liberal-vd.ch",
    "kaurum.com",
    "finwise.ch",
    "calliopee.ch",
    "agfiduciaire.ch",
    "aag-fiduciaire.ch",
    "mm-t.ch",
    "gtf.ch",
    "bbtreuhand.ch",
    "dlg.ch",
    "enfinfidu.ch",
    "fasoon.ch"
];

const DEFAULT_TIMEOUT_MS = parseInt(process.env.LINK_CHECK_TIMEOUT_MS || "10000", 10);
const DEFAULT_MIN_BYTES = parseInt(process.env.LINK_CHECK_MIN_BYTES || "600", 10);

// Patterns that indicate a page has no real content (placeholder, error, empty shell)
const EMPTY_CONTENT_PATTERNS = [
  /coming\s+soon/i,
  /under\s+construction/i,
  /page\s+not\s+found/i,
  /404\s+not\s+found/i,
  /<body[^>]*>\s*<\/body>/i,
  /^\s*$/,
];
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; ResourceValidator/1.0)";

// Trusted source domains (less strict validation)
const TRUSTED_DOMAINS = [
  "admin.ch",
  "fedlex.admin.ch",
  "kmu.admin.ch",
  "ch.ch",
  "ge.ch",
  "vd.ch",
  "zh.ch",
  "be.ch",
  "ti.ch",
  "bfs.admin.ch",
  "estv.admin.ch",
  "finma.ch",
  "seco.admin.ch",
  "odoo.com",
  "swissdec.ch",
  "zefix.ch",
  "fer.ch",
  "economiesuisse.ch",
  "github.com",
  "wikipedia.org"
];

function parseDomainList(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Known competitor domains to exclude from article references by default.
const DEFAULT_BLOCKED_DOMAINS = [
  "rister.ch",
  "findea.ch",
  "fidulex.ch",
  "swissdomiciliation.ch",
  "liberal-vd.ch"
];
const BLOCKED_DOMAINS = Array.from(
  new Set([
    ...DEFAULT_BLOCKED_DOMAINS,
    ...parseDomainList(process.env.REFERENCE_BLOCKED_DOMAINS)
  ])
);

function isAllowedByList(url, allowedDomains) {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowedDomains.some(
      (d) => host === d || host.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

function isBlockedDomain(url, blockedDomains = BLOCKED_DOMAINS) {
  if (!blockedDomains || blockedDomains.length === 0) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return blockedDomains.some(
      (d) => host === d || host.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

/**
 * Check if a domain is in the trusted list
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isTrustedDomain(url) {
  try {
    const { hostname } = new URL(url);
    return TRUSTED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL for deduplication
 * @param {string} url - URL to extract domain from
 * @returns {string|null} Domain or null if invalid
 */
function extractDomain(url) {
  try {
    const { hostname } = new URL(url);
    const lower = hostname.toLowerCase();
    // For Swiss institutional sites, different subdomains often represent
    // different authorities (e.g., bsv.admin.ch vs estv.admin.ch). Treat
    // the full hostname as the deduplication key.
    const multiTenantRoots = [
      "admin.ch",
      "ge.ch",
      "vd.ch",
      "zh.ch",
      "be.ch",
      "ti.ch",
    ];
    if (
      multiTenantRoots.some((root) => lower === root || lower.endsWith(`.${root}`))
    ) {
      return lower;
    }

    // Default: base domain (e.g., "example.com" from "www.example.com")
    const parts = lower.split(".");
    if (parts.length >= 2) return parts.slice(-2).join(".");
    return lower;
  } catch {
    return null;
  }
}

/**
 * Fetch with timeout and redirect handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    omitDefaultHeaders = false,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const defaultHeaders = omitDefaultHeaders
      ? {}
      : {
          "User-Agent": DEFAULT_USER_AGENT,
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        };
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        ...defaultHeaders,
        ...fetchOptions.headers
      }
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate a single URL
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
async function validateUrl(url, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    minBytes = DEFAULT_MIN_BYTES,
    checkContent = true
  } = options;

  const result = {
    url,
    valid: false,
    status: null,
    statusText: null,
    bodySize: 0,
    contentType: null,
    finalUrl: url,
    error: null,
    reason: null
  };

  // Basic URL validation
  if (!url || typeof url !== "string") {
    result.error = "Invalid URL format";
    result.reason = "invalid-url";
    return result;
  }

  if (!/^https?:\/\//.test(url)) {
    result.error = "URL must start with http:// or https://";
    result.reason = "invalid-protocol";
    return result;
  }

  if (isBlockedDomain(url)) {
    result.error = "Domain is blocked";
    result.reason = "blocked-domain";
    return result;
  }

  try {
    const tryGetWithoutDefaultHeaders = async () => {
      // Some sites return false 404s when we set a UA/Accept header, or when
      // receiving HEAD requests. Retry with a GET and without our defaults.
      const retry = await fetchWithTimeout(url, {
        method: "GET",
        timeout,
        omitDefaultHeaders: true,
      });
      return retry;
    };

    // First try HEAD request to quickly detect hard failures and get metadata.
    // Note: HEAD responses have no body, so if we want to validate content we
    // must follow up with a GET for textual content.
    let usedHead = true;
    let response = await fetchWithTimeout(url, { method: "HEAD", timeout });
    result.status = response.status;
    result.statusText = response.statusText;
    result.finalUrl = response.url;

    // Some servers incorrectly respond 404/410 to HEAD (or to our default headers).
    // Retry with a GET without default headers before marking as not-found.
    if (response.status === 404 || response.status === 410) {
      const retry = await tryGetWithoutDefaultHeaders();
      if (!(retry.status === 404 || retry.status === 410)) {
        response = retry;
        usedHead = false;
        result.status = response.status;
        result.statusText = response.statusText;
        result.finalUrl = response.url;
      } else {
        result.reason = "not-found";
        result.error = `HTTP ${response.status}: ${response.statusText}`;
        return result;
      }
    }

    if (response.status >= 500) {
      result.reason = "server-error";
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    // If HEAD fails with 405/403, try GET
    if (!response.ok || response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(url, { method: "GET", timeout });
      usedHead = false;
      result.status = response.status;
      result.statusText = response.statusText;
      result.finalUrl = response.url;
    }

    // Final status check after potential GET retry. Retry once more without
    // default headers for domains that block/lie to "bot-like" requests.
    if (response.status === 404 || response.status === 410) {
      const retry = await tryGetWithoutDefaultHeaders();
      if (retry.ok) {
        response = retry;
        usedHead = false;
        result.status = response.status;
        result.statusText = response.statusText;
        result.finalUrl = response.url;
      } else {
        result.reason = "not-found";
        result.error = `HTTP ${response.status}: ${response.statusText}`;
        return result;
      }
    }

    if (!response.ok) {
      result.reason = "http-error";
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    // Get content info
    const contentType = response.headers.get("content-type") || "";
    result.contentType = contentType;

    // If we need to validate textual content, ensure we have a GET response body.
    // A successful HEAD would otherwise appear as an empty page (0 bytes).
    const looksTextual = /text|html|json|xml/i.test(contentType);
    if (checkContent && looksTextual && usedHead) {
      response = await fetchWithTimeout(url, { method: "GET", timeout });
      usedHead = false;
      result.status = response.status;
      result.statusText = response.statusText;
      result.finalUrl = response.url;
      result.contentType = response.headers.get("content-type") || contentType;
    }

    // Check content size
    const isTextual = /text|html|json|xml/i.test(result.contentType || "");
    
    if (checkContent && isTextual) {
      const body = await response.text();
      result.bodySize = Buffer.byteLength(body, "utf8");

      // Check for minimum content size
      if (result.bodySize < minBytes) {
        // Be more lenient with trusted domains
        if (!isTrustedDomain(url)) {
          result.reason = "content-too-small";
          result.error = `Body too small: ${result.bodySize} bytes (min: ${minBytes})`;
          return result;
        }
      }

      // Check for empty/placeholder patterns
      const hasEmptyPattern = EMPTY_CONTENT_PATTERNS.some(pattern => pattern.test(body));
      if (hasEmptyPattern) {
        const emptyThreshold = parseInt(process.env.LINK_CHECK_EMPTY_THRESHOLD || "20000", 10);
        if (result.bodySize <= emptyThreshold) {
          result.reason = "empty-content";
          result.error = "Page appears to be empty or placeholder content";
          return result;
        }
      }
    } else {
      // For binary content, use content-length or read body
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        result.bodySize = parseInt(contentLength, 10);
      } else {
        const buffer = await response.arrayBuffer();
        result.bodySize = buffer.byteLength;
      }

      if (result.bodySize < minBytes && !isTrustedDomain(url)) {
        result.reason = "content-too-small";
        result.error = `Content too small: ${result.bodySize} bytes`;
        return result;
      }
    }

    // All checks passed
    result.valid = true;
    return result;

  } catch (err) {
    if (err.name === "AbortError") {
      result.reason = "timeout";
      result.error = `Request timeout after ${timeout}ms`;
    } else {
      result.reason = "network-error";
      result.error = err.message;
    }
    return result;
  }
}

/**
 * Validate multiple references with concurrency control
 * @param {Array<Object>} references - Array of {url, labelKey, ...} objects
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation results
 */
async function validateReferences(references, options = {}) {
  const { concurrency = 4, ...validateOptions } = options;
  const requireTrusted = process.env.REFERENCE_REQUIRE_TRUSTED_DOMAINS === "1";
  const allowedDomains = parseDomainList(process.env.REFERENCE_ALLOWED_DOMAINS);

  if (!Array.isArray(references) || references.length === 0) {
    return { valid: [], invalid: [], stats: { checked: 0, valid: 0, invalid: 0 } };
  }

  const results = [];
  const queue = [...references];
  
  // Process with limited concurrency
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const ref = queue.shift();
      if (!ref || !ref.url) {
        results.push({ ref, result: { valid: false, reason: "missing-url", error: "Reference missing URL" } });
        continue;
      }
      if (isBlockedDomain(ref.url)) {
        results.push({
          ref,
          result: {
            valid: false,
            reason: "blocked-domain",
            error: "Domain is blocked",
          },
        });
        continue;
      }
      if (!isAllowedByList(ref.url, allowedDomains)) {
        results.push({
          ref,
          result: {
            valid: false,
            reason: "domain-not-allowed",
            error: "Domain not in allowlist",
          },
        });
        continue;
      }
      if (requireTrusted && !isTrustedDomain(ref.url)) {
        results.push({
          ref,
          result: {
            valid: false,
            reason: "untrusted-domain",
            error: "Domain not in trusted list",
          },
        });
        continue;
      }
      const result = await validateUrl(ref.url, validateOptions);
      results.push({ ref, result });
    }
  });

  await Promise.all(workers);

  // Separate valid and invalid
  const valid = [];
  const invalid = [];

  for (const { ref, result } of results) {
    if (result.valid) {
      valid.push({ ...ref, _validation: result });
    } else {
      invalid.push({ ...ref, _validation: result });
    }
  }

  return {
    valid,
    invalid,
    stats: {
      checked: results.length,
      valid: valid.length,
      invalid: invalid.length
    }
  };
}

/**
 * Deduplicate references by domain (keep only one per domain)
 * @param {Array<Object>} references - Array of reference objects
 * @returns {Array<Object>} Deduplicated references
 */
function deduplicateByDomain(references) {
  const seenDomains = new Set();
  const unique = [];

  for (const ref of references) {
    const domain = extractDomain(ref.url);
    if (!domain || seenDomains.has(domain)) {
      continue;
    }
    seenDomains.add(domain);
    unique.push(ref);
  }

  return unique;
}

/**
 * Verified Swiss/official fallback references for different topics
 */
const VERIFIED_FALLBACK_REFS = {
  tax: [
    { labelKey: "Administration fédérale des contributions (AFC)", url: "https://www.estv.admin.ch/estv/fr/home.html" },
    { labelKey: "TVA Suisse - Documentation officielle", url: "https://www.estv.admin.ch/estv/fr/home/taxe-sur-la-valeur-ajoutee.html" },
    { labelKey: "Impôts - Portail officiel suisse (ch.ch)", url: "https://www.ch.ch/fr/impots/" },
    { labelKey: "Portail PME - Fiscalité", url: "https://www.kmu.admin.ch/kmu/fr/home/savoir-pratique/finances/impots.html" }
  ],
  payroll: [
    { labelKey: "Office fédéral des assurances sociales (OFAS)", url: "https://www.bsv.admin.ch/bsv/fr/home.html" },
    { labelKey: "Swissdec - Standard de transmission salariale", url: "https://www.swissdec.ch/fr/" }
  ],
  odoo: [
    { labelKey: "Odoo - Documentation officielle", url: "https://www.odoo.com/documentation" },
    { labelKey: "Swissdec - Standard de transmission salariale", url: "https://www.swissdec.ch/fr/" }
  ],
  corporate: [
    { labelKey: "Code des obligations (CO)", url: "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr" },
    { labelKey: "Registre du commerce - Canton de Genève", url: "https://www.ge.ch/organisation/registre-du-commerce" }
  ],
  domiciliation: [
    { labelKey: "Registre du commerce (Zefix)", url: "https://www.zefix.ch/fr/search/entity/welcome" },
    { labelKey: "Code des obligations (CO) - Société anonyme", url: "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr#book_2/tit_26/ch_2" }
  ],
  outsourcing: [
    { labelKey: "Portail PME de la Confédération (PME)", url: "https://www.kmu.admin.ch/kmu/fr/home.html" },
    { labelKey: "Code des obligations - Comptabilité", url: "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr#part_4/tit_32" }
  ],
  ma: [
    { labelKey: "Loi sur la fusion, la scission, la transformation et le transfert de patrimoine (LFus)", url: "https://www.fedlex.admin.ch/eli/cc/2003/218/fr" },
    { labelKey: "Code des obligations (CO)", url: "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr" }
  ],
  "family-office": [
    { labelKey: "FINMA - Autorité fédérale de surveillance", url: "https://www.finma.ch/fr/" },
    { labelKey: "Loi sur le blanchiment d'argent (LBA)", url: "https://www.fedlex.admin.ch/eli/cc/1998/892_892_892/fr" }
  ],
  finance: [
    { labelKey: "Finances - Portail PME", url: "https://www.kmu.admin.ch/kmu/fr/home/savoir-pratique/finances.html" },
    { labelKey: "Financement - Portail PME", url: "https://www.kmu.admin.ch/kmu/fr/home/savoir-pratique/finances/financement.html" }
  ],
  regulatory: [
    { labelKey: "FINMA - Autorité fédérale de surveillance", url: "https://www.finma.ch/fr/" },
    { labelKey: "Loi sur le blanchiment d'argent (LBA)", url: "https://www.fedlex.admin.ch/eli/cc/1998/892_892_892/fr" }
  ],
  accounting: [
    { labelKey: "Swiss GAAP FER", url: "https://www.fer.ch/fr/" },
    { labelKey: "Code des obligations - Comptabilité", url: "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr#part_4/tit_32" }
  ],
  incorporation: [
    { labelKey: "Créer une entreprise - Portail PME", url: "https://www.kmu.admin.ch/kmu/fr/home/savoir-pratique/creation-pme.html" },
    { labelKey: "Registre du commerce - Guide fédéral", url: "https://www.zefix.ch/fr/search/entity/welcome" }
  ],
  general: [
    { labelKey: "Portail PME de la Confédération", url: "https://www.kmu.admin.ch/kmu/fr/home.html" },
    { labelKey: "Economiesuisse", url: "https://www.economiesuisse.ch/fr" }
  ]
};

/**
 * Get verified fallback references for a topic category
 * @param {string} category - Topic category
 * @returns {Array<Object>} Verified references
 */
function getFallbackReferences(category = "general") {
  return VERIFIED_FALLBACK_REFS[category] || VERIFIED_FALLBACK_REFS.general;
}

module.exports = {
  validateUrl,
  validateReferences,
  deduplicateByDomain,
  extractDomain,
  isTrustedDomain,
  getFallbackReferences,
  VERIFIED_FALLBACK_REFS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MIN_BYTES
};
