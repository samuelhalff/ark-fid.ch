import { Metadata } from "next";
import Image from "next/image";
import ImageWithFallback from "@/src/components/ui/image-with-fallback";
import InitialsTile from "@/src/components/ui/initials-tile";
import { teamImageMap } from "@/src/lib/teamImages";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { locales } from "@/src/lib/i18n-locales";
import {
  teamMembers,
  findMemberBySlug,
  getMemberSlug,
  isPartnerRole,
} from "@/src/lib/team";
import { getPageMetadata } from "@/src/lib/metadata";
import { Card, CardContent } from "@/src/components/ui/card";

type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  // Pre-render all member pages for all locales
  const slugs = teamMembers.map((m) => getMemberSlug(m));
  return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const member = findMemberBySlug(params.slug);
  const name = member?.name ?? "Team Member";
  const title = `${name} — Ark Fiduciaire`;
  const description = member
    ? `${name} — ${member.role} at Ark Fiduciaire.`
    : "Ark Fiduciaire team member.";
  // Start from base page metadata to ensure canonical, alternates (hreflang) and robots are present
  const base = await getPageMetadata(
    params.locale as Locale,
    `/team/${params.slug}`
  );
  const isMissing = !member?.profilePic || (member.profilePic || "").includes("missing-profile.svg");
  const ogImages = member
    ? [{ url: isMissing ? "/assets/abstract-background-light.webp" : member.profilePic, width: 800, height: 1000, alt: name }]
    : (base.openGraph?.images as any);
  return {
    ...base,
    title,
    description,
    openGraph: {
      ...(base.openGraph || {}),
      title,
      description,
      images: ogImages,
    },
    twitter: {
      ...(base.twitter || {}),
      card: "summary_large_image",
      title,
      description,
      images: ogImages
        ? Array.isArray(ogImages)
          ? ogImages.map((i: any) => (typeof i === "string" ? i : i.url))
          : [ogImages as any]
        : (base as any).twitter?.images,
    },
  };
}

