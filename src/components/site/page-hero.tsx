import * as React from "react";

import SectionHeading from "@/src/components/site/section-heading";
import { cn } from "@/src/lib/utils";

type PageHeroProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

export default function PageHero({
  eyebrow,
  title,
  description,
  className,
  children,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-border/70 bg-gradient-to-br from-muted/70 via-background to-muted/30 px-6 py-10 shadow-sm sm:px-8 sm:py-12 lg:px-12 lg:py-14",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(209,122,79,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(209,122,79,0.08),transparent_28%)]"
      />
      <div className="relative">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          titleAs="h1"
          align="left"
          className="max-w-4xl"
          titleClassName="text-4xl sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02]"
          descriptionClassName="max-w-2xl text-base sm:text-lg"
        />
        {children ? <div className="relative mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
