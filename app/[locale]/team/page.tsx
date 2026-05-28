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
import {
  teamMembers,
  getMemberSlug,
  getTeamMembersSortedByLastName,
} from "@/src/lib/team";
import { teamImageMap } from "@/src/lib/teamImages";
import teamBlurData from "@/src/lib/teamBlurData.json";
import PageHero from "@/src/components/site/page-hero";
import Reveal from "@/src/components/motion/reveal";

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

  const title = locale === "fr" ? "L'équipe" : (t("Title") as string) || "Our team";
  const subtitle =
    locale === "fr"
      ? "Une équipe de talents complémentaires."
      : (t("Subtitle") as string) || "A team of complementary talents";
  const orderedTeamMembers = getTeamMembersSortedByLastName(teamMembers);

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
  const teamItemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${baseUrl}${localePrefix}/team/#team`,
    name: title,
    itemListElement: orderedTeamMembers.map((member, index) => {
      const slug = getMemberSlug(member);
      return {
        "@type": "ListItem",
        position: index + 1,
        url: `${baseUrl}${localePrefix}/team/${slug}/`,
        name: member.name,
      };
    }),
  } as const;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 sm:py-12">
      <link
        rel="preload"
        as="image"
        href={
          orderedTeamMembers[0]?.profilePic ||
          "/assets/abstract-background-light.webp"
        }
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(teamItemListJsonLd),
        }}
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
      <Reveal className="mb-12">
        <PageHero
          eyebrow={title}
          title={subtitle}
          description={
            locale === "fr"
              ? "Une équipe expérimentée à Genève et à Lausanne au service des entreprises en Suisse romande et à l'international."
              : undefined
          }
        />
      </Reveal>

      <div className="mb-24 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {orderedTeamMembers.map((member, index) => {
          const slug = getMemberSlug(member);
          return (
            <Reveal key={member.name} delay={Math.min(index * 0.05, 0.25)}>
              <Link
                href={`${localePrefix}/team/${slug}/`}
                className="block h-full"
              >
                <Card
                  className={
                    "group h-full min-h-[620px] gap-3 rounded-[28px] bg-surface-warm py-4 text-left shadow-sm transition-colors duration-200 hover:bg-card dark:bg-card dark:hover:bg-surface-warm"
                  }
                >
                  <CardHeader className="px-3 sm:px-4">
                    <div
                      className="relative mb-4 h-[360px] w-full shrink-0 overflow-hidden rounded-[22px] bg-muted/45"
                      style={{ height: 360 }}
                    >
                      <ImageWithFallback
                        src={
                          (teamImageMap as Record<string, any>)[
                            member.profilePic
                          ] || member.profilePic
                        }
                        alt={`Portrait of ${member.name}`}
                        className="h-full w-full object-cover object-top"
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
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-foreground/0 transition-colors duration-500 group-hover:bg-foreground/[0.04] dark:group-hover:bg-white/[0.05]"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-0 left-0 h-1 w-0 bg-brand transition-[width] duration-500 ease-out group-hover:w-full"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-2">
                    <div>
                      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                        {member.name}
                      </h3>
                      <p className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-brand-hover">
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
                            className="rounded-full bg-background/80 px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground"
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
            </Reveal>
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
