# Ark Fiduciaire Mockup Brief

This pass is meant to improve the mockups as prompt material, not to produce final production HTML. Reuse the structure, hierarchy, copy direction and SEO intent from these files, but re-implement everything properly in JSX/Tailwind/components inside `samuelhalff/ark-fid.ch`.

## What changed in the mockups

- Home, team, contact, resources and article pages now use page titles/descriptions closer to the current repo metadata.
- The team page now references real people and real portrait asset URLs instead of placeholder initials.
- The home hero and content framing were shifted toward the current Ark positioning instead of generic agency language.
- The agent page language is now more conservative and easier to implement honestly.
- Shared nav spacing was tightened to reduce line-break risk before the mobile breakpoint.

## Content guardrails for the future prompt

- This redesign prompt must be conservative by default: change visual design first, and only adjust copy/content where the source of truth is clear in the current repo or explicitly agreed.
- Stay close to current `ark-fid.ch` content and service taxonomy.
- Use current wording from the repo as the default source of truth, especially `src/translations/fr/home.json`, `src/translations/fr/team.json`, `src/translations/fr/contact.json` and `src/translations/fr/metadata.json`.
- Avoid invented dates, growth claims, response-time promises or deployment counts unless they already exist in the real repo/content source.
- Avoid invented prices, fee examples, monthly amounts, case-budget anchors or hard-coded honoraires unless they already exist clearly in the real repo/content source and are intentionally approved.
- Preserve the existing testimonials already present in the repo rather than inventing new social proof.
- Do not assume a newsletter exists unless you decide to add it for real.
- Keep the service-detail template, but swap the example content to a service that definitely exists in the live repo before implementation.
- Use only the approved regulatory framing around `OAR / SRO`; do not introduce alternative regulatory labels unless explicitly requested and legally validated.

## Functional preservation rules

- Do not remove, bypass or simplify existing business logic, SEO work, structured data, routing behavior, analytics hooks, or conversion flows just because the redesign introduces a new layout.
- Treat the current repo as an optimized production baseline that has been refined over months; preserve substance unless a change is clearly requested and validated.
- The instant quote flow must keep its existing functional protections and integrations from the current site, including the current Cloudflare/form protection layer and the real submission flow. Redesign the UI around it, but do not replace it with a mock/static form or a weaker interaction model.
- The instant quote flow is the right place for pricing output. Do not scatter new hard-coded prices across marketing pages when the current product already centralizes estimates in the quote journey.
- Reuse existing components, APIs, validation, tracking, metadata and protection mechanisms wherever possible instead of rebuilding parallel versions for the sake of the redesign.
- If a current element improves trust, SEO, compliance, accessibility, lead capture or usability, preserve it unless there is an explicit decision to remove or replace it.

## SEO and schema requirements

