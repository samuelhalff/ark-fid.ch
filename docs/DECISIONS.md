# Decisions

## Decision Log

- `2026-03-08T14:37:19.871662+00:00`: Project initialized as `nextjs` / `nextjs`.
- `2026-11-23`: Mesure d'audience, présomption de consentement (décision de Sam, 23.11.2026, prise en connaissance du risque RGPD / arrêt Planet49 pour les visiteurs UE/EEE/Royaume-Uni). Partout, ignorer le bandeau vaut acceptation : les quatre signaux Consent Mode v2 sont accordés par défaut (une seule règle, `CONSENT_DEFAULT_RULES` dans `src/lib/consent-mode.ts`, prévue pour rétablir une règle régionale), gtm.js se charge toujours, le pixel OpenAI se charge, PostHog est persistant avec replay (jamais sur les pages KYC, questionnaire fiscal, assistant, contact ; formulaires et conversations masqués). Seul « Refuser » arrête tout. Le bandeau reste affiché avec « Refuser » et le lien « Cookies ». Même règle sur houle.ai et guide-assurance.ch.
