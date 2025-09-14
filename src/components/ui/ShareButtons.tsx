"use client";
import React from "react";

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
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM0 8h5v16H0zM9 8h4.8v2.2h.1c.7-1.3 2.4-2.7 5-2.7 5.3 0 6.3 3.5 6.3 8v8.5h-5V16c0-2.3 0-5.2-3.2-5.2-3.2 0-3.7 2.5-3.7 5v8.2H9z" />
        </svg>
        LinkedIn
      </a>
      <a
        className={baseBtn}
        href={links.twitter}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M18 2h4l-9 11 7 9h-4l-5-6-5 6H2l9-11L4 2h4l5 6 5-6z" />
        </svg>
        X
      </a>
      <a
        className={baseBtn}
        href={links.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M20 3.5A10.5 10.5 0 1 1 9.3 22l-4.8 1.3 1.3-4.7A10.5 10.5 0 1 1 20 3.5zM7 8.5c.2-.6.7-1.2 1.3-1.4.3-.1.6 0 .8.3l1.1 1.7c.1.2.1.4 0 .6l-.5.8c.7 1.2 1.8 2.3 3 3l.8-.5c.2-.1.4-.1.6 0l1.7 1.1c.3.2.4.5.3.8-.2.6-.8 1.1-1.4 1.3-.7.2-1.5.1-2.1-.2-1.8-.8-3.5-2.4-4.3-4.2-.3-.7-.4-1.5-.2-2.2z" />
        </svg>
        WhatsApp
      </a>
      <a className={baseBtn} href={links.mailto} aria-label="Share via email">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4h16v16H4z" />
          <path d="m22 6-10 7L2 6" />
        </svg>
        Email
      </a>
      <button
        type="button"
        className={baseBtn}
        onClick={copyLink}
        aria-live="polite"
        aria-label="Copy link"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 15 7 17a5 5 0 1 1 0-7l2 2" />
          <path d="m15 9 2-2a5 5 0 1 1 0 7l-2-2" />
          <path d="M8 12h8" />
        </svg>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