export default async function TeamMemberPage({ params }: { params: Params }) {
  const locale = (params?.locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(locale, "team");
  const tBios = await getTranslations(locale, "team-bios");
  const tNav = await getTranslations(locale, "navbar");
  const tDetails = await getTranslations(locale, "team-details");
  const nonce = headers().get("x-nonce") || undefined;
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = params?.locale ? `/${params.locale}` : "/fr";

  const member = findMemberBySlug(params.slug);
  if (!member) return notFound();

  const title = member.name;
  const roleLabel = (t(`Role.${member.role}`) as string) || member.role;
  const slug = getMemberSlug(member);
  const bioShortKey = `Bios.${slug}.short`;
  const bioLongKey = `Bios.${slug}.long`;
  const rawShort = tBios(bioShortKey) as string;
  const rawLong = tBios(bioLongKey) as string;
  const bioShort =
    rawShort && rawShort !== bioShortKey ? rawShort : member.bioShort;
  const bioLong = rawLong && rawLong !== bioLongKey ? rawLong : member.bioLong;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${baseUrl}${localePrefix}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Team",
        item: `${baseUrl}${localePrefix}/team/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: `${baseUrl}${localePrefix}/team/${params.slug}/`,
      },
    ],
  } as const;

  // Localized details with fallback to member fields
  const getArray = (key: string, fallback?: string[]) => {
    const val = tDetails(key) as unknown;
    return Array.isArray(val) ? val : fallback || [];
  };
  const education = getArray(`Details.${slug}.education`, member.education);
  const languages = getArray(`Details.${slug}.languages`, member.languages);
  const memberships = getArray(
    `Details.${slug}.memberships`,
    member.memberships
  );
  const credentials = getArray(
    `Details.${slug}.credentials`,
    member.credentials
  );

  return (
    <div className="container mx-auto px-4 py-15 mt-20 mb-20 max-w-[var(--breakpoint-xl)]">
      {(() => {
        const mapped = (teamImageMap as Record<string, any>)[member.profilePic] || member.profilePic;
        const preloadSrc = typeof mapped === 'string' ? mapped : (mapped && typeof mapped === 'object' && 'src' in mapped ? (mapped as any).src : '/assets/abstract-background-light.webp');
        return <link rel="preload" as="image" href={preloadSrc} />;
      })()}
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="px-0 mt-2 mb-6">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground justify-center">
          <li>
            <a href={`${localePrefix}/`} className="hover:underline">
              {(tNav("Home") as string) || "Home"}
            </a>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-muted-foreground/60">/</span>
            <a href={`${localePrefix}/team/`} className="hover:underline">
              {(t("Title") as string) || "Team"}
            </a>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-muted-foreground/60">/</span>
            <span aria-current="page" className="font-medium text-foreground">
              {title}
            </span>
          </li>
        </ol>
      </nav>
      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-10 items-start">
        <div className="rounded-xl overflow-hidden shadow-sm border bg-card">
          <div className="relative aspect-4/5 w-full h-[480px]">
            {(() => {
              const mapped = (teamImageMap as Record<string, any>)[member.profilePic] || member.profilePic;
              const preloadHref = typeof mapped === "object" && mapped && "src" in mapped ? (mapped as any).src : (mapped as string);
              // Preload main portrait for faster LCP on member page
              // @ts-ignore - allow raw link tag here
              // eslint-disable-next-line @next/next/no-sync-scripts
              return (
                <>
                  <link rel="preload" as="image" href={preloadHref} />
                <ImageWithFallback
                  src={mapped as any}
                  alt={`Portrait of ${member.name}`}
                  fill
                  priority
                  fetchPriority="high"
                  quality={70}
                  placeholder={undefined}
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="object-cover object-top"
                  fallbackVariant="initials"
                  fallbackInitialsName={member.name}
                  fallbackClassName="absolute inset-0"
                />
                </>
              );
            })()}
          </div>
        </div>

        <Card className="shadow-sm border bg-card/70">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-balance">
                  {title}
                </h1>
                <p className="mt-1 text-muted-foreground">{roleLabel}</p>
              </div>
              {isPartnerRole(member.role) ? (
                <Link
                  href={member.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn profile"
                  className="inline-flex items-center justify-center rounded-full hover:opacity-90 transition-opacity"
                >
                  <Image
                    src="/assets/team/li.webp"
                    width={25}
                    height={25}
                    alt="LinkedIn"
                    className="opacity-80"
                  />
                </Link>
              ) : null}
            </div>

            <hr className="my-6 border-border/60" />

            <div className="prose prose-neutral max-w-none dark:prose-invert">
              <p className="text-base leading-7 mb-4">{bioLong || bioShort}</p>

              {/* Enriched details (optional) */}
              {education.length ||
              languages.length ||
              memberships.length ||
              credentials.length ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {education.length ? (
                    <div>
                      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                        {(t("Labels.Education") as string) || "Education"}
                      </h3>
                      <ul className="mt-2 list-disc pl-5 text-sm">
                        {education.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {languages.length ? (
                    <div>
                      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                        {(t("Labels.Languages") as string) || "Languages"}
                      </h3>
                      <p className="mt-2 text-sm">{languages.join(", ")}</p>
                    </div>
                  ) : null}
                  {memberships.length ? (
                    <div>
                      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                        {(t("Labels.Memberships") as string) || "Memberships"}
                      </h3>
                      <ul className="mt-2 list-disc pl-5 text-sm">
                        {memberships.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {credentials.length ? (
                    <div>
                      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                        {(t("Labels.Credentials") as string) || "Credentials"}
                      </h3>
                      <ul className="mt-2 list-disc pl-5 text-sm">
                        {credentials.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* No big CTA button; keep header icon link only for partners */}
          </CardContent>
        </Card>
      </div>

      {/* PBM attribution note at the very bottom */}
      {isPartnerRole(member.role) ? (
        <p className="mt-10 text-center text-xs text-muted-foreground/80">
          {(t("PBM.Note") as string) || "Senior partner at PBM law firm."}{" "}
          <a
            className="underline hover:no-underline"
            href={member.pbmUrl || "https://pbm.law"}
            target="_blank"
            rel="noopener noreferrer"
          >
            {(t("PBM.LearnMore") as string) || "Learn more"}
          </a>
          : pbm.law
        </p>
      ) : null}
    </div>
  );
}
