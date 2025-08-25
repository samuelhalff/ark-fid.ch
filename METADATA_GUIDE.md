# Metadata Implementation Guide

## Files Updated with Centralized Metadata

✅ **Completed:**

- `/app/page.tsx` - Home page
- `/app/about/page.tsx` - About page
- `/app/contact/page.tsx` - Contact page
- `/app/team/page.tsx` - Team page
- `/app/services/accounting/page.tsx` - Accounting services
- `/app/services/corporate/page.tsx` - Corporate services
- `/app/ressources/articles/[slug]/page.tsx` - Dynamic articles

## Remaining Pages to Update

To add metadata to the remaining service pages, add these imports and export to each file:

```tsx
import { Metadata } from "next";
import { generateMetadataForPage } from "@/src/lib/metadata";

export const metadata: Metadata = generateMetadataForPage(
  "/services/[service-name]"
);
```

### Service Pages:

- `/app/services/domiciliation/page.tsx` → `generateMetadataForPage("/services/domiciliation")`
- `/app/services/odoo/page.tsx` → `generateMetadataForPage("/services/odoo")`
- `/app/services/outsourcing/page.tsx` → `generateMetadataForPage("/services/outsourcing")`
- `/app/services/payroll/page.tsx` → `generateMetadataForPage("/services/payroll")`
- `/app/services/taxes/page.tsx` → `generateMetadataForPage("/services/taxes")`

### Other Pages:

- `/app/partners/page.tsx` → `generateMetadataForPage("/partners")`
- `/app/ressources/page.tsx` → `generateMetadataForPage("/ressources")`

### Legal Pages:

- `/app/legal/privacy/page.tsx` → `generateMetadataForPage("/legal/privacy")`
- `/app/legal/terms/page.tsx` → `generateMetadataForPage("/legal/terms")`
- `/app/legal/cookies/page.tsx` → `generateMetadataForPage("/legal/cookies")`

## How to Update Metadata

## Benefits

- ✅ **Centralized management:** All metadata in one JSON file
- ✅ **SEO optimized:** Proper titles, descriptions, Open Graph, Twitter cards
- ✅ **Consistent structure:** Template-based approach for dynamic pages
- ✅ **Easy updates:** Change one file to update site-wide metadata
- ✅ **Type safety:** TypeScript interfaces for metadata structure
