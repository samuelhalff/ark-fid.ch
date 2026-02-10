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
      name: text("Title", "Instant quote"),
      item: `https://ark-fid.ch${localePrefix}/agent/`,
    },
  ]);

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
    <main className="agent-page min-h-[100svh] h-[100svh] overflow-hidden">
      <div className="agent-page-dim" aria-hidden="true" />
      <div className="agent-page-content max-w-[1200px] mx-auto px-4 md:px-6 py-10 flex flex-col gap-8 h-full min-h-0">
        <StructuredData nonce={nonce} data={[breadcrumbJsonLd]} />
        <header className="max-w-3xl mx-auto text-center space-y-4 shrink-0">
          <h1 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight">
            {text("Title", "Instant quote")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {text("Subtitle", "Get a quick estimate for your request.")}
          </p>
          <p className="text-sm text-muted-foreground">
            {text(
              "Intro",
              "Describe what you need and receive the next steps.",
            )}
          </p>
        </header>

        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col min-h-0">
          <AgentChat strings={chatStrings} suggestions={suggestions} />
        </div>
      </div>
    </main>
  );
}
