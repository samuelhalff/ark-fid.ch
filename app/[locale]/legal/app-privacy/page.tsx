import { type Metadata } from "next";
import { Separator } from "@/src/components/ui/separator";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  return await generateMetadataForPage(locale as Locale, "/legal/app-privacy");
}

function formatDate(date: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

const textSections = [
  "NotDone",
  "Processors",
  "Retention",
  "Rights",
  "Contact",
] as const;

export default async function AppPrivacyPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const locale = params.locale as Locale;
  const t = await getTranslations(locale, "legal");
  const r = (key: string, fallback: string) => (t(key) as string) || fallback;

  return (
    <div className="mx-auto px-5 py-16 sm:px-8 max-w-[var(--breakpoint-xl)]">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">
          {r("AppPrivacy.Title", "Cadence app: privacy policy")}
        </h1>
        <p className="text-lg dark:text-white mb-2">
          {r("AppPrivacy.Supplement.Before", "")}
          <a
            href={`/${locale}/legal/privacy/`}
            className="text-brand-hover dark:text-brand hover:underline"
          >
            {r("AppPrivacy.Supplement.Link", "")}
          </a>
          {r("AppPrivacy.Supplement.After", "")}
        </p>
        <p className="text-xs dark:text-white mb-2">
          {r("AppPrivacy.LastUpdated", "Last updated")}:{" "}
          {formatDate("2026-11-20", locale)}
        </p>
        <Separator className="mt-6" />
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        {/* Controller */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            {r("AppPrivacy.Controller.Title", "")}
          </h2>
          <div className="space-y-4">
            <p>{r("AppPrivacy.Controller.Content", "")}</p>
          </div>
        </section>

        {/* What the app processes */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            {r("AppPrivacy.Processing.Title", "")}
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i}>{r(`AppPrivacy.Processing.Items.${i}`, "")}</li>
            ))}
          </ul>
        </section>

        {textSections.map((section) => (
          <section key={section} className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">
              {r(`AppPrivacy.${section}.Title`, "")}
            </h2>
            <div className="space-y-4">
              <p>{r(`AppPrivacy.${section}.Content`, "")}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
