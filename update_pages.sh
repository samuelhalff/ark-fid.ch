#!/bin/bash

# Update all copied pages to support locale parameter
cd /home/sam/ark-fid.ch/app/[locale]

# Function to update a page file
update_page() {
    local file="$1"
    echo "Updating $file..."
    
    # Backup original
    cp "$file" "$file.bak"
    
    # Add Locale import if not present
    if ! grep -q "import.*Locale.*from.*@/src/lib/i18n" "$file"; then
        sed -i '1i import { type Locale } from "@/src/lib/i18n";' "$file"
    fi
    
    # Update generateMetadata function
    sed -i 's/export async function generateMetadata(): Promise<Metadata>/export async function generateMetadata({\n  params: { locale }\n}: {\n  params: { locale: string }\n}): Promise<Metadata>/' "$file"
    
    # Update generateMetadataForPage calls
    sed -i 's/generateMetadataForPage("/generateMetadataForPage(locale as Locale, "/' "$file"
    
    # Update default export function to accept locale parameter
    sed -i 's/export default function \([^(]*\)()/export default function \1({\n  params: { locale }\n}: {\n  params: { locale: string }\n})/' "$file"
    
    echo "Updated $file"
}

# Find all page.tsx files and update them
find . -name "page.tsx" -type f | while read file; do
    update_page "$file"
done

echo "All pages updated!"
