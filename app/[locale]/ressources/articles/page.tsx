import { headers } from "next/headers";
import Breadcrumbs from "@/src/components/navigation/Breadcrumbs";
import Link from "next/link";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildBreadcrumbList } from "@/src/lib/structuredData";

export default async function ArticlesIndex({ params }: { params: { locale: string } }) {
  const nonce = headers().get("x-nonce") || undefined;
  const locale = params.locale || "fr";
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = locale ? `/${locale}` : "";

  const module = await import(`@/src/translations/${locale}/ressources.json`);
  const ressources = module.default;
  const articles = (ressources.Articles || []).filter((a: any) => a && a.slug && a.title);

  const breadcrumb = buildBreadcrumbList([
    { name: "Resources", item: `${baseUrl}${localePrefix}/ressources/` },
    { name: "Articles", item: `${baseUrl}${localePrefix}/ressources/articles/` },
  ]);

  return (
    <main className="max-w-[var(--breakpoint-xl)] mx-auto px-6 py-10">
      <StructuredData nonce={nonce} data={breadcrumb} />
      <div className="mb-6">
        <Breadcrumbs
          rootLabel="Home"
          baseLabel="Resources"
          segments={[
            { segment: "ressources", label: "Resources" },
            { segment: "articles", label: "Articles" },
          ]}
        />
      </div>

      <h1 className="text-3xl font-bold mb-6">Articles</h1>
      <ul className="space-y-4">
        {articles.map((a: any) => (
          <li key={a.slug} className="border-b pb-4">
            <h2 className="text-xl font-semibold">
              <Link href={`/${locale}/ressources/articles/${a.slug}`}>{a.title}</Link>
            </h2>
            {a.description && <p className="text-muted-foreground">{a.description}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
