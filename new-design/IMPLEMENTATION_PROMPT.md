# Implementation prompt — ark-fid.ch redesign (V2 Bento, ark-peach brand)

> Paste everything below into GPT-5.5 / your coding agent. The intent is zero hallucination: every token, file path, and rule is explicit. The agent must **read the repo first**, never invent identifiers, and challenge any instruction here that conflicts with what it actually finds.

---

## 0. Role & posture

You are a senior front-end engineer migrating the live website **https://github.com/samuelhalff/ark-fid.ch** (Next.js App Router + Tailwind + shadcn/ui, multi-locale FR/DE/EN/ES/PT) to a new minimalist visual system: **the "V2 Bento" design at https://github.com/samuelhalff/Claude/blob/main/ark-fid-mockups/v2-bento.html** (or wherever the user has hosted the mockup folder; ask if unsure).

**Be critical.** Do not take anything in this brief as automatically correct. Before you edit a file, **open it and read it.** If something in this prompt conflicts with the actual code (file paths, component names, translation keys, props), **stop and report the discrepancy** rather than guessing. If a section of this prompt is unclear, ask one targeted question — do not invent.

**Hard constraints:**
- No new npm dependencies. Use only what's already in `package.json`.
- No new translation keys without the user's approval. If you think one is needed, propose it; do not write it.
- No new routes, no renamed components, no API changes.
- Preserve all lead-gen surfaces (Hero CTAs, Instant Quote card, Contact form, article ContextualCTA, article ContactSection). You may **restyle** them; you may not remove or relocate them.
- Preserve SEO: keep all `<h1>`/`<h2>` text, metadata, structured data, alt text, hreflang, canonical, breadcrumbs.
- Preserve accessibility: focus rings, ARIA labels, semantic landmarks, prefers-reduced-motion.

---

## 1. The change in one sentence