- Home: keyword-led H1, strong meta description, canonical, `LocalBusiness` JSON-LD.
- Team/About: one clear H1, canonical, meta description, `BreadcrumbList` and `Organization`.
- Contact: contact-led H1, canonical, meta description, `BreadcrumbList` and `LocalBusiness`.
- Contact map/banner: use the existing `GoogleMap` component from the real repo so the user sees an actual visible map, not an empty decorative placeholder.
- Contact form subject field: implement it as a clean `shadcn/ui` `Select` (or the repo's established equivalent), with proper trigger width, content alignment, focus states and dark-mode support; do not leave a browser-default select in the final UI.
- Resources listing: canonical, collection-style meta description, `BreadcrumbList` and `CollectionPage`.
- Article detail: canonical, `Article` schema, publish date, org publisher, author source from Ark.
- Instant quote / agent page: treat as utility page; likely `noindex,follow`.

## Team page sources

- Names and roles should come from the existing team data in the real repo.
- Portraits already exist in the current codebase under `/public/assets/team/`.
- The mockup currently references:
  - `sh.avif`
  - `hb.avif`
  - `rs.avif`
  - `ld.avif`
  - `at.avif`
  - `cl.avif`
  - `sg.avif`
- Replace Maulk Hamdi with Catia Cardoso in the final repo prompt.
- No portrait is available for Catia Cardoso yet, so keep a clean fallback state instead of inventing or reusing a photo.

## Design intent to preserve

- Warm neutral background, restrained brand peach, black/white contrast.
- Clear typography hierarchy with large, decisive H1s.
- Use a full-width, top-attached, opaque header bar instead of a centered floating pill header.
- Keep the logo visually anchored to the left edge of the header; avoid large horizontal offsets.
- Navigation should stay single-line until the mobile menu breakpoint.
- Treat mobile as a first-class target, not a desktop layout compressed afterward.
- Run a real mobile overflow pass page by page: no horizontal scroll, no cards escaping their grid, no title/meta block forcing overflow at narrow widths.
- Reuse the current navigation architecture as the baseline: desktop nav from `NavbarClient.tsx`, and the mobile `Sheet` pattern from `src/components/navigation/MobileMenu.tsx`.
- The future implementation should be done with `shadcn/ui` primitives and Tailwind utilities, not bespoke HTML/CSS patterns that ignore the current component system.
- The mobile menu must be fully functional and feel production-ready, not like a visual placeholder.
- Preserve the richer current mobile menu structure: theme controls, language switcher, strong contact CTA, primary navigation, and a substantive services list rather than a tiny collapsed link set.
- Keep mobile spacing, hit targets, safe-area handling and floating-button offsets aligned with the current repo behavior, especially for WhatsApp and cookie controls.
- Preserve the existing floating WhatsApp entry point and the cookie-management control from the current layout instead of dropping them during the redesign.
- Keep the floating WhatsApp and cookie triggers icon-only, in the spirit of the current site, not text-labeled pills.
- Preserve the existing cookie consent popup behavior and component structure from `src/components/CookieConsent.tsx`; it does not need a redesign unless there is a concrete UX or legal reason.
- Preserve the existing infinite horizontal testimonials carousel pattern from `app/[locale]/home/components/testimonials-carousel.tsx`.
- On the resources listing, prefer minimal text-led article cards with colored category tags over large decorative placeholder images.
- On the resources listing, theme filters must be genuinely functional and wired to the underlying article taxonomy; avoid dead visual tabs or mismatched counts.
- Team portraits should be large enough to feel editorial, not tiny avatar chips.
- The site should feel precise and senior, not startup-hype or luxury-generic.

## Implementation architecture for the repo prompt

- Favor reusable components and shared layout primitives over page-specific markup duplication.
- Reuse the current repo's existing shared components first, then extend them where needed instead of creating parallel variants for the redesign.
- Build repeated patterns as composable UI pieces, for example: shared section headers, card grids, service tiles, testimonial cards/carousels, team cards, map/contact cards, floating action controls, and filter/tab controls.
- Keep responsive behavior centralized where practical: shared card shells, shared grid utilities, shared spacing/container rules, and shared mobile-safe typography rules.
- If local state or client behavior is reused across pages, extract it into small hooks or helpers rather than duplicating page-level state logic.
- Good candidates for reusable behavior in the final implementation include mobile nav state, active filter state on resources, floating action offsets, and any page-level overflow-safe responsive helpers.
- Avoid one-off responsive fixes scattered through individual pages when the same behavior can live in a shared component, hook, or utility.
- The final implementation should end with a mobile QA pass across all main templates at narrow widths, especially around grids, long titles, badges, and cards with variable copy.

## What to ignore from the HTML

- Inline styles and repeated SVG symbol blocks.
- Any HTML-specific workaround that would be cleaner as a React component.
- Static mockup forms or fake interactions that should become real components.
- The mockups show the preserved floating actions visually, but final visibility rules should match the current repo behavior page by page.

## Best next step

Once the remaining pages feel right visually, write the repo-edit prompt around:

1. page-by-page hierarchy
2. exact content/SEO constraints
3. reusable components to create or adapt
4. what must stay from the current repo
5. what should be replaced from the old design
