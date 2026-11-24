"use client";
import Image from "next/image";
import { useSite } from "@/components/site/site-content";

/** Logo from "Cài đặt website", falling back to the built-in file until one is uploaded. */
export function SiteLogo({
  sizes,
  priority,
}: {
  sizes: string;
  priority?: boolean;
}) {
  const { settings } = useSite(),
    media = settings.logoImage?.media;
  if (!media)
    return (
      <Image
        src="/images/logo-dpauto.png"
        alt="DPAuto Logo"
        width={1448}
        height={1086}
        sizes={sizes}
        priority={priority}
      />
    );
  return (
    <Image
      // Logos render ≤180px wide: the smallest variant that stays sharp on 2x screens.
      src={media.webp.find((v) => v.width >= 480)?.url || media.src}
      alt={`${settings.name} Logo`}
      width={media.width || 400}
      height={media.height || 200}
      priority={priority}
      unoptimized
      data-uploaded=""
    />
  );
}

