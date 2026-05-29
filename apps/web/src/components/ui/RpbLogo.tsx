"use client";

import Image from "next/image";
import { useThemeMode } from "@/components/theme/ThemeRegistry";

interface RpbLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export function RpbLogo({ size = 40, className, animated = false }: RpbLogoProps) {
  const { mode } = useThemeMode();
  const isBlue = mode === "blue";
  const staticSrc = isBlue ? "/stardust-logo.webp" : "/logo.webp";

  if (animated && !isBlue) {
    return (
      <video
        src="/rpb.webm"
        width={size}
        height={size}
        className={className}
        autoPlay
        loop
        muted
        playsInline
        aria-label="RPB Logo"
      />
    );
  }
  return (
    <Image
      src={staticSrc}
      alt="RPB Logo"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
