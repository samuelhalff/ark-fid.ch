"use strict";
/**
 * Trends module for fetching trending topics from Google Trends or similar providers.
 * Falls back to a deterministic set of evergreen topics if API fails.
 *
 * Supported providers:
 * - google_trends: Uses google-trends-api library (unofficial, no API key required)
 *
 * Configuration (via environment variables):
 * - TRENDS_PROVIDER: "google_trends" (default)
 * - TRENDS_GEO: Geographic region, e.g., "CH" for Switzerland (default)
 * - TRENDS_LANGUAGE: Language code, e.g., "fr" (default)
 * - TRENDS_CATEGORY: Numeric category for Google Trends (optional)
 * - TRENDS_MAX_TOPICS: Max topics to return (default: 10)
 */

// Evergreen topics for Geneva/Swiss fiduciary services (fallback when trends fail)
const EVERGREEN_TOPICS = [
  {
    topic: "optimisation-fiscale-pme-suisse",
    title: "Optimisation fiscale pour PME en Suisse",
    keywords: ["optimisation fiscale", "PME", "impôts cantonaux", "Genève", "déductions fiscales"],
    category: "tax",
    outline: ["Introduction à l'optimisation fiscale", "Déductions légales", "Erreurs courantes", "Conseils pratiques"]
  },
  {
    topic: "declaration-tva-suisse-erreurs",
    title: "Les erreurs courantes dans la déclaration TVA suisse",
    keywords: ["TVA", "déclaration TVA", "taux TVA", "AFC", "erreurs fiscales"],
    category: "tax",
    outline: ["Obligations TVA", "Erreurs fréquentes", "Pénalités", "Comment éviter les erreurs"]
  },
  {
    topic: "cotisations-sociales-employeur-suisse",
    title: "Guide des cotisations sociales pour employeurs suisses",
    keywords: ["cotisations sociales", "AVS", "LPP", "LAA", "employeur", "paie"],
    category: "payroll",
    outline: ["Obligations employeur", "Taux par canton", "Calcul des cotisations", "Swissdec"]
  },
  {
    topic: "creation-entreprise-geneve",
    title: "Comment créer une entreprise à Genève: guide complet",
    keywords: ["création entreprise", "Genève", "Sàrl", "SA", "registre du commerce"],
    category: "incorporation",
    outline: ["Formes juridiques", "Procédure d'inscription", "Capital requis", "Coûts et délais"]
  },
  {
    topic: "comptabilite-pme-swiss-gaap-fer",
    title: "Comptabilité PME: introduction aux Swiss GAAP FER",
    keywords: ["comptabilité", "Swiss GAAP FER", "reporting financier", "PME", "bilan"],
    category: "accounting",
    outline: ["Normes comptables suisses", "Applicabilité", "Avantages", "Mise en œuvre"]
  },
  {
    topic: "conformite-lba-aml-fiduciaire",
    title: "Conformité LBA/AML pour les fiduciaires suisses",
    keywords: ["LBA", "AML", "blanchiment", "conformité", "OAR", "FINMA"],
    category: "regulatory",
    outline: ["Obligations légales", "Procédures KYC", "Signalement MROS", "Sanctions"]
  },
  {
    topic: "odoo-erp-implementation-suisse",
    title: "Implémenter Odoo ERP pour votre PME suisse",
    keywords: ["Odoo", "ERP", "gestion entreprise", "comptabilité", "automatisation"],
    category: "odoo",
    outline: ["Qu'est-ce qu'Odoo", "Modules essentiels", "Intégration comptable", "ROI"]
  },
  {
    topic: "externalisation-paie-avantages",
    title: "Externaliser la paie: avantages pour les PME",
    keywords: ["externalisation", "paie", "outsourcing", "BPO", "gestion salariale"],
    category: "payroll",
    outline: ["Pourquoi externaliser", "Économies réalisées", "Risques évités", "Choisir un prestataire"]
  },
  {
    topic: "assemblee-generale-sa-obligations",
    title: "Assemblée générale SA: obligations et bonnes pratiques",
    keywords: ["assemblée générale", "AG", "SA", "gouvernance", "procès-verbal"],
    category: "corporate",
    outline: ["Obligations légales", "Convocation", "Déroulement", "Documentation"]
  },
  {
    topic: "family-office-gestion-patrimoine",
    title: "Family office: structurer la gestion de patrimoine",
    keywords: ["family office", "gestion patrimoine", "HNI", "succession", "wealth management"],
    category: "family-office",
    outline: ["Définition", "Services offerts", "Structures juridiques", "Fiscalité"]
  },
  {
    topic: "domiciliation-entreprise-geneve",
    title: "Domiciliation d'entreprise à Genève: guide pratique",
    keywords: ["domiciliation", "siège social", "Genève", "adresse commerciale"],
    category: "domiciliation",
    outline: ["Avantages domiciliation", "Exigences légales", "Services inclus", "Coûts"]
  },
  {
    topic: "due-diligence-acquisition-suisse",
    title: "Due diligence pour acquisitions en Suisse",
    keywords: ["due diligence", "M&A", "acquisition", "audit", "fusion"],
    category: "ma",
    outline: ["Types de due diligence", "Points de contrôle", "Risques identifiés", "Négociation"]
  }
];

