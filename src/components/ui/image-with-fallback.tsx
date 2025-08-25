"use client";

import Image, { ImageProps } from "next/image";
import React from "react";

type Props = Omit<ImageProps, "onError"> & { fallbackSrc?: string };

export default function ImageWithFallback({
  fallbackSrc = "/assets/missing-profile.svg",
  ...props
}: Props) {
  const [src, setSrc] = React.useState(props.src as string);

  React.useEffect(() => {
    setSrc(props.src as string);
  }, [props.src]);

  return (
    // `key` forces next/image to remount when src changes which helps error handling
    <Image
      key={src}
      {...(props as any)}
      src={src}
      onError={() => setSrc(fallbackSrc)}
    />
  );
}
