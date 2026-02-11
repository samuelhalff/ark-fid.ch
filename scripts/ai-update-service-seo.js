"use strict";

const fs = require("fs");
const path = require("path");

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DRY = args.has("--dry-run");
const MAX_UPDATES = parseInt(process.env.SEO_SUGGEST_MAX_UPDATES || "6", 10);
const DRIFT_RATIO = parseFloat(process.env.SEO_SUGGEST_DRIFT_RATIO || "0.4");

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_API_VERSION =
  process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview";
const AZURE_OPENAI_DEPLOYMENT =
  process.env.AZURE_OPENAI_DEPLOYMENT ||
  process.env.AZURE_OPENAI_DRAFT_DEPLOYMENT ||
  "gpt-4.1";

const LOCALES = ["fr", "en", "de", "es", "pt"];
const SERVICE_PATHS = {
  accounting: "/services/accounting",
  taxes: "/services/taxes",
  payroll: "/services/payroll",
  corporate: "/services/corporate",
  domiciliation: "/services/domiciliation",
  incorporation: "/services/incorporation",
  outsourcing: "/services/outsourcing",
  mna: "/services/mergers-acquisitions",
  odoo: "/services/odoo",
  "family-office": "/services/family-office",
  immigration: "/services/immigration",
};
const PATH_TO_SERVICE = Object.fromEntries(
  Object.entries(SERVICE_PATHS).map(([key, value]) => [value, key]),
);

const SEO_SECTION_TITLES = {
  fr: "Intentions de recherche",
  en: "Search intent snapshot",
  de: "Suchintention im Überblick",
  es: "Intención de búsqueda",
  pt: "Intenção de pesquisa",
};

const BASELINE_PATH = path.join(__dirname, "seo-suggest-baseline.json");
const LATEST_PATH = path.join(__dirname, "seo-suggest-latest.json");

function normalizeList(list) {
  return list.map((item) => item.toLowerCase().trim());
}

function compareSuggestions(baseline, current) {
  const baseSet = new Set(normalizeList(baseline));
  const currentSet = new Set(normalizeList(current));
  const intersection = [...currentSet].filter((item) => baseSet.has(item));
  const ratio = baseSet.size === 0 ? 1 : 1 - intersection.length / baseSet.size;
  return { ratio };
}