// Map Google Trends categories relevant to fiduciary services
const TRENDS_CATEGORY_MAP = {
  "12": "Business & Industrial",
  "784": "Accounting & Auditing",
  "37": "Finance",
  "692": "Tax Preparation & Planning",
  "1172": "Corporate & B2B"
};

/**
 * Fetch trending topics from Google Trends
 * @param {Object} config - Configuration object
 * @returns {Promise<Array>} Array of trending topic objects
 */
async function fetchGoogleTrends(config = {}) {
  const {
    geo = process.env.TRENDS_GEO || "CH",
    hl = process.env.TRENDS_LANGUAGE || "fr",
    category = process.env.TRENDS_CATEGORY || "12", // Business & Industrial
    maxTopics = parseInt(process.env.TRENDS_MAX_TOPICS || "10", 10)
  } = config;

  let googleTrends;
  try {
    googleTrends = require("google-trends-api");
  } catch (err) {
    console.warn("[trends] google-trends-api not installed, falling back to evergreen topics");
    return { topics: [], error: "google-trends-api not installed" };
  }

  try {
    // Fetch daily trends for the region
    const dailyTrendsResult = await googleTrends.dailyTrends({
      geo,
      hl,
    });

    const parsed = JSON.parse(dailyTrendsResult);
    const trendingSearchesDays = parsed?.default?.trendingSearchesDays || [];
    
    const allTrends = [];
    for (const day of trendingSearchesDays) {
      const searches = day?.trendingSearches || [];
      for (const search of searches) {
        if (allTrends.length >= maxTopics * 2) break;
        allTrends.push({
          title: search.title?.query || "",
          traffic: search.formattedTraffic || "",
          relatedQueries: (search.relatedQueries || []).map(q => q.query).slice(0, 5),
          articles: (search.articles || []).map(a => ({
            title: a.title || "",
            source: a.source || "",
            url: a.url || ""
          })).slice(0, 3)
        });
      }
    }

    // Also try to get related queries for business/finance terms
    const businessKeywords = ["fiduciaire", "comptabilité", "TVA", "fiscalité", "entreprise"];
    const relatedTopics = [];
    
    for (const keyword of businessKeywords.slice(0, 2)) {
      try {
        const relatedResult = await googleTrends.relatedQueries({
          keyword,
          geo,
          hl,
          category: parseInt(category, 10) || 12
        });
        const relatedParsed = JSON.parse(relatedResult);
        const rising = relatedParsed?.default?.rankedList?.[1]?.rankedKeyword || [];
        for (const item of rising.slice(0, 3)) {
          relatedTopics.push({
            query: item.query,
            value: item.value,
            source: keyword
          });
        }
      } catch (relErr) {
        // Ignore individual keyword failures
      }
    }

    return {
      topics: allTrends.slice(0, maxTopics),
      relatedTopics: relatedTopics.slice(0, 5),
      geo,
      language: hl,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.warn(`[trends] Google Trends API error: ${error.message}`);
    return { topics: [], error: error.message };
  }
}

/**
 * Filter trending topics to those relevant to fiduciary/finance services
 * @param {Array} trends - Raw trending topics
 * @returns {Array} Filtered topics relevant to business/finance
 */
function filterRelevantTrends(trends = []) {
  const relevantKeywords = [
    // Tax & fiscal
    /fisc/i, /imp[oô]t/i, /tva/i, /tax/i, /d[eé]duction/i,
    // Accounting
    /comptab/i, /bilan/i, /audit/i, /rapport/i,
    // Corporate
    /entreprise/i, /soci[eé]t[eé]/i, /pme/i, /sa\b/i, /s[àa]rl/i,
    // Payroll
    /salaire/i, /paie/i, /avs/i, /lpp/i, /cotisation/i,
    // Regulatory
    /finma/i, /lba/i, /aml/i, /conformit/i, /r[eé]glement/i,
    // Finance
    /finance/i, /banque/i, /cr[eé]dit/i, /investis/i,
    // Swiss specific
    /suisse/i, /geneva|genève/i, /canton/i, /fédéral/i,
    // Business operations
    /fusion/i, /acquisition/i, /m&a/i, /erp/i, /odoo/i
  ];

  return trends.filter(trend => {
    const searchText = `${trend.title || ""} ${(trend.relatedQueries || []).join(" ")}`.toLowerCase();
    return relevantKeywords.some(rx => rx.test(searchText));
  });
}

/**
 * Map a trending topic to article parameters for content generation
 * @param {Object} trend - A trending topic object
 * @param {Array} existingSlugs - Slugs to avoid duplicating
 * @returns {Object|null} Article parameters or null if not mappable
 */
function mapTrendToArticleParams(trend, existingSlugs = []) {
  if (!trend || !trend.title) return null;

  const title = trend.title;
  const keywords = [title, ...(trend.relatedQueries || [])].filter(Boolean).slice(0, 6);
  
  // Generate a slug suggestion
  const baseSlug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);

  // Avoid duplicate slugs
  let slug = baseSlug;
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  return {
    suggestedTopic: title,
    keywords,
    suggestedSlug: slug,
    trendSignal: {
      traffic: trend.traffic || "unknown",
      sources: (trend.articles || []).map(a => a.source).filter(Boolean).slice(0, 3),
      relatedQueries: trend.relatedQueries || []
    }
  };
}

