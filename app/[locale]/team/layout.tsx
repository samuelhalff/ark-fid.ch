/* eslint-disable @next/next/no-css-tags */
import { Metadata } from "next";
import { inter } from "../../fonts";

export const metadata: Metadata = {
  title: "Team - Ark Fiduciaire SA",
};

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
