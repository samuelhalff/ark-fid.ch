import Link from "next/link";
import type { Locale } from "@/src/lib/i18n";

const ChatBubbleIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
    <path d="M8 9h8M8 13h5" />
  </svg>
);

export default function AgentFloatingButton({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-40">
      <Link
        href={`/${locale}/agent/`}
        prefetch={false}
        aria-label={label}
        className="group flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <ChatBubbleIcon className="h-5 w-5 transition-transform duration-200 group-hover:scale-105" />
        <span className="sr-only">{label}</span>
      </Link>
    </div>
  );
}
