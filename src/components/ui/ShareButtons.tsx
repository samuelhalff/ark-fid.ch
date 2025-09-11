"use client";
import React from "react";
import {
  Linkedin,
  Twitter,
  Mail,
  Link as LinkIcon,
  MessageCircle,
} from "lucide-react";

type Props = {
  url: string;
  title?: string;
  className?: string;
};

export default function ShareButtons({ url, title, className }: Props) {
  const [copied, setCopied] = React.useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title || "");

  const links = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    mailto: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A%0A${encodedUrl}`,
  } as const;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  const baseBtn =
    "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary";

  return (
    <div
      className={"flex flex-wrap items-center gap-2 " + (className || "")}
      aria-label="Share this article"
    >
      <a
        className={baseBtn}
        href={links.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="h-4 w-4" /> LinkedIn
      </a>
      <a
        className={baseBtn}
        href={links.twitter}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
      >
        <Twitter className="h-4 w-4" /> X
      </a>
      <a
        className={baseBtn}
        href={links.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
      <a className={baseBtn} href={links.mailto} aria-label="Share via email">
        <Mail className="h-4 w-4" /> Email
      </a>
      <button
        type="button"
        className={baseBtn}
        onClick={copyLink}
        aria-live="polite"
        aria-label="Copy link"
      >
        <LinkIcon className="h-4 w-4" /> {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
