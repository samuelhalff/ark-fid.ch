#!/bin/bash

# Copy all pages to [locale] and update their metadata generation
cd /home/sam/ark-fid.ch

# List of pages to copy (excluding already done ones)
pages=(
  "team/page.tsx"
  "ressources/page.tsx"
  "ressources/articles/[slug]/page.tsx"
  "services/page.tsx"
  "services/accounting/page.tsx"
  "services/corporate/page.tsx"
  "services/domiciliation/page.tsx"
  "services/odoo/page.tsx"
  "services/outsourcing/page.tsx"
  "services/payroll/page.tsx"
  "services/taxes/page.tsx"
  "legal/cookies/page.tsx"
  "legal/privacy/page.tsx"
  "legal/terms/page.tsx"
)

for page in "${pages[@]}"; do
  echo "Processing $page..."
  
  # Create directory if it doesn't exist
  dir=$(dirname "app/[locale]/$page")
  mkdir -p "$dir"
  
  # Copy the original page
  cp "app/$page" "app/[locale]/$page"
  
  echo "Copied $page"
done

echo "All pages copied!"