function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function detectIndent(content) {
  const match = content.match(/\n(\s+)"/);
  if (match && match[1]) return match[1].length;
  return 2;
}

async function azureChatJson(prompt, locale) {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    throw new Error("Missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY");
  }
  const base = AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "");
  const url = `${base}/openai/deployments/${encodeURIComponent(
    AZURE_OPENAI_DEPLOYMENT,
  )}/chat/completions?api-version=${encodeURIComponent(
    AZURE_OPENAI_API_VERSION,
  )}`;

  const system =
    "You are a careful multilingual SEO copywriter for a Swiss fiduciary firm. " +
    "Return JSON only. Keep the tone simple, professional, and human. " +
    "Avoid unnecessary capital letters. Do not mention asset management or regulated investment services.";

  const user = `Language: ${locale}.\n${prompt}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure OpenAI error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Missing response content");
  return JSON.parse(content);
}

async function run() {
  if (!fs.existsSync(BASELINE_PATH) || !fs.existsSync(LATEST_PATH)) {
    console.log("⚠️ Missing SEO suggest baseline or latest snapshot. Skipping.");
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const latest = JSON.parse(fs.readFileSync(LATEST_PATH, "utf8"));

  const updates = [];

  for (const locale of LOCALES) {
    const latestLocale = latest.results?.[locale] || {};
    for (const [pathKey, seeds] of Object.entries(latestLocale)) {
      const serviceKey = PATH_TO_SERVICE[pathKey];
      if (!serviceKey) continue;

      for (const [seed, providerData] of Object.entries(seeds)) {
        const baseProvider =
          baseline.results?.[locale]?.[pathKey]?.[seed] || null;
        if (!baseProvider) continue;

        const googleRatio = compareSuggestions(
          baseProvider.google || [],
          providerData.google || [],
        ).ratio;
        const bingRatio = compareSuggestions(
          baseProvider.bing || [],
          providerData.bing || [],
        ).ratio;

        if (googleRatio < DRIFT_RATIO && bingRatio < DRIFT_RATIO) continue;

        updates.push({
          locale,
          pathKey,
          serviceKey,
          seed,
          suggestions: uniq([
            ...(providerData.google || []),
            ...(providerData.bing || []),
          ]).slice(0, 8),
        });
      }
    }
  }

  if (updates.length === 0) {
    console.log("✅ No SEO drift updates required.");
    return;
  }

  const limitedUpdates = updates.slice(0, MAX_UPDATES);
  console.log(`🔎 Preparing ${limitedUpdates.length} SEO updates...`);

  for (const update of limitedUpdates) {
    const translationPath = path.join(
      process.cwd(),
      "src",
      "translations",
      update.locale,
      `${update.serviceKey}.json`,
    );
    const metadataPath = path.join(
      process.cwd(),
      "src",
      "translations",
      update.locale,
      "metadata.json",
    );

    const translationRaw = fs.readFileSync(translationPath, "utf8");
    const indent = detectIndent(translationRaw);
    const translation = JSON.parse(translationRaw);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    const currentKeywords =
      metadata.pages?.[update.pathKey]?.keywords || "";

    const prompt = `Service: ${update.serviceKey}\nHero title: ${
      translation?.Hero?.Title || ""
    }\nPresentation title: ${
      translation?.Presentation?.Title || ""
    }\nCurrent keywords: ${currentKeywords}\nNew search suggestions: ${update.suggestions.join(
      ", ",
    )}\n\nTask:\n1) Provide an updated comma-separated keywords string that keeps at least 4 existing keywords and adds up to 5 relevant suggestions.\n2) Provide 4 short paragraphs (90-120 words each) in the same language to refresh a section titled "${
      SEO_SECTION_TITLES[update.locale]
    }".\nReturn JSON: {"keywords":"...", "sectionBody":["...","...","...","..."]}`;

    let response;
    try {
      response = await azureChatJson(prompt, update.locale);
    } catch (error) {
      console.log(
        `⚠️ Azure update failed for ${update.locale} ${update.serviceKey}: ${error.message}`,
      );
      continue;
    }

    const newKeywords = (response?.keywords || "").trim();
    const sectionBody = Array.isArray(response?.sectionBody)
      ? response.sectionBody
      : [];

    if (!newKeywords || sectionBody.length < 2) {
      console.log(
        `⚠️ Azure response incomplete for ${update.locale} ${update.serviceKey}. Skipping.`,
      );
      continue;
    }

    if (!translation.Presentation) translation.Presentation = {};
    if (!Array.isArray(translation.Presentation.LongFormSections)) {
      translation.Presentation.LongFormSections = [];
    }

    const sectionTitle = SEO_SECTION_TITLES[update.locale];
    const sections = translation.Presentation.LongFormSections;
    const index = sections.findIndex(
      (section) => section?.Title === sectionTitle,
    );

    const nextSection = {
      Title: sectionTitle,
      Body: sectionBody,
    };

    if (index >= 0) {
      sections[index] = nextSection;
    } else {
      sections.push(nextSection);
    }

    metadata.pages = metadata.pages || {};
    metadata.pages[update.pathKey] = metadata.pages[update.pathKey] || {};
    metadata.pages[update.pathKey].keywords = newKeywords;

    if (DRY) {
      console.log(
        `[dry-run] ${update.locale} ${update.serviceKey}: keywords -> ${newKeywords}`,
      );
      continue;
    }

    if (APPLY) {
      fs.writeFileSync(
        translationPath,
        JSON.stringify(translation, null, indent) + "\n",
        "utf8",
      );
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2) + "\n",
        "utf8",
      );
      console.log(
        `✅ Updated ${update.locale} ${update.serviceKey} SEO section and keywords.`,
      );
    }
  }
}

run().catch((error) => {
  console.error("❌ SEO update failed:", error.message);
  process.exit(0);
});
