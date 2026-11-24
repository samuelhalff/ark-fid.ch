# Leçons : vitesse du site

Reprend la méthode de guide-assurance.ch (24.11.2026) et ce qui a été appris sur l'accueil d'ark-fid.ch.

## Méthode
- Mesurer le site en ligne avec un seul outil (Lighthouse 12, ordinateur et mobile, trois passages, valeur médiane). Les chiffres de PageSpeed, d'un autre poste ou d'un autre outil ne se comparent pas : ici PageSpeed donnait un TBT de 560 ms sur ordinateur, Lighthouse local 0 à 80 ms. Le mobile simulé est bruité (de 100 à 500 ms de TBT d'un passage à l'autre), d'où les trois passages.
- On ne retire jamais de contenu explorable. Avant et après : texte sans JavaScript, balises head, JSON-LD et liens internes identiques.
- On reporte ce qui est interactif ou purement mesure : GA4, GTM, PostHog (et son enregistrement de session), pixel OpenAI, bandeau, menus, assistant.
- L'origine du visiteur (page d'arrivée, référent, UTM) se capte dès l'hydratation. Les appels faits avant l'arrivée d'une bibliothèque restent en file (dataLayer, file PostHog, `oaiq.q`) et sont rejoués ; un clic sur un appel à l'action déclenche aussitôt le chargement.
- Pas de bricolage : ni règle de lint désactivée, ni `!important`.

## Ce qui pesait sur l'accueil (mobile simulé)
- Les bibliothèques de mesure : gtag.js, gtm.js, posthog-js et son enregistreur, environ 1,1 s de script, démarrées juste après le chargement, donc dans la fenêtre du TBT.
- Un `MutationObserver` sur tout le `body` (bouton WhatsApp flottant) relançait à chaque changement du DOM une lecture de hauteur (`getBoundingClientRect`) : reflow forcé pendant l'hydratation. Corrigé à la source : le bandeau cookies émet `cookie-banner-change` quand il apparaît ou disparaît, le bouton n'écoute plus que cet événement.

## Règle appliquée
- Une seule porte, `src/lib/first-interaction.ts` : après le chargement, au premier geste (pointeur, touche, défilement), sinon 8 s après le chargement, puis en temps libre. Le même raisonnement est dans l'amorce en ligne de `consent-mode.ts` pour gtag.js et gtm.js (tests : `consent-mode.test.ts`).
- Contrepartie acceptée : un visiteur qui part en moins de 8 s sans aucun geste n'est plus compté par GA4, GTM et PostHog.

## Résultats (Lighthouse 12, site en ligne, médiane de trois passages)
- Ordinateur : TBT 48 ms → 0 ms, score 98 → 99.
- Mobile : TBT 812 ms → 105 ms, score 60 → 83 (LCP 5,2 s → 4,5 s, encore à travailler : image d'arrière-plan et hydratation).
- Bandeau cookies : fond opaque au jeton `card`, bordure haute au jeton `border`, sans flou (contrôlé à 390 px en clair et en sombre).
- Polices Inter allégées au sous-ensemble latin (3 × 110 Ko → 3 × 25 Ko, pyftsubset, kerning et chiffres tabulaires conservés), URL en ?v=2 car le cache dure 30 jours : LCP mobile en ligne 3,6 s → 3,15 s, score 86 → 91 (médiane de trois). Reste 2,5 s de délai de rendu, dû au JavaScript (chunk 1255 : 393 ms de scripting).
- Scripts sans rendu (pixel OpenAI, suivi d'attribution et d'engagement) chargés après inactivité, premier geste ou 3 s ; formulaire de contact de l'accueil chargé à l'affichage de sa section ; sections sous la ligne de flottaison hydratées plus tard (Defer maxDelay 8 s) : LCP mobile 3,15 s → 2,7 s, score 91 → 95. Le chunk 1255 est le runtime de Next, pas du code du site. Prochain levier : remplacer l'animation Reveal (framer-motion) des Services, qui change l'effet visuel.

## Premier écran mobile et bandeau cookies (24.11.2026)
- Tester à 375 × 600 et 390 × 660 px (Safari avec ses barres), bandeau ouvert et fermé, et regarder la capture : à 390 × 844, les boutons semblaient visibles mais ne l'étaient pas sur un vrai téléphone.
- Titre de 30 px sous 400 px de large, une phrase d'introduction, bouton principal à la couleur de la marque (variante `brand`, jeton `--brand-foreground`), espacements resserrés sous la note Google.
- Bulle WhatsApp affichée seulement après le premier écran, pour ne jamais couvrir un bouton du hero.
- Bandeau cookies compact sur mobile (moins d'un tiers de l'écran, boutons côte à côte), fond plein `bg-card` avec bord, focus sur le panneau et non sur un lien.
- Brotli impossible ici : l'hébergement mutualisé Infomaniak gère le serveur web (gzip seulement). Sur un VPS avec notre nginx, brotli a réduit le HTML de 27 à 39 % (guide-assurance.ch).
