import Image from "next/image";
import type { SiteImage } from "@/lib/content";

export function Photo({
  src,
  alt,
  className = "",
  priority = false,
  unoptimized = false,
  sizes = "(max-width: 809px) 100vw, (max-width: 1199px) 50vw, 33vw",
}: SiteImage & {
  className?: string;
  priority?: boolean;
  sizes?: string;
  unoptimized?: boolean;
}) {
  return (
    <div className={`photo ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        unoptimized={unoptimized}
      />
    </div>
  );
}
