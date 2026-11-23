import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { ogPages } from "@/src/lib/public-pages";

/*
 * Share image (1200 × 630) of each French and English public page, written
 * at build time: /assets/og-pages/<key>.webp (rendered as PNG by next/og,
 * stored as WebP: about 35 KB instead of 230 KB). Same look as the site: near-black
 * background with the copper glow of the hero, light logo, Inter.
 * Other locales and unknown pages keep /assets/og/og-<locale>.webp.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...ogPages().keys()].map((key) => ({ key: `${key}.webp` }));
}

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f));
const font = (f: string) => read(`src/og/${f}.ttf`);
const LOGO = `data:image/svg+xml;base64,${read("public/assets/arkfid--light.svg").toString("base64")}`;

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const page = ogPages().get(key.replace(/\.webp$/, ""));
  if (!page) return new Response("Not found", { status: 404 });
  const size = page.title.length > 90 ? 50 : page.title.length > 64 ? 58 : page.title.length > 40 ? 66 : 76;
  const png = new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "Inter",
        }}
      >
        {/* Copper glow in the top-left corner (satori centres radial gradients, hence the offset box). */}
        <div
          style={{
            position: "absolute",
            left: -650,
            top: -650,
            width: 1300,
            height: 1300,
            display: "flex",
            backgroundImage: "radial-gradient(circle, rgba(205,120,76,0.5) 0%, rgba(205,120,76,0.14) 40%, rgba(10,10,10,0) 70%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "64px 80px 56px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} width={290} height={70} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {page.rubric ? <span style={{ fontSize: 30, fontWeight: 600, color: "#d79171" }}>{page.rubric}</span> : null}
            <span style={{ fontSize: size, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1, maxWidth: 1040 }}>{page.title}</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 400, color: "#a3a3a3" }}>
            <span>ark-fid.ch</span>
          </div>
        </div>
        <div style={{ height: 10, backgroundColor: "#d79171" }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: font("inter-regular"), weight: 400, style: "normal" },
        { name: "Inter", data: font("inter-semibold"), weight: 600, style: "normal" },
        { name: "Inter", data: font("inter-bold"), weight: 700, style: "normal" },
      ],
    },
  );
  const webp = await sharp(Buffer.from(await png.arrayBuffer())).webp({ quality: 82 }).toBuffer();
  return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp" } });
}
