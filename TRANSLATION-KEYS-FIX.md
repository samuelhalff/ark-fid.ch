# Translation Keys Issue - Fix Summary

## Problem

Missing translation values showing as raw keys (e.g., `contact:Contact.CompanyName`) instead of actual translated text.

## Root Causes Identified

### 1. Missing i18n Import in Translation Components ❌

**Files affected:**

- `src/components/ui/translated-text.tsx`
- `src/components/ui/translated-text-array.tsx`

**Issue:** The i18n import was commented out:

```tsx
// import "@/src/i18n";  // ❌ WRONG - i18n not initialized!
```

**Fix:** Uncommented the imports:

```tsx
import "@/src/i18n"; // ✅ CORRECT - i18n initialized
```

### 2. Missing Translation Validation Script ❌

**Issue:** The `check-missing-translation-keys.js` script was accidentally deleted during repository cleanup.

**Fix:** Created two new validation scripts:

1. `scripts/validate-translations.js` - Validates 20 critical translation keys before build
2. `scripts/check-translation-usage.js` - Comprehensive codebase scanner (for manual use)

### 3. No Pre-build Validation ❌

**Issue:** No automated check to prevent missing translations from being deployed.

**Fix:** Added `prebuild` hook to package.json:

```json
"prebuild": "node scripts/validate-translations.js"
```

## Changes Made

### Fixed Files

1. ✅ `src/components/ui/translated-text.tsx` - Uncommented i18n import
2. ✅ `src/components/ui/translated-text-array.tsx` - Uncommented i18n import

### New Files

1. ✅ `scripts/validate-translations.js` - Pre-build validation (20 critical keys × 5 locales = 100 checks)
2. ✅ `scripts/check-translation-usage.js` - Comprehensive usage scanner

### Updated Files

1. ✅ `package.json` - Added `prebuild` hook and `validate:translations` command

## Validated Translation Keys

The validation now checks these critical keys across all 5 locales (en, fr, de, es, pt):

**Contact (8 keys):**

- `contact:Contact.CompanyName`
- `contact:Contact.Email`
- `contact:Contact.Phone`
- `contact:Contact.Address`
- `contact:Title`
- `contact:Form.Name`
- `contact:Form.Email`
- `contact:Form.Message`

**Navigation (4 keys):**

- `navbar:Home`
- `navbar:Services`
- `navbar:About`
- `navbar:Contact`

**Footer (1 key):**

- `footer:Copyright`

**Home (3 keys):**

- `home:Hero.Title`
- `home:Hero.Description`
- `home:Services.Title`

**Cookie Consent (4 keys):**

- `cookie:Title`
- `cookie:Text`
- `cookie:Accept`
- `cookie:Decline`

**Total: 20 keys × 5 locales = 100 validations**

## Testing

```bash
# Manual validation
npm run validate:translations

# Runs automatically before build
npm run build
```

## Prevention

The pre-build validation will now:

1. ✅ Run before every `npm run build`
2. ✅ Check all critical translation keys exist
3. ✅ Validate across all 5 locales
4. ✅ Fail the build if any keys are missing
5. ✅ Display clear error messages

## Next Steps

1. Deploy the fix to production
2. Verify contact form displays correctly
3. Consider adding more keys to the validation list as needed
4. Run `npm run check-translation-usage` manually to scan for all used keys

## Notes

- The validation script is intentionally focused on critical keys (20) rather than all keys to keep build times fast
- For comprehensive validation, use `node scripts/check-translation-usage.js`
- All translation components now properly initialize i18n
- The `contact` namespace will now load correctly when used

## New Ressources Reference Keys (Oct 2025)

Added for a new multilingual article about company creation in Switzerland. These keys must exist in all locales under the `ressources` namespace:

- `ressources:KMU_Registre_Commerce` – Label for SECO/KMU Commercial Register guidance
- `ressources:GuideSocial_Creer_Son_Entreprise` – Label for “Guide Social” PDF about creating a business

Both keys have been added to: `src/translations/fr|en|de|es|pt/ressources.json`.

## New Ressources Reference Keys (Nov 2025 update)

- `ressources:admin_ch_optimisation_fiscale_patrimoine` – Label for the Fedlex Swiss Civil Code succession reference (used by the wealth management article).

## New Service Keys (Nov 2025)

Added for the Mergers & Acquisitions service launch. Ensure all locales include:

- `navbar:MAServices.Title`
- `servicesItems:MAServices.Title`
- `servicesItems:MAServices.Description`
- Full namespace `mna` for service page copy (`Hero.*`, `Presentation.*`)

