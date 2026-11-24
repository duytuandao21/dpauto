"use client";

import { Photo } from "@/components/ui/photo";
import Link from "next/link";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import {
  accessories,
  accessoryPrice,
  accessorySorts,
  filterAccessories,
  type AccessorySort,
  type CatalogItem,
} from "@/lib/accessories";
import { homeDefaults } from "@/lib/home-defaults";
import { pageDefaults } from "@/lib/page-defaults";
import { useSection, useSite } from "@/components/site/site-content";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { HomeScrollFrame, HomeSectionHeading } from "./home-motion";

/** Product card linking to its detail page (/phu-kien/[slug]). */
export function AccessoryCard({
  product,
  href,
}: {
  product: CatalogItem;
  href?: string;
}) {
  const alt = `${product.category} ${product.name}`,
    back = product.images?.[1];
  const body: ReactNode = (
    <>
      <div
        className={`service-card-top accessory-card-media${back ? " has-flip" : ""}`}
      >
        {back ? (
          // Hover flips to the second photo and back (CSS, hover devices only).
          <div className="accessory-flip">
            <Photo
              className="accessory-flip-front"
              src={product.image}
              media={product.media}
              alt={alt}
              sizes="(max-width: 1199px) 50vw, 25vw"
            />
            <Photo
              className="accessory-flip-back"
              src={back.src}
              media={back.media}
              alt=""
              sizes="(max-width: 1199px) 50vw, 25vw"
            />
          </div>
        ) : (
          <Photo
            src={product.image}
            media={product.media}
            alt={alt}
            sizes="(max-width: 1199px) 50vw, 25vw"
          />
        )}
      </div>
      <motion.div
        className="service-card-bottom accessory-card-copy"
        variants={{
          rest: {
            backgroundColor: "var(--service-bottom-rest)",
          },
          hover: {
            backgroundColor: "var(--service-bottom-hover)",
          },
        }}
      >
        <p className="accessory-card-category">{product.category}</p>
        <h3>{product.name}</h3>
        <div className="accessory-card-foot">
          <p className="accessory-card-price">
            <strong>{accessoryPrice(product)}</strong>
          </p>
          <motion.span
            className="service-card-cta accessory-card-cta"
            variants={{
              rest: {
                backgroundColor: "var(--service-button-bg)",
              },
              hover: {
                backgroundColor: "var(--service-button-bg)",
              },
            }}
          >
            <Icon name="arrow" />
          </motion.span>
        </div>
      </motion.div>
    </>
  );
  return (
    <HomeScrollFrame
      className="accessory-reveal"
      from={{ x: 24, y: 48, rotateX: 6, rotateY: 20 }}
    >
      <motion.article
        className="service-card accessory-card"
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileFocus="hover"
        variants={{
          rest: { background: "var(--service-frame-rest)" },
          hover: { background: "var(--service-frame-hover)" },
        }}
        transition={{
          type: "spring",
          stiffness: 254,
          damping: 24,
          mass: 1,
        }}
      >
        {href ? (
          <Link
            href={href}
            className="accessory-card-link"
            aria-label={`Xem chi tiết ${product.category}: ${product.name}`}
          >
            {body}
          </Link>
        ) : (
          <div className="accessory-card-link">{body}</div>
        )}
      </motion.article>
    </HomeScrollFrame>
  );
}

