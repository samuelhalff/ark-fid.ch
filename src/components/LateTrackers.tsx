"use client";

import dynamic from "next/dynamic";
import IdleMount from "@/src/components/IdleMount";

// Render-less code: loaded after idle / first interaction, outside the first-paint bundle.
const OpenAiPixel = dynamic(() => import("@/src/components/OpenAiPixel"), { ssr: false });
const AttributionTracker = dynamic(() => import("@/src/components/AttributionTracker"), { ssr: false });
const EngagementTracker = dynamic(() => import("@/src/components/EngagementTracker"), { ssr: false });

export default function LateTrackers({ nonce }: { nonce?: string }) {
  return (
    <IdleMount>
      <OpenAiPixel nonce={nonce} />
      <AttributionTracker />
      <EngagementTracker />
    </IdleMount>
  );
}
