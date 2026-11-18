"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import {
  accessories,
  accessoryBrands,
  accessoryPrice,
  accessorySorts,
  filterAccessories,
  type Accessory,
  type AccessorySort,
} from "@/lib/accessories";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { HomeScrollFrame, HomeSectionHeading } from "./home-motion";

/** Homepage product card; without `href` the card is display-only (detail pages come later). */
function AccessoryCard({
  product,
  href,
}: {
  product: Accessory;
  href?: string;
}) {
  const body: ReactNode = (
    <>
      <div className="service-card-top accessory-card-media">
        <Image
          src={product.image}
          alt={`${product.category} ${product.name}`}
          fill
          sizes="(max-width: 809px) 50vw, (max-width: 1199px) 50vw, 25vw"
        />
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
  return (
    <section className="section accessories-section" id="accessories">
      <div className="container">
        <HomeSectionHeading
          title="Phụ kiện ô tô"
          description="Thêm tiện nghi, nâng tầm trải nghiệm lái xe với những phụ kiện phù hợp cho chiếc xe của bạn."
        />
        <ul className="accessories-grid" aria-label="Phụ kiện ô tô tham khảo">
          {accessories.slice(0, 4).map((product) => (
            <li key={product.id}>
              <AccessoryCard product={product} href="/contact" />
            </li>
          ))}
        </ul>
        <div className="accessories-help">
          <p>Bạn cần chọn phụ kiện phù hợp với xe?</p>
          <Button href="/phu-kien">Xem thêm phụ kiện</Button>
        </div>
      </div>
    </section>
  );
}

const categories = [...new Set(accessories.map((p) => p.category))];

export function AccessoriesCatalog() {
  const [brand, setBrand] = useState(""),
    [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState<AccessorySort>("newest");
  const results = filterAccessories({ query, brand, category, sort });
  // Category counts follow the chosen brand so a tile never promises missing items.
  const inBrand = accessories.filter((p) => !brand || p.brand === brand);
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
          title="Phụ kiện ô tô"
          description="Thêm tiện nghi, nâng tầm trải nghiệm lái xe với những phụ kiện phù hợp cho chiếc xe của bạn."
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
              {[{ name: "", file: "" }, ...accessoryBrands].map((b) => (
                <button
                  key={b.name || "all"}
                  type="button"
                  className={`brand-card accessories-brand ${brand === b.name ? "is-selected" : ""}`}
                  aria-pressed={brand === b.name}
                  onClick={() => {
                    setBrand(b.name);
                    setCategory("");
                  }}
                >
                  {"width" in b ? (
                    <span className={`brand-logo brand-logo--${b.file}`}>
                      <Image
                        src={`/images/brands/${b.file}.png`}
                        alt={b.name}
                        width={b.width}
                        height={b.height}
                        unoptimized
                        sizes="160px"
                      />
                    </span>
                  ) : (
                    "Tất cả"
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
            {results.map((product) => (
              <li key={product.id}>
                <AccessoryCard product={product} />
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
        <div className="accessories-help">
          <p>Bạn cần chọn phụ kiện phù hợp với xe?</p>
          <Button href="/contact">Liên hệ tư vấn</Button>
        </div>
      </div>
    </section>
  );
}
