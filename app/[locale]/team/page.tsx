import { Metadata } from "next";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/src/components/ui/card";
import Link from "next/link";
import ImageWithFallback from "@/src/components/ui/image-with-fallback";
import ContactSection from "../ressources/articles/components/ContactSection";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { headers } from "next/headers";
import { teamMembers, getMemberSlug } from "@/src/lib/team";
import { teamImageMap } from "@/src/lib/teamImages";
import teamBlurData from "@/src/lib/teamBlurData.json";
import PageHero from "@/src/components/site/page-hero";

export const revalidate = false;

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  return await generateMetadataForPage(locale as Locale, "/team");
}
// teamMembers now imported from shared module

export default async function TeamPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const locale = (params?.locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(locale, "team");
  const tNav = await getTranslations(locale, "navbar");
  const tRessources = await getTranslations(locale, "ressources");
  const nonce = (await headers()).get("x-nonce") || undefined;
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = params?.locale ? `/${params.locale}` : "/fr";

  const title = (t("Title") as string) || "Our team";
  const subtitle =
    (t("Subtitle") as string) || "A team of complementary talents";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: (tNav("Home") as string) || "Home",
        item: `${baseUrl}${localePrefix}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: title,
        item: `${baseUrl}${localePrefix}/team/`,
      },
    ],
  } as const;

  return (
    <div className="container mx-auto mt-20 max-w-[var(--breakpoint-xl)] px-4 py-12">
      <link
        rel="preload"
        as="image"
        href={
          teamMembers[0]?.profilePic || "/assets/abstract-background-light.webp"
        }
      />
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
            <span aria-current="page" className="font-medium text-foreground">
              {title}
            </span>
          </li>
        </ol>
      </nav>
      <div className="mb-12 animate-in fade-in duration-900">
        <PageHero
          eyebrow={title}
          title={subtitle}
          description={
            locale === "fr"
              ? "Une équipe expérimentée à Genève et à Lausanne au service des entreprises en Suisse romande et à l'international."
              : undefined
          }
        />
      </div>

      <div className="mb-24 grid grid-cols-1 gap-5 animate-in slide-in-from-bottom-7 duration-500 md:grid-cols-2 xl:grid-cols-3">
        {teamMembers
          .sort((a, b) =>
            a.name
              .split(" ")[1]
              .localeCompare(b.name.split(" ")[1], undefined, {
                sensitivity: "base",
              })
          )
          .map((member) => {
            const slug = getMemberSlug(member);
            return (
              <Link
                href={`${localePrefix}/team/${slug}/`}
                key={member.name}
                className="block"
              >
                <Card
                  className={
                    "animate-in gap-3 rounded-[28px] border border-border/70 bg-gradient-to-br from-muted/50 via-background to-muted/20 py-4 text-left shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:shadow-lg"
                  }
                >
                  <CardHeader className="px-3 sm:px-4">
                    <div className="relative mb-4 h-80 w-full overflow-hidden rounded-[22px] border border-border/60 bg-muted/40 aspect-4/5">
                      <ImageWithFallback
                        src={
                          (teamImageMap as Record<string, any>)[
                            member.profilePic
                          ] || member.profilePic
                        }
                        alt={`Portrait of ${member.name}`}
                        className="w-full h-full object-cover object-top"
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        loading="lazy"
                        fallbackVariant="initials"
                        fallbackInitialsName={member.name}
                        fallbackClassName="absolute inset-0"
                        placeholder={
                          (teamBlurData as Record<string, string>)[
                            member.profilePic
                          ]
                            ? "blur"
                            : undefined
                        }
                        blurDataURL={
                          (teamBlurData as Record<string, string>)[
                            member.profilePic
                          ]
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-2">
                    <div>
                      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                      {member.name}
                      </h3>
                      <p className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#B86340]">
                        {(t(`Role.${member.role}`) as string) || member.role}
                      </p>
                    </div>
                    {member.bioShort ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {member.bioShort}
                      </p>
                    ) : null}
                    {member.languages?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {member.languages.slice(0, 3).map((language) => (
                          <span
                            key={language}
                            className="rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                          >
                            {language}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="flex justify-center"></CardFooter>
                </Card>
              </Link>
            );
          })}
      </div>

      <ContactSection
        locale={locale}
        title={
          (tRessources("Contact.Title") as string) ||
          "Questions about our team?"
        }
        description={
          (tRessources("Contact.Description") as string) ||
          "Our team is here to help you with your business needs. Get in touch to discuss your project."
        }
        buttonText={
          (tRessources("Contact.ButtonText") as string) || "Contact Our Team"
        }
        secondaryButtonText={
          (tRessources("Contact.SecondaryButtonText") as string) ||
          "Get an instant quote"
        }
      />
    </div>
  );
}
