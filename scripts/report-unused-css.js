#!/usr/bin/env node

const { PurgeCSS } = require("purgecss");
const fs = require("fs");
const path = require("path");

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const cssPath = path.resolve(projectRoot, "public/assets/css/non-critical.css");

  if (!fs.existsSync(cssPath)) {
  console.error(`CSS file not found at ${cssPath}`);
    process.exitCode = 1;
    return;
  }

  const originalCss = fs.readFileSync(cssPath, "utf8");
  const originalSize = Buffer.byteLength(originalCss, "utf8");

  const purgeCSSResult = await new PurgeCSS().purge({
    css: [cssPath],
    content: [
      path.resolve(projectRoot, "app/**/*.{js,jsx,ts,tsx,mdx}"),
      path.resolve(projectRoot, "src/**/*.{js,jsx,ts,tsx,mdx}"),
      path.resolve(projectRoot, "components/**/*.{js,jsx,ts,tsx,mdx}"),
      path.resolve(projectRoot, "pages/**/*.{js,jsx,ts,tsx,mdx}"),
    ],
    safelist: {
      standard: [/^critical-/],
    },
    rejected: true,
  });

  const [{ css, rejected = [] }] = purgeCSSResult;
  const purgedSize = Buffer.byteLength(css, "utf8");
  const bytesSaved = originalSize - purgedSize;
  const percentSaved = originalSize > 0 ? (bytesSaved / originalSize) * 100 : 0;

  const formattedOriginal = formatBytes(originalSize);
  const formattedPurged = formatBytes(purgedSize);
  const formattedSaved = formatBytes(bytesSaved);

  console.log("CSS Coverage Report");
  console.log("====================\n");
  console.log(`Source: ${path.relative(projectRoot, cssPath)}`);
  console.log(`Original size: ${formattedOriginal}`);
  console.log(`After purge: ${formattedPurged}`);
  console.log(`Potential savings: ${formattedSaved} (${percentSaved.toFixed(2)}%)\n`);

  if (!rejected.length) {
    console.log("No unused selectors detected by PurgeCSS.");
    return;
  }

  const usageCount = buildFrequencyMap(rejected);
  const sortedSelectors = Object.entries(usageCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log("Top unused selectors");
  console.log("----------------------");
  sortedSelectors.forEach(([selector, count]) => {
    console.log(`${selector} (missed ${count} template${count > 1 ? "s" : ""})`);
  });
  console.log("\nTip: review these selectors to confirm they are safe to remove or move behind conditional loading.");
}

function buildFrequencyMap(selectors) {
  return selectors.reduce((acc, selector) => {
    const key = selector.trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function formatBytes(bytes) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value < 10 && exponent > 0 ? 2 : 1)} ${units[exponent]}`;
}

main().catch((error) => {
  console.error("Failed to analyse CSS coverage:");
  console.error(error);
  process.exitCode = 1;
});
