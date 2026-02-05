"use strict";
/**
 * Reference URL validator module.
 * Validates external links before including them in articles.
 *
 * Features:
 * - HEAD/GET requests with timeout
 * - 404/410 detection
 * - Empty/placeholder content detection
 * - Redirect following
 * - Domain deduplication
 * - Batch validation with concurrency control
 */

const DEFAULT_TIMEOUT_MS = parseInt(process.env.LINK_CHECK_TIMEOUT_MS || "10000", 10);
const DEFAULT_MIN_BYTES = parseInt(process.env.LINK_CHECK_MIN_BYTES || "600", 10);
const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; ArkFiduciaire/1.0; +https://ark-fid.ch)";
const MAX_REDIRECTS = 5;

// Patterns that indicate empty/placeholder content
const EMPTY_CONTENT_PATTERNS = [
  /page\s*not\s*found/i,
  /404\s*error/i,
  /content\s*unavailable/i,
  /this\s*page\s*doesn't\s*exist/i,
  /cette\s*page\s*n'existe\s*pas/i,
  /seite\s*nicht\s*gefunden/i,
  /pagina\s*no\s*encontrada/i,
  /página\s*não\s*encontrada/i,
  /under\s*construction/i,
  /coming\s*soon/i,
  /placeholder/i,
  /lorem\s*ipsum/i
];

// Trusted source domains (less strict validation)
const TRUSTED_DOMAINS = [
  "admin.ch",
  "fedlex.admin.ch",
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
  "github.com",
  "wikipedia.org"
];

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
    // Get base domain (e.g., "example.com" from "www.example.com")
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return hostname;
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
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

  try {
    // First try HEAD request
    let response = await fetchWithTimeout(url, { method: "HEAD", timeout });
    result.status = response.status;
    result.statusText = response.statusText;
    result.finalUrl = response.url;

    // Check for hard failures
    if (response.status === 404 || response.status === 410) {
      result.reason = "not-found";
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    if (response.status >= 500) {
      result.reason = "server-error";
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    // If HEAD fails with 405/403, try GET
    if (!response.ok || response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(url, { method: "GET", timeout });
      result.status = response.status;
      result.statusText = response.statusText;
      result.finalUrl = response.url;
    }

    // Final status check after potential GET retry
    if (response.status === 404 || response.status === 410) {
      result.reason = "not-found";
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    if (!response.ok) {
      result.reason = "http-error";
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    // Get content info
    const contentType = response.headers.get("content-type") || "";
    result.contentType = contentType;

    // Check content size
    const isTextual = /text|html|json|xml/i.test(contentType);
    
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
      if (hasEmptyPattern && !isTrustedDomain(url)) {
        result.reason = "empty-content";
        result.error = "Page appears to be empty or placeholder content";
        return result;
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
    { labelKey: "Administration fédérale des contributions (AFC)", url: "https://www.estv.admin.ch/estv/fr/accueil.html" },
    { labelKey: "TVA Suisse - Documentation officielle", url: "https://www.estv.admin.ch/estv/fr/accueil/taxe-sur-la-valeur-ajoutee.html" }
  ],
  payroll: [
    { labelKey: "Office fédéral des assurances sociales (OFAS)", url: "https://www.bsv.admin.ch/bsv/fr/home.html" },
    { labelKey: "Swissdec - Standard de transmission salariale", url: "https://www.swissdec.ch/fr/" }
  ],
  corporate: [
    { labelKey: "Code des obligations (CO)", url: "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr" },
    { labelKey: "Registre du commerce - Canton de Genève", url: "https://www.ge.ch/organisation/registre-du-commerce" }
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
