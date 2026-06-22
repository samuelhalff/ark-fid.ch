const fs = require("fs");
const path = require("path");

const root = process.cwd();
const locales = ["fr", "en"];
const serviceNamespaces = [
  "accounting",
  "taxes",
  "payroll",
  "domiciliation",
  "incorporation",
  "odoo",
  "outsourcing",
  "corporate",
  "family-office",
  "mna",
];

const requiredMetadataTitles = {
  fr: {
    "/": "Fiduciaire à Genève pour PME, fiscalité, comptabilité et Odoo | Ark Fiduciaire",
    "/services": "Services fiduciaires à Genève | Comptabilité, fiscalité, paie, domiciliation",
    "/services/accounting": "Comptabilité à Genève pour PME suisses | Ark Fiduciaire",
    "/services/taxes": "Fiscalité à Genève pour sociétés et entrepreneurs | Ark Fiduciaire",
    "/services/payroll": "Gestion des salaires en Suisse romande | Ark Fiduciaire",
    "/services/domiciliation": "Domiciliation d’entreprise à Genève | Ark Fiduciaire",
    "/services/incorporation": "Création de SA ou Sàrl à Genève | Ark Fiduciaire",
    "/services/odoo": "Implémentation Odoo comptable en Suisse | Ark Fiduciaire",
    "/services/family-office": "Family office administratif en Suisse romande | Ark Fiduciaire",
  },
  en: {
    "/": "Fiduciary Services in Geneva for SMEs, Tax, Accounting and Odoo | Ark Fiduciaire",
    "/services": "Fiduciary Services in Geneva | Accounting, Tax, Payroll, Domiciliation",
    "/services/accounting": "Accounting in Geneva for Swiss SMEs | Ark Fiduciaire",
    "/services/taxes": "Tax Advice in Geneva for Companies and Entrepreneurs | Ark Fiduciaire",
    "/services/payroll": "Swiss Payroll Services in Romandy | Ark Fiduciaire",
    "/services/domiciliation": "Business Domiciliation in Geneva | Ark Fiduciaire",
    "/services/incorporation": "Company Incorporation in Geneva, SA or Sàrl | Ark Fiduciaire",
    "/services/odoo": "Odoo Accounting Implementation in Switzerland | Ark Fiduciaire",
    "/services/family-office": "Administrative Family Office in Switzerland | Ark Fiduciaire",
  },
};

const failures = [];
const warnings = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function addFailure(message) {
  failures.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function walkStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => walkStrings(item, out));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => walkStrings(item, out));
  }
  return out;
}

function normalizedParagraphs(json) {
  return walkStrings(json)
    .map((text) =>
      text
        .replace(/\s+/g, " ")
        .replace(/[“”]/g, '"')
        .trim()
        .toLowerCase(),
    )
    .filter((text) => text.length >= 120);
}

function checkRobots() {
  if (!exists("public/robots.txt")) {
    addFailure("public/robots.txt is missing");
    return;
  }
  const robots = read("public/robots.txt");
  if (!/^Sitemap:\s*https:\/\/ark-fid\.ch\/sitemap\.xml\s*$/m.test(robots)) {
    addFailure("robots.txt must reference https://ark-fid.ch/sitemap.xml");
  }
  if (/^Disallow:\s*\/\s*$/m.test(robots)) {
    addFailure("production robots.txt must not contain Disallow: /");
  }
  if (/^Disallow:\s*\/assets\/\s*$/m.test(robots)) {
    addFailure("robots.txt must not block public assets used by marketing pages");
  }
}

function checkSitemapSource() {
  const sitemap = read("app/sitemap.xml/route.ts");
  [
    '"/ai-profile"',
    '"/services/accounting"',
    '"/services/odoo"',
    '"/services/family-office"',
  ].forEach((needle) => {
    if (!sitemap.includes(needle)) {
      addFailure(`sitemap source is missing ${needle}`);
    }
  });
}

