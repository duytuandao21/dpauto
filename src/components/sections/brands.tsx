"use client";
import Image from "next/image";
import { HomeAppear } from "./home-motion";
import { brandLogos, homeDefaults } from "@/lib/home-defaults";
import { useImage, useSection } from "@/components/site/site-content";

export function BrandsSection() {
  const section = useSection("home.brands", homeDefaults["home.brands"]),
    resolve = useImage();
  if (!section) return null;
  // Built-in logos keep their tuned sizes/classes; logos added in the CMS use the asset's size.
  const brands = (
    section.images as { src: string; alt: string; assetId?: string }[]
  ).map((img) => {
    const known = brandLogos.find(
      (b) => `/images/brands/${b.file}.png` === img.src,
    );
    const media = resolve(img)?.media;
    return {
      name: img.alt || known?.name || "",
      file: known?.file || media?.id || img.src,
      // Logo tiles are ≤240px wide: the smallest variant that stays sharp on 2x screens is enough.
      src: media?.webp.find((v) => v.width >= 480)?.url || media?.src || img.src,
      width: known?.width || media?.width || 400,
      height: known?.height || media?.height || 200,
      known: !!known,
    };
  });
  return (
    <section
      className="section brands-section"
      id="brands"
      aria-labelledby="brands-heading"
    >
      <div className="container">
        <div className="section-heading">
          <h2 id="brands-heading">{section.title}</h2>
          <p>{section.description}</p>
        </div>
        <ul className="brands-grid" aria-label="Các thương hiệu được lựa chọn">
          {brands.map((brand, index) => (
            <li key={brand.file}>
              <HomeAppear className="brand-card" delay={(index % 4) * 0.08}>
                <div
                  className={`brand-logo ${brand.known ? `brand-logo--${brand.file}` : ""}`}
                >
                  <Image
                    src={brand.src}
                    alt={brand.name}
                    width={brand.width}
                    height={brand.height}
                    unoptimized={brand.file !== "wolver" || !brand.known}
                    sizes="(max-width: 809px) 160px, 240px"
                  />
                </div>
              </HomeAppear>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
