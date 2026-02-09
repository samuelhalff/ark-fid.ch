import { headers } from "next/headers";
import { Metadata } from "next";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildBreadcrumbList } from "@/src/lib/structuredData";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { generateMetadataForPage } from "@/src/lib/metadata";
import AgentChat from "@/src/components/agent/AgentChat";

export const revalidate = false;

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/agent");
}

export default async function AgentPage({
  params,
}: {
  params: { locale: string };
}) {
  const nonce = headers().get("x-nonce") || undefined;
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
      name: text("Title", "Instant quote assistant"),
      item: `https://ark-fid.ch${localePrefix}/agent/`,
    },
  ]);

  const chatStrings = {
    lead: {
      title: text("Lead.Title", "Start with your email"),
      description: text(
        "Lead.Description",
        "We use it to follow up with a tailored quote. Other fields are optional."
      ),
      verificationLabel: text(
        "Lead.VerificationLabel",
        "Verification"
      ),
      verificationRequired: text(
        "Lead.VerificationRequired",
        "Please complete the verification."
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
      error: text("Chat.Error", "We couldn't reach the assistant. Please try again."),
      rateLimit: text(
        "Chat.RateLimit",
        "Too many requests. Please wait a moment."
      ),
      startHint: text(
        "Chat.StartHint",
        "Enter a valid email to start the chat."
      ),
      invalidEmailDomain: text(
        "Chat.InvalidEmailDomain",
        "Please use a valid business email domain."
      ),
    },
    suggestions: {
      title: text("Suggestions.Title", "Try one of these questions"),
    },
    disclaimer: text(
      "Disclaimer",
      "Responses are indicative and will be confirmed by a specialist."
    ),
  } as const;

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-10">
      <StructuredData nonce={nonce} data={[breadcrumbJsonLd]} />
      <header className="max-w-3xl mx-auto text-center space-y-4 mb-10">
        <h1 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight">
          {text("Title", "Instant quote assistant")}
        </h1>
        <p className="text-lg text-muted-foreground">
          {text(
            "Subtitle",
            "Get an approximate quote and clear next steps in minutes."
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {text(
            "Intro",
            "Describe your needs and our AI assistant will suggest services and guidance without being pushy."
          )}
        </p>
      </header>

      <div className="max-w-4xl mx-auto">
        <AgentChat strings={chatStrings} suggestions={suggestions} />
      </div>
    </main>
  );
}
