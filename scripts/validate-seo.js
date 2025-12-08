#!/usr/bin/env node
/**
 * SEO Validation Script (Non-blocking)
 * Validates sitemap format and URL consistency
 * Always exits with code 0 to not block CI
 */

const fs = require('fs');
const path = require('path');

let warnings = 0;
let errors = 0;

function warn(msg) {
  console.warn('⚠️  WARNING:', msg);
  warnings++;
}

function error(msg) {
  console.error('❌ ERROR:', msg);
  errors++;
}

function success(msg) {
  console.log('✅', msg);
}

// Check next.config.js for trailingSlash setting
function checkTrailingSlashConfig() {
  try {
    const configPath = path.join(process.cwd(), 'next.config.js');
    const content = fs.readFileSync(configPath, 'utf8');
    if (content.includes('trailingSlash: true')) {
      success('next.config.js has trailingSlash: true');
      return true;
    } else {
      warn('next.config.js does not have trailingSlash: true');
      return false;
    }
  } catch (e) {
    error('Could not read next.config.js: ' + e.message);
    return false;
  }
}

// Check sitemap route file for trailing slash in URLs
function checkSitemapRoute() {
  try {
    const sitemapPath = path.join(process.cwd(), 'app', 'sitemap.xml', 'route.ts');
    const content = fs.readFileSync(sitemapPath, 'utf8');
    
    // The sitemap generates URLs like: const loc = `${BASE}/${locale}${localized}`
    // Since localizePath removes trailing slashes, and the config has trailingSlash: true,
    // we should check if trailing slashes are explicitly added in the sitemap generation.
    // Note: Next.js may handle this automatically based on trailingSlash config,
    // but for explicit SEO compliance, URLs should have trailing slashes in the sitemap.
    
    if (content.match(/const loc = [`"].*\$\{.*\}[`"][\s;]/)) {
      // Check if there's an explicit trailing slash before the closing quote
      if (content.match(/\$\{[^}]+\}\/[`"]/) || content.includes("+ '/'")) {
        success('Sitemap route explicitly adds trailing slashes to URLs');
      } else {
        warn('Sitemap route does not explicitly add trailing slashes to generated URLs. Next.js may handle this based on trailingSlash config, but explicit trailing slashes in sitemap XML are recommended for SEO.');
      }
    } else {
      success('Sitemap route structure checked');
    }
    
    return true;
  } catch (e) {
    error('Could not read sitemap route: ' + e.message);
    return false;
  }
}

// Main
console.log('\n🔍 SEO Configuration Validation\n');
console.log('='.repeat(50));

checkTrailingSlashConfig();
checkSitemapRoute();

console.log('='.repeat(50));
console.log(`\nSummary: ${errors} errors, ${warnings} warnings\n`);

// Always exit 0 to not block CI
process.exit(0);