/**
 * Get topic suggestions based on trends with fallback to evergreen topics
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Topic selection result
 */
async function getTopicSuggestions(options = {}) {
  const {
    existingSlugs = [],
    avoidTopics = [],
    recentTopicCategories = []
  } = options;

  const provider = process.env.TRENDS_PROVIDER || "google_trends";
  let trendsResult = { topics: [], error: null };
  let usedFallback = false;
  let selectedTopic = null;

  // Try to fetch trends
  if (provider === "google_trends") {
    trendsResult = await fetchGoogleTrends();
  }

  // Filter relevant trends
  const relevantTrends = filterRelevantTrends(trendsResult.topics || []);

  if (relevantTrends.length > 0) {
    // Try to find a trend that maps to a new topic
    for (const trend of relevantTrends) {
      const params = mapTrendToArticleParams(trend, existingSlugs);
      if (params) {
        selectedTopic = params;
        break;
      }
    }
  }

  // Fallback to evergreen topics if no suitable trend found
  if (!selectedTopic) {
    usedFallback = true;
    console.log("[trends] No suitable trending topic found, using evergreen topics");
    
    // Filter evergreen topics to avoid recent categories
    const availableTopics = EVERGREEN_TOPICS.filter(t => 
      !existingSlugs.includes(t.topic) &&
      !avoidTopics.includes(t.category) &&
      !recentTopicCategories.includes(t.category)
    );

    if (availableTopics.length === 0) {
      // If all filtered, just pick from full list avoiding exact slug duplicates
      const fallbackTopics = EVERGREEN_TOPICS.filter(t => !existingSlugs.includes(t.topic));
      const topic = fallbackTopics[0] || EVERGREEN_TOPICS[0];
      selectedTopic = {
        suggestedTopic: topic.title,
        keywords: topic.keywords,
        suggestedSlug: topic.topic,
        category: topic.category,
        outline: topic.outline,
        trendSignal: { source: "evergreen_fallback" }
      };
    } else {
      // Deterministic selection: pick first available topic (sorted order)
      const topic = availableTopics[0];
      selectedTopic = {
        suggestedTopic: topic.title,
        keywords: topic.keywords,
        suggestedSlug: topic.topic,
        category: topic.category,
        outline: topic.outline,
        trendSignal: { source: "evergreen_fallback" }
      };
    }
  }

  return {
    selectedTopic,
    usedFallback,
    trendsChecked: relevantTrends.length,
    provider,
    error: trendsResult.error || null
  };
}

/**
 * Build SEO-focused keywords and meta suggestions
 * @param {Object} topicParams - Topic parameters from getTopicSuggestions
 * @returns {Object} SEO suggestions
 */
function buildSEOSuggestions(topicParams) {
  if (!topicParams) return null;

  const { suggestedTopic, keywords = [], category } = topicParams;
  
  // Primary keyword is the main topic
  const primaryKeyword = keywords[0] || suggestedTopic;
  
  // Secondary keywords
  const secondaryKeywords = keywords.slice(1, 5);
  
  // Add location-specific keywords for Geneva/Swiss positioning
  const localKeywords = ["Genève", "Suisse", "fiduciaire"];
  const allKeywords = [...new Set([primaryKeyword, ...secondaryKeywords, ...localKeywords])];

  // Suggested meta title (max ~60 chars)
  const metaTitle = `${suggestedTopic} | Ark Fiduciaire Genève`.slice(0, 60);
  
  // Suggested meta description (max ~160 chars)
  const metaDescription = `Découvrez nos conseils d'experts sur ${primaryKeyword.toLowerCase()}. Guide pratique pour PME et indépendants à Genève. Ark Fiduciaire.`.slice(0, 160);

  return {
    primaryKeyword,
    secondaryKeywords,
    allKeywords,
    metaTitle,
    metaDescription,
    category: category || "general"
  };
}

module.exports = {
  fetchGoogleTrends,
  filterRelevantTrends,
  mapTrendToArticleParams,
  getTopicSuggestions,
  buildSEOSuggestions,
  EVERGREEN_TOPICS
};