export function AccessoriesSection() {
  const section = useSection(
    "home.accessories",
    homeDefaults["home.accessories"],
  );
  const { accessories: list } = useSite();
  if (!section) return null;
  const items = list.length ? list : accessories;
  const featured = list.length ? list.filter((p) => p.featured) : [];
  return (
    <section className="section accessories-section" id="accessories">
      <div className="container">
        <HomeSectionHeading
          title={section.title}
          description={section.description}
        />
        <ul className="accessories-grid" aria-label="Phụ kiện ô tô tham khảo">
          {(featured.length ? featured : items).slice(0, 4).map((product) => (
            <li key={product.id}>
              <AccessoryCard product={product} href={"/phu-kien/" + product.id} />
            </li>
          ))}
        </ul>
        <div className="accessories-help">
          <p>{section.note}</p>
          <Button href={section.cta?.href || "/phu-kien"}>
            {section.cta?.label || "Xem thêm phụ kiện"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function AccessoriesCatalog() {
  const { accessories: list, catalog } = useSite();
  const page =
    useSection("phu-kien", pageDefaults["phu-kien"]) ||
    pageDefaults["phu-kien"];
  const items: CatalogItem[] = list.length ? list : [...accessories];
  // Brands and categories come from the admin catalogue (built-in list until it is saved).
  const categories = catalog.categories.map((c) => c.name);
  const [brand, setBrand] = useState(""),
    [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState<AccessorySort>("newest");
  const results = filterAccessories({ query, brand, category, sort, items });
  // 8 products at a time; a new filter or sort starts again from the first 8.
  const PAGE = 8;
  const filterKey = [query, brand, category, sort].join("|");
  const [more, setMore] = useState({ key: filterKey, count: PAGE });
  const count = more.key === filterKey ? more.count : PAGE;
  // Category counts follow the chosen brand so a tile never promises missing items.
  const inBrand = items.filter((p) => !brand || p.brand === brand);
  const filters = [
    { value: "", label: "Tất cả", count: inBrand.length },
    ...categories.map((c) => ({
      value: c,
      label: c,
      count: inBrand.filter((p) => p.category === c).length,
    })),
  ];
  const reset = () => {
    setQuery("");
    setBrand("");
    setCategory("");
  };
  return (
    <section className="section accessories-section accessories-catalog">
      <div className="container">
        <HomeSectionHeading
          pageTitle
          title={page.title}
          description={page.description}
        />
        <div className="accessories-panel">
          <form
            className="accessories-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              // Results update while typing; submitting just closes the phone keyboard.
              (document.activeElement as HTMLElement | null)?.blur();
            }}
          >
            <label className="accessories-search-field">
              <span className="accessories-sr">Tìm phụ kiện</span>
              <Icon name="search" />
              <input
                type="search"
                value={query}
                placeholder="Tìm camera, màn hình, Android Box…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <Button
              type="submit"
              icon="search"
              className="accessories-search-submit"
            >
              <span className="accessories-sr">Tìm kiếm</span>
            </Button>
          </form>
          <div className="accessories-group">
            <div className="accessories-group-head">
              <h2 id="accessories-brands">Thương hiệu</h2>
              <span>Chọn thương hiệu</span>
            </div>
            <div
              className="accessories-brands"
              role="group"
              aria-labelledby="accessories-brands"
            >
              {[{ id: "", name: "", logo: undefined }, ...catalog.brands].map((b) => (
                <button
                  key={b.id || "all"}
                  type="button"
                  className={`brand-card accessories-brand ${brand === b.name ? "is-selected" : ""}`}
                  aria-pressed={brand === b.name}
                  onClick={() => {
                    setBrand(b.name);
                    setCategory("");
                  }}
                >
                  {b.logo ? (
                    <span className={`brand-logo brand-logo--${b.id}`}>
                      {/* Logos have any aspect ratio; CSS contains them in the tile. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          b.logo.media?.webp.find((v) => v.width >= 240)?.url ||
                          b.logo.src
                        }
                        alt={b.name}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  ) : (
                    b.name || "Tất cả"
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="accessories-group">
            <div className="accessories-group-head">
              <h2 id="accessories-categories">Danh mục phụ kiện</h2>
              <span>Lọc theo loại sản phẩm</span>
            </div>
            <div
              className="accessories-filters"
              role="group"
              aria-labelledby="accessories-categories"
            >
              {filters.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  className={`accessories-filter ${category === f.value ? "is-selected" : ""}`}
                  aria-pressed={category === f.value}
                  disabled={!f.count}
                  onClick={() => setCategory(f.value)}
                >
                  {f.label}
                  <span>{f.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="accessories-panel-foot">
            <p aria-live="polite">
              Hiển thị <strong>{results.length}</strong> phụ kiện
            </p>
            <label className="accessories-sort">
              <span className="accessories-sr">Sắp xếp</span>
              <Icon name="sort" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as AccessorySort)}
              >
                {accessorySorts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron" />
            </label>
          </div>
        </div>
        {results.length ? (
          <ul className="accessories-grid" aria-label="Danh sách phụ kiện">
            {results.slice(0, count).map((product) => (
              <li key={product.id}>
                <AccessoryCard product={product} href={"/phu-kien/" + product.id} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="accessories-empty">
            <p>Chưa tìm thấy phụ kiện phù hợp.</p>
            <Button variant="secondary" onClick={reset}>
              Xem tất cả phụ kiện
            </Button>
          </div>
        )}
        {results.length > count && (
          <div className="accessories-more">
            <Button
              onClick={() => setMore({ key: filterKey, count: count + PAGE })}
            >
              Xem thêm {results.length - count} sản phẩm
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