function checkLlms() {
  if (!exists("public/llms.txt")) {
    addFailure("public/llms.txt is missing");
    return;
  }
  const llms = read("public/llms.txt");
  ["/fr/ai-profile/", "/en/ai-profile/", "/fr/services/comptabilite/", "/en/services/odoo/"].forEach(
    (needle) => {
      if (!llms.includes(needle)) addFailure(`llms.txt is missing ${needle}`);
    },
  );
  if (/discretionary asset management/i.test(llms) === false) {
    addFailure("llms.txt must clarify discretionary asset management limitation");
  }
}

function checkAiProfileRoutes() {
  if (!exists("app/[locale]/ai-profile/page.tsx")) {
    addFailure("localized AI profile route is missing");
  }
  if (!exists("src/translations/fr/ai-profile.json")) {
    addFailure("French AI profile content is missing");
  }
  if (!exists("src/translations/en/ai-profile.json")) {
    addFailure("English AI profile content is missing");
  }
}

function checkMetadata() {
  for (const locale of locales) {
    const metadata = JSON.parse(read(`src/translations/${locale}/metadata.json`));
    const titles = new Map();
    for (const [route, expectedTitle] of Object.entries(requiredMetadataTitles[locale])) {
      const actualTitle = metadata.pages?.[route]?.title;
      if (actualTitle !== expectedTitle) {
        addFailure(`${locale} metadata title for ${route} is "${actualTitle}", expected "${expectedTitle}"`);
      }
    }
    for (const [route, page] of Object.entries(metadata.pages || {})) {
      if (!page.title) addWarning(`${locale} metadata title missing for ${route}`);
      if (!page.description) addWarning(`${locale} metadata description missing for ${route}`);
      if (page.title) {
        const seen = titles.get(page.title);
        if (seen) addWarning(`${locale} duplicate metadata title "${page.title}" for ${seen} and ${route}`);
        titles.set(page.title, route);
      }
      if (page.description && page.description.length > 170) {
        addWarning(`${locale} metadata description over 170 chars for ${route}`);
      }
    }
  }
}

function checkDuplicateServiceParagraphs() {
  for (const locale of locales) {
    for (const ns of serviceNamespaces) {
      const json = JSON.parse(read(`src/translations/${locale}/${ns}.json`));
      const counts = new Map();
      for (const paragraph of normalizedParagraphs(json)) {
        counts.set(paragraph, (counts.get(paragraph) || 0) + 1);
      }
      const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
      if (duplicates.length > 0) {
        addFailure(`${locale}/${ns}.json contains ${duplicates.length} repeated long paragraph(s)`);
      }
    }
  }
}

function checkStructuredDataSource() {
  const metadataSource = read("src/lib/metadata.ts");
  if (/aggregateRating/.test(metadataSource)) {
    addFailure("src/lib/metadata.ts must not emit unverifiable aggregateRating schema");
  }
  for (const rel of listSourceFiles(["app", "src"])) {
    const source = read(rel);
    if (/aggregateRating/.test(source)) {
      addFailure(`${rel} must not emit aggregateRating schema without verified public ratings`);
    }
    if (/reviewCount/.test(source)) {
      addFailure(`${rel} must not emit reviewCount schema without verified public ratings`);
    }
  }
  const structuredSource = read("src/lib/structuredData.ts");
  ["buildOrganizationGraph", "buildPersonSchema", "buildArticleSchema"].forEach((name) => {
    if (!structuredSource.includes(name)) {
      addFailure(`structured data helper ${name} is missing`);
    }
  });
}

function listSourceFiles(dirs) {
  const files = [];
  const exts = new Set([".ts", ".tsx"]);
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    const stack = [abs];
    while (stack.length) {
      const current = stack.pop();
      const stat = fs.statSync(current);
      if (stat.isDirectory()) {
        for (const child of fs.readdirSync(current)) {
          if (child === "node_modules" || child === ".next") continue;
          stack.push(path.join(current, child));
        }
      } else if (exts.has(path.extname(current))) {
        files.push(path.relative(root, current));
      }
    }
  }
  return files;
}

checkRobots();
checkSitemapSource();
checkLlms();
checkAiProfileRoutes();
checkMetadata();
checkDuplicateServiceParagraphs();
checkStructuredDataSource();

for (const warning of warnings) {
  console.warn(`SEO warning: ${warning}`);
}

if (failures.length > 0) {
  console.error("SEO/GEO check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("SEO/GEO check passed");
