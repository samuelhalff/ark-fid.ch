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

export const revalidate = false;

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/team");
}
// teamMembers now imported from shared module

export default async function TeamPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = (params?.locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(locale, "team");
  const tNav = await getTranslations(locale, "navbar");
  const tRessources = await getTranslations(locale, "ressources");
  const nonce = headers().get("x-nonce") || undefined;
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
    <div className="container mx-auto px-4 py-15 mt-20 max-w-[var(--breakpoint-xl)]">
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
      <div className="text-center mb-12 animate-in fade-in duration-900">
        <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold leading-[1.2]! tracking-tight">
          {title}
        </h1>
        <p className="mt-2">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-25 animate-in slide-in-from-bottom-7 duration-500">
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
                href={`${localePrefix}/team/${slug}`}
                key={member.name}
                className="block"
              >
                <Card
                  className={
                    "animate-in fade-in duration-250 text-center shadow-none hover:shadow-lg transition-shadow gap-2 py-3 border-0 hover:brightness-[1.15]"
                  }
                >
                  <CardHeader className="px-3 sm:px-4">
                    <div className="relative aspect-4/5 w-full rounded-md overflow-hidden mb-4 h-80">
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
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="text-left h-12 px-4">
                    <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                      {member.name}
                    </h3>
                    <h2>
                      {(t(`Role.${member.role}`) as string) || member.role}
                    </h2>
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
      />
    </div>
  );
}