### Service Card Toggle Labels (Nov 2025)

- `servicesItems:ShowMore`
- `servicesItems:ShowLess`

## New Agent Page Keys (Feb 2026)

Added for the new AI agent chat page. Ensure all locales include:

- `navbar:Agent`
- `agent:Title`
- `agent:Subtitle`
- `agent:Intro`
- `agent:Lead.Title`
- `agent:Lead.Description`
- `agent:Lead.Helper`
- `agent:Lead.VerificationLabel`
- `agent:Lead.VerificationRequired`
- `agent:Lead.Fields.Name`
- `agent:Lead.Fields.Email`
- `agent:Lead.Placeholders.Name`
- `agent:Lead.Placeholders.Email`
- `agent:Lead.Button`
- `agent:Lead.Confirmed`
- `agent:Chat.Placeholder`
- `agent:Chat.Send`
- `agent:Chat.Thinking`
- `agent:Chat.Error`
- `agent:Chat.RateLimit`
- `agent:Chat.StartHint`
- `agent:Chat.InvalidEmailDomain`
- `agent:Chat.ReadyHint`
- `agent:Chat.ClearHistory`
- `agent:Suggestions.Title`
- `agent:Suggestions.Items`
- `agent:Disclaimer`

## New Service Keys (Feb 2026 - Immigration)

Added for the Immigration service launch. Ensure all locales include:

- `servicesItems:ImmigrationServices.Title`
- `servicesItems:ImmigrationServices.Description`
- `services:ImmigrationServices.Title`
- `services:ImmigrationServices.Description`
- Full namespace `immigration` for service page copy (`Hero.*`, `Presentation.*`, `ImageAlt`)

## New Services Banner Keys (Feb 2026)

Added global service banner copy in the `services` namespace for all locales:

- `services:ExpertBanner.Title`
- `services:ExpertBanner.Description`
- `services:ExpertBanner.PrimaryCTA`
- `services:ExpertBanner.SecondaryCTA`

## New Services Scroll Hint Key (Feb 2026)

- `services:ScrollHint`

## New Ressources Reference Keys (Feb 2026 - ANobAG)

Added for the ANobAG immigration article references. Ensure all locales include:

- `ressources:SVA Saint-Gall - ANobAG`
- `ressources:SVA Bâle-Campagne - ANobAG`
- `ressources:AKNW - ANobAG`
- `ressources:AKOW - ANobAG`
- `ressources:AK Zug - ANobAG`
- `ressources:Swissmem - ANobAG`
- `ressources:SEM - Travail UE/AELE`
- `ressources:SEM - Travail pays tiers`
- `ressources:SEM - Séjour en Suisse`
- `ressources:ch.ch - Travailler en Suisse`
- `ressources:Genève - Engager un étranger`

## New Service Long-Form Keys (Feb 2026 - SEO Expansion)

All service namespaces now include long-form copy for SEO and must be present across all locales:

- `Presentation.LongFormTitle`
- `Presentation.LongFormSections` (array of `{ Title, Body[] }`)

## New Home & CTA Keys (Feb 2026 - Translation & CTA Fixes)

### Home Scroll Hint

Added to the `home` namespace `Hero` object for floating scroll badge on the home page:

- `home:Hero.ScrollHint`

### CTA Secondary Buttons

Added `SecondaryButtonText` to the `Contact` section of both `ressources` and `partners` namespaces across all locales so every CTA banner has both "Contact" and "Get instant quote" buttons:

- `ressources:Contact.SecondaryButtonText`
- `partners:Contact.SecondaryButtonText`

### Contact WhatsApp CTA

Added to the `contact` namespace across all locales for the global floating WhatsApp button and the contact-page WhatsApp badge:

- `contact:WhatsApp.Badge`
- `contact:WhatsApp.Open`

### Contact action panel polish (Mar 2026)

Added to the `contact` namespace across all locales for the redesigned contact-page action panel:

- `contact:BookingDescription`
- `contact:OrContactUs`
- `contact:CallLabel`
- `contact:CallDescription`
- `contact:WhatsApp.Description`

### Translation Bug Fix

Fixed article page (`app/[locale]/ressources/articles/[slug]/page.tsx`) which was accessing nested translation keys with raw object syntax (`ressources["Contact.Title"]`) instead of the `getTranslations()` dot-notation function. This caused the contact banner on articles to always show English fallback strings regardless of the active locale.