Replace the current grayscale shadcn theme + uniform 11-card services grid on the home page with a **warm-neutral palette anchored on the ark brand peach (#d79171)**, and a **bento grid** (varied tile sizes, one black "hero" tile, one peach "highlighted Odoo" tile, nine neutral tiles) — while keeping the existing routes, translations, components, and lead-gen sections intact.

---

## 2. Brand decision (already made — do not reopen)

The ark logo is **black wordmark + #d79171 peach "fid" wordmark**. The new system:
- Foundation stays Swiss-neutral (white / off-white / charcoal — i.e. the existing shadcn neutral palette).
- **Peach #d79171 becomes the single brand accent**, used sparingly: link hovers, focus rings, the highlighted bento tile, CTA hover states, brand glow on dark surfaces.
- **Blue is removed entirely.** Search the codebase for any literal blue (`text-blue-*`, `bg-blue-*`, hex `#2D5BFF`, `#3B82F6`, etc.) and convert to brand peach or neutral. Report each occurrence you change.

---

## 3. Design tokens — paste verbatim

Update `app/globals.css`. The file uses **OKLCH three-component** format (lightness chroma hue, **no** wrapper, consumed via `oklch(var(--token) / <alpha-value>)`). The existing `tailwind.config.ts` already maps these to Tailwind colors — **do not edit tailwind.config.ts**.

### 3.1 Light theme (`:root`) — replace these lines only

```css
/* BEFORE (current) */
--primary: 0.205 0 0;
--primary-foreground: 0.985 0 0;
--accent: 0.97 0 0;
--accent-foreground: 0.205 0 0;
--ring: 0.708 0 0;

/* AFTER */
--primary: 0.205 0 0;             /* keep — primary = black, used for buttons & ink */
--primary-foreground: 0.985 0 0;  /* keep */
--accent: 0.658 0.122 47.5;       /* ark peach #D17A4F (logo lifted +sat for digital) */
--accent-foreground: 0.205 0 0;   /* dark ink reads on peach */
--ring: 0.658 0.122 47.5;         /* focus ring = brand peach */
```

Add **new** tokens (do not collide with existing names):
```css
--brand: 0.658 0.122 47.5;        /* ark peach */
--brand-hover: 0.553 0.116 44;    /* deeper terracotta for active/hover */
--brand-soft: 0.946 0.018 60;     /* pale peach background tint */
--brand-on-dark: 0.738 0.099 50;  /* lighter peach for use on near-black surfaces */
--surface-warm: 0.972 0.005 75;   /* warm off-white #F6F4F1 — page bg accent */
```

### 3.2 Dark theme (`.dark`) — replace these lines only

```css
/* AFTER */
--accent: 0.738 0.099 50;          /* brand-on-dark — peach lifted for dark mode */
--accent-foreground: 0.985 0 0;
--ring: 0.738 0.099 50;
--brand: 0.738 0.099 50;
--brand-hover: 0.85 0.085 55;
--brand-soft: 0.27 0.04 50;        /* low-saturation peach for dark surfaces */
--brand-on-dark: 0.738 0.099 50;
--surface-warm: 0.18 0.005 75;
```

### 3.3 Extend tailwind to expose new tokens

**Edit `tailwind.config.ts`** — inside `theme.extend.colors`, add (do not remove anything):
```ts
brand: {
  DEFAULT: "oklch(var(--brand) / <alpha-value>)",
  hover: "oklch(var(--brand-hover) / <alpha-value>)",
  soft: "oklch(var(--brand-soft) / <alpha-value>)",
  onDark: "oklch(var(--brand-on-dark) / <alpha-value>)",
},
surface: {
  warm: "oklch(var(--surface-warm) / <alpha-value>)",
},
```

After this edit, classes like `bg-brand`, `bg-brand-soft`, `text-brand`, `ring-brand`, `bg-surface-warm` become available repo-wide.

---

## 4. Files to modify (exact list)

| # | File | Action |
|---|------|--------|
| 1 | `app/globals.css` | Update root + dark tokens per §3 |
| 2 | `tailwind.config.ts` | Add `brand` / `surface` color groups per §3.3 |
| 3 | `app/[locale]/home/components/services.tsx` | **Replace card grid with bento layout** — see §5 |
| 4 | `app/[locale]/home/components/hero.tsx` | Refine typography only (no copy change, no badge removal) — see §6 |
| 5 | `app/[locale]/page.tsx` | The Instant Quote `<Card>` keeps its content/copy/CTA but adopts brand-aware styling — see §7 |
| 6 | `src/components/ui/article-contextual-cta.tsx` | Restyle the mid-article banner to use brand peach — see §8 |
| 7 | `app/[locale]/ressources/articles/components/ContactSection.tsx` | Restyle end-of-article CTA — see §8 |
| 8 | `app/globals.css` (prose section) | Update `prose` link/heading/blockquote colors to brand — see §9 |
| 9 | Any `text-blue-*` / `bg-blue-*` literals across the repo | Replace with brand or neutral; report each |

**Do not modify** (unless §9 sweep finds blue inside them — in which case report before changing):
- `middleware.ts`, `next.config.js`, `server.js`
- Any file under `app/api/`
- `src/i18n/*`, `src/translations/*` (translations are frozen)
- `src/lib/structuredData.ts`, `src/lib/metadata.ts`
- `app/[locale]/layout.tsx` unless a font/class swap is strictly required
- `app/[locale]/navigation.tsx` (navbar) — only token-driven color shifts will apply automatically; do not restructure

---

## 5. Bento services — full replacement spec

**File:** `app/[locale]/home/components/services.tsx`

### 5.1 What it must do

- Render the **same 11 services** (same `services-items.tsx`, same `titleKey`s, same `href`s, same icons).
- Use the **same translations** (`home.Services.Title`, `home.Services.Subtitle`, `servicesItems.<Key>.Title`, `servicesItems.<Key>.Short` if present — check first).
- Tile order must match the order in `services-items.tsx`. Do not reorder services without user approval.
- The first tile = "hero" tile, spans 3 cols × 2 rows on lg, **black background**, peach hover accent.
- The Odoo tile = "highlighted" tile, spans 3 cols × 1 row on lg, **`bg-brand-soft`** background, peach number, peach hover border.
- The other 9 tiles = neutral, span 2 cols × 1 row each, on `bg-muted/30`.

### 5.2 Responsive

- `lg` and up: `grid-cols-6`, varied spans as above
- `md`: `grid-cols-4`, first tile spans 4, others span 2
- below `md`: `grid-cols-2`, first tile spans 2

### 5.3 Reference markup (adapt — do not paste verbatim if it breaks existing imports)

```tsx
// Inside Services component, replacing the current `grid md:grid-cols-2 lg:grid-cols-3` block:

<div
  id="services"
  className="max-w-[var(--breakpoint-xl)] mx-auto w-full py-8 xs:py-12 px-6"
>
  {showHeading && (
    <>
      <h2 className="text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight max-w-4xl mx-auto text-center mb-10">
        {tidyTitle(tHome("Services.Title") as string)}
      </h2>
      {showSubtitle && (
        <p className="text-lg text-center mb-10 max-w-3xl mx-auto text-muted-foreground">
          {tHome("Services.Subtitle")}
        </p>
      )}
    </>
  )}

  <div className="mt-8 xs:mt-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
    {services.map((service, index) => {
      const isHero = index === 0;
      const isHighlighted = service.titleKey === "OdooImplementation.Title";
      const serviceHref = `${localePrefix}${localizePath(service.href, currentLocale)}`;

      // Span classes per tile role
      const spanClass = isHero
        ? "col-span-2 md:col-span-4 lg:col-span-3 lg:row-span-2"
        : isHighlighted
        ? "col-span-2 md:col-span-4 lg:col-span-3"
        : "col-span-2 md:col-span-2 lg:col-span-2";

      // Surface classes per tile role
      const surfaceClass = isHero
        ? "bg-foreground text-background"
        : isHighlighted
        ? "bg-brand-soft border-brand/30 hover:border-brand"
        : "bg-muted/30 hover:border-foreground/40";

      return (
        <Link
          key={service.titleKey}
          href={serviceHref}
          prefetch={false}
          className={[
            "group relative flex flex-col justify-between rounded-2xl border border-border/60 p-5 sm:p-6",
            "transition-all duration-200 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            spanClass,
            surfaceClass,
          ].join(" ")}
        >
          <div className="flex items-start justify-between">
            <span
              className={[
                "text-[11px] tracking-[0.14em] uppercase font-medium",
                isHero ? "text-background/60" : isHighlighted ? "text-brand-hover" : "text-muted-foreground",
              ].join(" ")}
            >
              {String(index + 1).padStart(2, "0")}
              {isHighlighted ? " · digital" : isHero ? " · phare" : ""}
            </span>
            <span
              className={[
                "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                isHero
                  ? "border-background/20 bg-background/10 text-background group-hover:bg-brand group-hover:border-brand"
                  : "border-border bg-background text-foreground group-hover:bg-foreground group-hover:text-background",
              ].join(" ")}
              aria-hidden="true"
            >
              <ArrowUpRightIcon className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-10">
            <h3
              className={[
                "font-semibold tracking-tight",
                isHero ? "text-3xl sm:text-4xl max-w-[16ch]" : "text-xl sm:text-2xl",
              ].join(" ")}
            >
              {tItems(service.titleKey)}
            </h3>
            {/* Short description if available in translations — check key existence,
                fall back to nothing rather than a placeholder. */}
            {service.shortKey && tItems(service.shortKey) ? (
              <p
                className={[
                  "mt-2 text-sm leading-relaxed max-w-[42ch]",
                  isHero ? "text-background/70" : "text-muted-foreground",
                ].join(" ")}
              >
                {tItems(service.shortKey)}
              </p>
            ) : null}
          </div>
        </Link>
      );
    })}
  </div>
</div>
```

### 5.4 Critical checks before you ship this

- [ ] **`service.shortKey` may not exist.** Open `services-items.tsx` and check the actual fields. If there's no short description per service, **render only the title** — do not invent a fallback string.
- [ ] **The `ArrowUpRightIcon`** already exists in the current `services.tsx`. Reuse it; do not import a new icon.
- [ ] **The Show More / Show Less toggle** in the current card is removed in the bento. Confirm with the user that losing the inline description toggle is acceptable; if not, the toggle goes on the dedicated service page.
- [ ] **Each tile is a `<Link>`** — do not nest `<Link>` inside `<Card>`. Hover semantics should belong to the link itself.
- [ ] **Card.tsx (shadcn) is not used here** — we intentionally use raw div+border+rounded styling to avoid card-on-card visual weight. Don't import Card just to match the old file.

---

## 6. Hero — typography refinement only

**File:** `app/[locale]/home/components/hero.tsx`

Keep all logic, layout, image switching, structured data. Only:
1. Tighten H1 to `tracking-[-0.02em]` and `leading-[1.02]` at the largest breakpoint.
2. Replace any literal blue link/badge color with `text-brand` / `bg-brand-soft text-brand-hover`.
3. The hero image accent block (`bg-accent rounded-xl aspect-square`) is now warm peach because `--accent` is brand; verify visually — if it's too dominant, switch the accent block to `bg-surface-warm` and place the image inside.
4. Odoo partner badge: change ring/border from neutral to `border-brand/30 text-brand-hover` if the badge currently looks weak against the new warm bg. Confirm the exact current classes before editing.
5. Do not touch the H1 copy, the description copy, the CTA copy, or the `Hero.OdooPartnerBadge` text. These are translation-keyed.

---

## 7. Instant Quote card — restyle only

**File:** `app/[locale]/page.tsx` — section with `id="instant-quote"`

Current markup:
```tsx
<Card className="mt-10 border-border/60 bg-muted/20">
  <CardContent className="flex flex-col gap-6 p-6 md:p-8 md:flex-row md:items-center md:justify-between">
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold">{agentT("Title") as string}</h2>
      ...
    </div>
    <Button asChild>
      <Link href={`${localePrefix}/agent/`} prefetch={false}>
        {agentT("Lead.Button") as string}
      </Link>
    </Button>
  </CardContent>
</Card>
```

Required changes:
- Wrap in `bg-foreground text-background` instead of `bg-muted/20` — this becomes a dark "anchor" block mirroring the bento hero tile.
- Apply a subtle peach glow via inline style or a utility class: `style={{ backgroundImage: "radial-gradient(circle at 85% 20%, rgba(209,122,79,0.25), transparent 55%)" }}` or add a dedicated utility in globals.css.
- Button: `bg-background text-foreground hover:bg-brand hover:text-background` so it pops on dark.
- Keep `agentT("Title")`, `agentT("Subtitle")`, `agentT("Intro")`, `agentT("Lead.Button")` exactly. **Do not change any translation lookups.**
- Keep the `<Link href={localePrefix}/agent/>` exactly — this is the lead-gen target.

---

## 8. Article CTAs — restyle, preserve all props

### 8.1 `src/components/ui/article-contextual-cta.tsx` (mid-article)

The component is invoked with `title, description, primaryText, primaryHref, secondaryText, secondaryHref, locale`. **All props stay the same.** Inside, replace the current `<aside>` styling:

```tsx
// BEFORE
<aside
  className="my-10 rounded-xl border border-primary/20 bg-primary/5 px-6 py-8 not-prose"
  role="complementary"
  aria-label={title}
>
  ...
</aside>

// AFTER
<aside
  className="my-12 rounded-2xl border border-brand/30 bg-brand-soft px-6 py-8 sm:px-10 sm:py-10 not-prose relative overflow-hidden"
  role="complementary"
  aria-label={title}
>
  <span
    aria-hidden="true"
    className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-brand/15 blur-3xl"
  />
  <div className="relative mx-auto max-w-xl text-center space-y-3">
    <p className="text-xs uppercase tracking-[0.14em] text-brand-hover font-medium">
      Ark Fiduciaire
    </p>
    <p className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
      {title}
    </p>
    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
      {description}
    </p>
    <div className="flex flex-col items-center justify-center gap-2 pt-3 sm:flex-row">
      <Link href={resolvedPrimaryHref} locale={activeLocale} prefetch={false}>
        <Button size="default" className="rounded-full">{primaryText}</Button>
      </Link>
      {secondaryText && (
        <Link href={resolvedSecondaryHref} locale={activeLocale} prefetch={false}>
          <Button size="default" variant="outline" className="rounded-full border-brand/40 hover:bg-brand hover:text-background hover:border-brand">
            {secondaryText}
          </Button>
        </Link>
      )}
    </div>
  </div>
</aside>
```

**Do not** introduce a translation key for "Ark Fiduciaire" — it's a brand name and OK as a literal. If the user objects, remove that eyebrow line.

### 8.2 `app/[locale]/ressources/articles/components/ContactSection.tsx` (end-of-article)

Same treatment, but slightly denser and darker. Replace:

```tsx
<section className="bg-muted/50 rounded-xl p-8 text-center mt-12">
```

with:

```tsx
<section className="relative overflow-hidden bg-foreground text-background rounded-2xl p-8 sm:p-12 text-center mt-16">
  <span
    aria-hidden="true"
    className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/30 blur-3xl"
  />
```

Update inner classes:
- `MessageCircleIcon` — `text-brand-onDark` instead of `text-primary`
- `<h3>` — `text-background`
- Description `<p>` — `text-background/70`
- Primary Button — `bg-background text-foreground hover:bg-brand hover:text-background`
- Secondary Button (if rendered) — `bg-transparent text-background border border-background/30 hover:bg-background/10`

Keep `MessageCircleIcon`, the `<Link href>` targets, and all string props **exactly**.

---

## 9. Prose (article body) — brand-aware typography

**File:** `app/globals.css` — find the section with `@tailwind utilities` or a `@layer components` containing `.prose` overrides, or append a new block.

Add:
```css
@layer components {
  .prose a {
    @apply text-foreground underline decoration-brand/40 underline-offset-4 transition-colors hover:text-brand hover:decoration-brand;
  }
  .prose h2 {
    @apply mt-12 mb-4 text-2xl sm:text-3xl font-semibold tracking-tight;
  }
  .prose h2::before {
    content: "";
    @apply inline-block mr-3 h-1 w-6 align-middle rounded-full bg-brand;
  }
  .prose h3 {
    @apply mt-8 mb-3 text-xl font-semibold tracking-tight;
  }
  .prose blockquote {
    @apply border-l-4 border-brand bg-brand-soft/50 not-italic rounded-r-md py-2 pl-4;
  }
  .prose table thead {
    @apply bg-muted/40;
  }
  .prose table th {
    @apply text-foreground font-semibold;
  }
  .prose strong {
    @apply text-foreground;
  }
}
```

Verify visually on a long article like `/fr/ressources/articles/plan-comptable-suisse-pme-tendances-2026/`. The H2 peach indicator is the only "loud" element — everything else must read as cleanly typeset, not decorated.

---

## 10. Lead-gen surfaces — do not lose any of these

| Surface | File | Purpose | What to keep |
|---------|------|---------|--------------|
| Hero primary CTA | `home/components/hero.tsx` | "Devis instantané" | `Hero.CTA` translation, href to `/agent/` |
| Hero secondary CTA | `home/components/hero.tsx` | "Parler à un agent" | `Hero.SecondaryCTA` translation, href |
| Instant Quote card | `app/[locale]/page.tsx` `#instant-quote` | Re-prompt for agent | `agent.Title/Subtitle/Intro/Lead.Button`, href to `/agent/` |
| Contact form | `app/[locale]/page.tsx` `#contact` | Form capture | Entire `ContactForm` block + `contactStrings` |
| Article mid-CTA | `src/components/ui/article-contextual-cta.tsx` | In-flow lead capture | All 6 props + button hrefs |
| Article end CTA | `app/[locale]/ressources/articles/components/ContactSection.tsx` | Reading-end conversion | Props + hrefs |
| FAQ | `home/components/faq.tsx` | SEO + trust | All Q/A pairs |
| Testimonials | `home/components/testimonials.tsx` | Social proof | All testimonials |
| Odoo badge | `home/components/hero.tsx` | Trust signal | `Hero.OdooPartnerBadge` text |
| Structured data | `app/[locale]/page.tsx` | SEO | `FAQPage`, `LocalBusiness`, `Article` JSON-LD |
| Breadcrumbs | `src/components/navigation/Breadcrumbs.tsx` | SEO + UX | All breadcrumb logic |
| Reading progress / Share / Back to top | `app/[locale]/ressources/articles/[slug]/page.tsx` | Engagement | All three dynamic imports |

**If any of these stops rendering or changes copy as a side effect of your edits, that is a regression. Revert that change.**

---

## 11. Sweep tasks (after the core edits)

1. **Blue hunt.** Run `grep -rE "(text|bg|border|ring)-(blue|indigo|sky)-" app src` and `grep -rE "#(2D5BFF|3B82F6|1E40AF|2563EB)" app src`. Replace each occurrence with brand or neutral, then post the diff in your final report.
2. **Image audit.** The hero rotates 9 service hero images. The new system still uses them — verify they read OK against the new warm-neutral page. No replacement needed.
3. **Logo audit.** Both `arkfid--color.svg` and `arkfid--light.svg` are referenced from `/assets/`. They keep their existing peach. Do not touch the SVGs.
4. **Dark mode.** Switch to dark mode and walk the homepage + one article. The bento hero tile, brand peach, and brand-soft fills must remain legible. If anything looks broken, fix the dark-mode token in §3.2, not the component.
5. **prefers-reduced-motion.** The new tile `hover:-translate-y-[2px]` and the CTA blur glows must respect motion preferences. Wrap motion-y utilities in a `motion-safe:` prefix where they fire on hover.

---

## 12. Verification checklist — must all be green before opening the PR

- [ ] `pnpm build` (or `npm run build`) succeeds with zero new TS errors.
- [ ] `pnpm lint` clean.
- [ ] Lighthouse home (mobile): Performance ≥ existing baseline − 2 pts, Accessibility 100, SEO 100.
- [ ] `/fr`, `/de`, `/en`, `/es`, `/pt` home pages render identically structured (only language differs).
- [ ] At least 3 articles inspected in 2 locales (`/fr/ressources/articles/<slug>/`): mid-CTA renders peach, end-CTA renders dark with peach glow, prose reads cleanly.
- [ ] All 11 services link to their dedicated pages — no broken routes.
- [ ] All form submissions still hit their existing endpoints (no API path was changed).
- [ ] Sitemap.xml still generates.
- [ ] Hreflang and canonical tags unchanged.
- [ ] `grep -rE "(text|bg|border|ring)-(blue|indigo|sky)-" app src` returns zero results.
- [ ] Visual diff vs. mockup (`ark-fid-mockups/v2-bento.html`) is faithful: bento varied sizes, peach Odoo tile, black hero tile, dark instant-quote card.

---

## 13. Deliverable

One PR titled `feat(design): bento + ark-peach brand system` containing:

1. The token + tailwind config change (one commit).
2. The bento services component (one commit).
3. Hero + Instant Quote restyle (one commit).
4. Article CTAs + prose styles (one commit).
5. Blue-hunt sweep (one commit, with a list in the commit body of every file touched).

PR description must include:
- Before/after screenshots: home, services section, one article, dark mode.
- List of all files modified.
- List of all `grep` results from §11.1, before and after.
- Any prop / translation / structural changes you had to make that diverge from this brief — with the reason.

---

## 14. Final mindset reminders

- **Read before you write.** Every file path in this brief is from a live read of the repo at the time of writing, but the codebase moves. If a file no longer exists or has been renamed, stop and report.
- **Don't invent translation keys.** Every `t(...)` call in your edits must resolve to a key that already exists in `src/translations/fr/<namespace>.json`. Grep the JSON before adding any new lookup.
- **Don't over-engineer.** No new abstractions, no new utility libraries, no design-system refactor on the side. This PR replaces tokens, the services grid, and the CTA blocks — nothing else.
- **Push back.** If something here makes the code worse (perf regression, broken type, accessibility step backwards), say so in the PR and propose the smaller change.
- **One pass, no second guesses.** Make the design choices in §3 the source of truth — don't dilute the peach with secondary blues or "just in case" gradients.

Done.
