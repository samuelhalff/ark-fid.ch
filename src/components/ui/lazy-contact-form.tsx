"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type ContactFormType from "@/src/components/ui/contact-form";

// The form sits behind <Defer> (not part of the first server HTML), so its
// code (react-hook-form, zod, radix, toasts) is fetched only when it mounts.
const ContactForm = dynamic(() => import("@/src/components/ui/contact-form"), {
  ssr: false,
});

export default function LazyContactForm(props: ComponentProps<typeof ContactFormType>) {
  return <ContactForm {...props} />;
}
