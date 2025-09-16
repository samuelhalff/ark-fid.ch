import { Metadata } from "next";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/src/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import ImageWithFallback from "@/src/components/ui/image-with-fallback";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { headers } from "next/headers";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/team");
}
const teamMembers = [
  {
    name: "Hassan Barbir",
    role: "Partner",
    profilePic: "/assets/hb.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/hassanbarbir",
    },
  },
  {
    name: "Samuel Halff",
    role: "ManagingPartner",
    profilePic: "/assets/sh.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/samuelhalff",
    },
  },
  {
    name: "Rodrigue Sperisen",
    role: "Partner",
    profilePic: "/assets/rs.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/rodrigue-sperisen-74543a185",
    },
  },
  {
    name: "Lassana Dioum",
    role: "Partner",
    profilePic: "/assets/ld.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/lassana-dioum-b429622b",
    },
  },
  {
    name: "Anthony Touboul",
    role: "Tax",
    profilePic: "/assets/at.webp",
    social: {
      linkedin: "https://ch.linkedin.com/in/touboulanthony",
    },
  },
  {
    name: "Celeste Leal",
    role: "OfficeProjectManager",
    profilePic: "/assets/cl.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/c%C3%A9lesteleal",
    },
  },
  {
    name: "Sébastien Gallié",
    role: "SeniorAccountant",
    profilePic: "/assets/missing-profile.svg",
    social: {
      linkedin: "https://ch.linkedin.com/in/s%C3%A9bastien-galli%C3%A9",
    },
  },
  {
    name: "Maulk Hamdi",
    role: "Associate",
    profilePic: "/assets/missing-profile.svg",
    social: {
      linkedin: "https://www.linkedin.com/in/maulk-hamdi-b47b68361",
    },
  },
];

export default async function TeamPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = (params?.locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(locale, "team");
  const tNav = await getTranslations(locale, "navbar");
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
          .map((member) => (
            <Link
              href={member.social.linkedin}
              key={member.name}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card
                className={
                  "animate-in fade-in duration-250 text-center shadow-none hover:shadow-lg transition-shadow gap-2 py-5 border-0 hover:brightness-115"
                }
              >
                <CardHeader>
                  <div className="aspect-4/5 w-full rounded-md overflow-hidden mb-4 relative h-96">
                    <ImageWithFallback
                      src={member.profilePic}
                      alt={`Portrait of ${member.name}`}
                      className="w-full h-full object-cover"
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      // allow browser to lazy-load team images
                    />
                  </div>
                </CardHeader>
                <CardContent className="text-left h-12">
                  <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                    {member.name}
                    <div className="float-right">
                      <Image
                        width={25}
                        height={25}
                        className="opacity-80"
                        src="/assets/li.webp"
                        alt="LinkedIn logo"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </h3>
                  <h2>{(t(`Role.${member.role}`) as string) || member.role}</h2>
                </CardContent>
                <CardFooter className="flex justify-center"></CardFooter>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  );
}
