import { ImageResponse } from "next/og";

// Route Segment Config
export const runtime = "nodejs";
// Cache for 1 day as article titles seldom change. Adjust if editing frequency differs.
export const revalidate = 60 * 60 * 24; // 24h
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic Open Graph image for article pages.
 * Displays localized title, brand mark, and subtle background.
 */
export default async function Image({
  params,
}: {
  params: { slug: string; locale: string };
}) {
  const { slug, locale } = params;
  const translationsModule = await import(
    `@/src/translations/${locale}/ressources.json`
  );
  const ressources = translationsModule.default as {
    Articles?: Array<{
      slug: string;
      title: string;
      date?: string;
    }>;
  };
  const article = ressources.Articles?.find((entry) => entry.slug === slug);
  if (!article) {
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 48,
            background: "#111827",
            color: "white",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Article not found
        </div>
      ),
      size
    );
  }

  const brand = "Ark Fiduciaire";
  const bg =
    locale === "fr"
      ? "linear-gradient(135deg,#0f172a,#1e293b)"
      : "linear-gradient(135deg,#1e293b,#334155)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: bg,
          padding: 64,
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 48,
            lineHeight: 1.15,
            fontWeight: 600,
            whiteSpace: "pre-wrap",
            display: "flex",
          }}
        >
          {article.title.length > 120
            ? article.title.slice(0, 117) + "…"
            : article.title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 500, display: "flex" }}>
            {brand}
          </div>
          <div style={{ fontSize: 20, opacity: 0.85, display: "flex" }}>
            {locale.toUpperCase()} · {new Date().getFullYear()}
          </div>
        </div>
      </div>
    ),
    size
  );
}
