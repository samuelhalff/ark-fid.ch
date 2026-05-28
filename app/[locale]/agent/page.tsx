import { headers } from "next/headers";
import { Metadata } from "next";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildBreadcrumbList, buildSoftwareApplication, buildServiceSchema } from "@/src/lib/structuredData";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { generateMetadataForPage } from "@/src/lib/metadata";
import AgentChat from "@/src/components/agent/AgentChat";
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

  return await generateMetadataForPage(locale as Locale, "/agent");
}

export default async function AgentPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const nonce = (await headers()).get("x-nonce") || undefined;
  const locale = params.locale as Locale;
  const localePrefix = locale ? `/${locale}` : "/fr";
  const t = await getTranslations(locale, "agent");
  const tNav = await getTranslations(locale, "navbar");

  const text = (key: string, fallback: string) => {
    const value = t(key);
    return typeof value === "string" && value !== key ? value : fallback;
  };

  const defaultSuggestions = [
    "Estimate the cost for domiciliation in Geneva",
    "What documents are needed to incorporate a company in Switzerland?",
    "We need payroll for 12 employees—what's the next step?",
  ];
  const suggestionsRaw = t("Suggestions.Items");
  const suggestions = Array.isArray(suggestionsRaw)
    ? suggestionsRaw.filter((item) => typeof item === "string")
    : defaultSuggestions;

  const breadcrumbJsonLd = buildBreadcrumbList([
    {
      name: (tNav("Home") as string) || "Home",
      item: `https://ark-fid.ch${localePrefix}/`,
    },
    {
      name: text("Title", "Instant quote"),
      item: `https://ark-fid.ch${localePrefix}/agent/`,
    },
  ]);

  const softwareAppJsonLd = buildSoftwareApplication({
    name: text("Title", "Instant Quote Assistant"),
    description: text(
      "Subtitle",
      "AI-powered quote assistant for fiduciary services in Geneva and Lausanne"
    ),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web Browser",
    offers: {
      price: "0",
      priceCurrency: "CHF",
    },
    author: {
      name: "Ark Fiduciaire",
      url: "https://ark-fid.ch",
    },
  });

  const serviceJsonLd = buildServiceSchema({
    name: text("Title", "Instant Quote Service"),
    description: text(
      "Intro",
      "Get instant estimates for accounting, tax, payroll and fiduciary services"
    ),
    serviceType: "Financial Service",
    url: `https://ark-fid.ch${localePrefix}/agent/`,
    areaServed: ["Geneva", "Lausanne", "Romandy", "Switzerland"],
    provider: {
      name: "Ark Fiduciaire",
      url: "https://ark-fid.ch",
      logo: "https://ark-fid.ch/assets/arkfid--color.svg",
    },
  });

  const chatStrings = {
    lead: {
      title: text("Lead.Title", "Unlock chat"),
      description: text(
        "Lead.Description",
        "Add your email to access the chat.",
      ),
      helper: text(
        "Lead.Helper",
        "We use it to send your estimate and follow up if needed.",
      ),
      verificationLabel: text("Lead.VerificationLabel", "Verification"),
      verificationRequired: text(
        "Lead.VerificationRequired",
        "Please complete the verification.",
      ),
      fields: {
        name: text("Lead.Fields.Name", "Name"),
        email: text("Lead.Fields.Email", "Email"),
      },
      placeholders: {
        name: text("Lead.Placeholders.Name", "Your name"),
        email: text("Lead.Placeholders.Email", "email@example.com"),
      },
      button: text("Lead.Button", "Start chat"),
      confirmed: text("Lead.Confirmed", "Chat ready"),
    },
    chat: {
      placeholder: text("Chat.Placeholder", "Describe your request..."),
      send: text("Chat.Send", "Send"),
      thinking: text("Chat.Thinking", "Thinking..."),
      error: text(
        "Chat.Error",
        "We couldn't reach the assistant. Please try again.",
      ),
      rateLimit: text(
        "Chat.RateLimit",
        "Too many requests. Please wait a moment.",
      ),
      startHint: text("Chat.StartHint", "Enter your email to start."),
      invalidEmailDomain: text(
        "Chat.InvalidEmailDomain",
        "Please use a valid business email domain.",
      ),
      readyHint: text(
        "Chat.ReadyHint",
        "Chat ready. You can start typing below.",
      ),
      reconnect: text("Chat.Reconnect", "Reconnect"),
      clearHistory: text(
        "Chat.ClearHistory",
        "An error occurred. Clear history.",
      ),
    },
    suggestions: {
      title: text("Suggestions.Title", "Try one of these questions"),
    },
    disclaimer: text(
      "Disclaimer",
      "Responses are indicative and will be confirmed by a specialist.",
    ),
  } as const;

  return (
    <main className="agent-page flex h-[100svh] flex-col overflow-hidden">
      <div className="agent-page-dim" aria-hidden="true" />
      <div className="agent-page-content flex min-h-0 flex-1 flex-col">
        <StructuredData nonce={nonce} data={[breadcrumbJsonLd, softwareAppJsonLd, serviceJsonLd]} />
        <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col px-5 sm:px-8">
          {/* Header — shrinks to its content */}
          <div className="mx-auto w-full max-w-4xl shrink-0 pb-6 pt-8 sm:pt-10">
            <PageHero
              eyebrow={text("Lead.Title", "Parler à notre agent")}
              title={text("Title", "Instant quote")}
              description={text("Subtitle", "Get a quick estimate for your request.")}
              eyebrowClassName="text-brand"
              titleClassName="text-white"
              descriptionClassName="text-white/68"
            >
              <p className="max-w-2xl text-sm leading-7 text-white/60">
                {text(
                  "Intro",
                  "Describe what you need and receive the next steps.",
                )}
              </p>
            </PageHero>
          </div>
          {/* Chat card — takes all remaining height; inner scroll */}
          <div className="mx-auto mb-5 flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-[34px] bg-card text-foreground shadow-[0_26px_80px_rgba(0,0,0,0.42)] sm:mb-7">
            <AgentChat strings={chatStrings} suggestions={suggestions} />
          </div>
        </div>
      </div>
    </main>
  );
}
