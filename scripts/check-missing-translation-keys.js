#!/usr/bin/env node

/**
 * Scans the codebase for translation lookups (`getTranslations`) that use
 * string literal keys and verifies that those keys exist in every locale.
 *
 * Limitations:
 *  - Dynamic key usages such as `t(prefix + key)` or `t(variable)` are skipped.
 *  - Only string literal keys are validated.
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = process.cwd();
const TRANSLATIONS_ROOT = path.join(PROJECT_ROOT, "src", "translations");
const SCAN_DIRECTORIES = ["app", "src"];
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function getLocales() {
  if (!fs.existsSync(TRANSLATIONS_ROOT)) {
    console.error("Translations directory not found at", TRANSLATIONS_ROOT);
    process.exitCode = 1;
    return [];
  }
  return fs
    .readdirSync(TRANSLATIONS_ROOT)
    .filter((entry) =>
      fs.statSync(path.join(TRANSLATIONS_ROOT, entry)).isDirectory()
    )
    .sort();
}

function collectFiles() {
  const files = [];
  for (const dir of SCAN_DIRECTORIES) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;
    walk(fullDir, files);
  }
  return files;
}

function walk(directory, results) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // Skip heavy or irrelevant directories just in case.
      if (["node_modules", ".next", "tmp", "tmp-audit"].includes(entry.name)) {
        continue;
      }
      walk(fullPath, results);
    } else if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
}

function flatten(obj, prefix = "", target = {}) {
  if (!obj || typeof obj !== "object") {
    return target;
  }
  for (const [key, value] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, nextKey, target);
    } else {
      target[nextKey] = true;
    }
  }
  return target;
}

const namespaceCache = new Map();

function getNamespace(locale, namespace) {
  const cacheKey = `${locale}:${namespace}`;
  if (namespaceCache.has(cacheKey)) {
    return namespaceCache.get(cacheKey);
  }
  const filePath = path.join(TRANSLATIONS_ROOT, locale, `${namespace}.json`);
  if (!fs.existsSync(filePath)) {
    namespaceCache.set(cacheKey, null);
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    const flat = flatten(data);
    namespaceCache.set(cacheKey, flat);
    return flat;
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error.message);
    process.exit(1);
  }
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function analyzeFile(filePath, usageMap) {
  const source = fs.readFileSync(filePath, "utf8");
  const translationVarRegex =
    /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?getTranslations\s*\(\s*[^,]+,\s*(["'`])([^"'`]+)\2\s*\)/g;

  const variableToNamespace = new Map();
  let match;

  while ((match = translationVarRegex.exec(source)) !== null) {
    const [, variableName, , namespace] = match;
    variableToNamespace.set(variableName, namespace);
  }

  if (!variableToNamespace.size) {
    return;
  }

  for (const [variableName, namespace] of variableToNamespace.entries()) {
    const callRegex = new RegExp(
      `\\b${escapeRegExp(variableName)}\\(\\s*(['"])([^'"\\n]+?)\\1`,
      "g"
    );
    let callMatch;
    while ((callMatch = callRegex.exec(source)) !== null) {
      const rawKey = callMatch[2];
      if (!rawKey || rawKey.includes("${")) {
        continue; // skip template literals / interpolated strings
      }
      const key = rawKey.trim();
      if (!key) continue;
      if (!usageMap.has(namespace)) {
        usageMap.set(namespace, new Set());
      }
      usageMap.get(namespace).add(key);
    }
  }
}

function main() {
  const locales = getLocales();
  if (!locales.length) {
    console.error("No locales found in src/translations.");
    process.exit(1);
  }

  const files = collectFiles();
  const namespaceUsage = new Map(); // namespace -> Set(keys)

  for (const file of files) {
    analyzeFile(file, namespaceUsage);
  }

  if (!namespaceUsage.size) {
    console.log("No translation usages with string literal keys were detected.");
    return;
  }

  const missing = [];

  for (const [namespace, keys] of namespaceUsage.entries()) {
    for (const key of keys) {
      for (const locale of locales) {
        const flat = getNamespace(locale, namespace);
        if (!flat || !flat[key]) {
          missing.push({ locale, namespace, key });
        }
      }
    }
  }

  if (!missing.length) {
    console.log("All detected translation keys have values across locales.");
  } else {
    console.error(`Translation keys missing (${missing.length}):`);
    for (const item of missing) {
      console.error(` - [${item.locale}] ${item.namespace}: ${item.key}`);
    }
    process.exitCode = 1;
  }
}

main();
