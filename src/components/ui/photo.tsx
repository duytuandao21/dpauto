import Image from "next/image";
import type { SiteImage } from "@/lib/content";
import type { CmsImageSource } from "@/lib/api/cms";

const srcSet = (list: CmsImageSource[]) =>
  list.map((v) => `${v.url} ${v.width}w`).join(", ");

export function Photo({
  src,
  alt,
  media,
  className = "",
  priority = false,
  sizes = "(max-width: 809px) 100vw, (max-width: 1199px) 50vw, 33vw",
}: SiteImage & {
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (media?.webp.length) {
    const { x, y } = media.focal;
    // Variants are already sized and encoded at upload; the browser picks one from srcset.
    return (
      <div className={`photo ${className}`}>
        <picture>
          {!!media.avif.length && (
            <source
              type="image/avif"
              srcSet={srcSet(media.avif)}
              sizes={sizes}
            />
          )}
          <img
            src={media.src}
            srcSet={srcSet(media.webp)}
            sizes={sizes}
            alt={alt}
            width={media.width || undefined}
            height={media.height || undefined}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              color: "transparent",
              ...(x !== 0.5 || y !== 0.5
                ? { objectPosition: `${x * 100}% ${y * 100}%` }
                : {}),
            }}
          />
        </picture>
      </div>
    );
  }
  return (
    <div className={`photo ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        // Static files in /public get resized by Next; API and remote URLs are served as-is.
        unoptimized={!src.startsWith("/") || src.startsWith("/api/")}
      />
    </div>
  );
}
