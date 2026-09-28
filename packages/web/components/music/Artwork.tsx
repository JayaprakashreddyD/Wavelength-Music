"use client";

import { useState } from "react";

interface ArtworkProps {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  "aria-hidden"?: boolean;
}

export function Artwork({ src, alt, className = "", loading = "lazy", "aria-hidden": ariaHidden }: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={!failed && src ? src : "/artwork-placeholder.svg"}
      alt={alt}
      aria-hidden={ariaHidden}
      loading={loading}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
