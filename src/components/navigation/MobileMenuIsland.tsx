"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { NavData } from "@/src/components/navigation/types";

const DynamicMobileMenu = dynamic(
  () => import("@/src/components/navigation/MobileMenu"),
  {
    ssr: false,
  }
);

export default function MobileMenuIsland({
  locale,
  navData,
}: {
  locale?: string;
  navData: NavData;
}) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setShouldRender(mq.matches);
    update();
    try {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } catch {
      // Safari fallback
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  if (!shouldRender) return null;
  return <DynamicMobileMenu locale={locale} navData={navData} />;
}
