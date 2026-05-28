export type ResourceCategoryId =
  | "accounting"
  | "tax"
  | "payroll"
  | "corporate"
  | "international"
  | "digital";

export type ResourceCategoryLabels = Record<ResourceCategoryId | "all", string>;

export type ResourceCategoryArticle = {
  slug: string;
  title: string;
  description?: string;
};

const categoryOrder: ResourceCategoryId[] = [
  "accounting",
  "tax",
  "payroll",
  "corporate",
  "international",
  "digital",
];

export function buildResourceCategories(
  articles: ResourceCategoryArticle[],
  labels: ResourceCategoryLabels,
) {
  const bySlug: Record<string, ResourceCategoryId> = {};

  for (const article of articles) {
    bySlug[article.slug] = detectResourceCategory(article);
  }

  const items = categoryOrder
    .filter((id) => articles.some((article) => bySlug[article.slug] === id))
    .map((id) => ({ id, label: labels[id] }));

  return { bySlug, items };
}

function detectResourceCategory(
  article: ResourceCategoryArticle,
): ResourceCategoryId {
  const haystack =
    `${article.slug} ${article.title} ${article.description || ""}`.toLowerCase();

  if (/(tva|vat|mwst|imp[oô]t|tax|fiscal|steuer)/i.test(haystack)) {
    return "tax";
  }
  if (
    /(paie|salaire|payroll|rh|hr|avs|anobag|permis|permit|immigration|lohn)/i.test(
      haystack,
    )
  ) {
    return "payroll";
  }
  if (/(odoo|digital|ia|ai|microsoft|automatisation|automation)/i.test(haystack)) {
    return "digital";
  }
  if (/(compt|account|buchhaltung|plan comptable|bilan|audit)/i.test(haystack)) {
    return "accounting";
  }
  if (
    /(succursale|entreprise|s[aà]rl|sa|domiciliation|liquidation|holding|company|corporate|soci[eé]t[eé])/i.test(
      haystack,
    )
  ) {
    return "corporate";
  }
  if (/(suisse|swiss|international|[ée]tranger|foreign|frontali)/i.test(haystack)) {
    return "international";
  }

  return "corporate";
}
