import Image, { ImageProps } from "next/image";
import React from "react";

export type ResponsiveImageProps = Omit<ImageProps, "src"> & {
  /** Image to use below the Tailwind `sm` breakpoint (< 640px) */
  mobileSrc: string;
  /** Image to use at and above the Tailwind `sm` breakpoint (>= 640px) */
  desktopSrc: string;
  /** Optional className applied on the wrapping <picture> element */
  pictureClassName?: string;
};

/**
 * Server-friendly responsive image that swaps source at Tailwind's `sm` breakpoint.
 *
 * - Uses a <picture> element with media queries so only the matching source loads.
 * - Falls back to Next.js <Image> for optimization and placeholders.
 * - Pass usual <Image> props (fill/width/height/priority/placeholder/sizes/...).
 */
export default function ResponsiveImage({
  mobileSrc,
  desktopSrc,
  alt,
  pictureClassName,
  className,
  ...imageProps
}: ResponsiveImageProps) {
  return (
    <picture className={pictureClassName}>
      {/* Mobile first: < 640px */}
      <source media="(max-width: 639px)" srcSet={mobileSrc} />
      {/* Desktop and up: >= 640px */}
      <source media="(min-width: 640px)" srcSet={desktopSrc} />
      {/* Fallback image (will be replaced by matching <source>) */}
      <Image alt={alt} src={desktopSrc} className={className} {...imageProps} />
    </picture>
  );
}

