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
    <Image
      {...(props as ImageProps)}
      src={src}
      alt={props.alt || ""}
      onError={() => setSrc(fallbackSrc)}
    />
  );
}
