"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FAQ } from "@/components/sections/faq";
import { AccessoryCard } from "@/components/sections/accessories";
import { BookingLauncher } from "@/components/public-booking/booking-dialog";
import { BookingPreset } from "@/components/public-booking/booking-preset";
import { accessoryPrice } from "@/lib/accessories";
import type { SiteAccessory } from "@/lib/site-content";

const BODY_LIMIT = 520;
const money = (v: number) => `${v.toLocaleString("vi-VN")}đ`;

export function AccessoryDetail({
  product,
  related,
  phone,
}: {
  product: SiteAccessory;
  related: SiteAccessory[];
  phone: { text: string; href: string };
}) {
  const pics = product.images.length
    ? product.images
    : [{ src: product.image, alt: product.name }];
  const [active, setActive] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  // The main photo is a scroll-snap strip: swipe on touch screens, thumbnails jump on desktop.
  // While a click scrolls the strip, the photos it passes must not become active one by one.
  const target = useRef<number | null>(null);
  const smooth = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const show = (i: number) => {
    const el = strip.current;
    setActive(i);
    target.current = i;
    el?.scrollTo({ left: i * el.clientWidth, behavior: smooth() });
  };
  const onScroll = () => {
    const el = strip.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (target.current !== null) {
      if (i !== target.current) return;
      target.current = null;
    }
    setActive(i);
  };
  // A swipe or wheel on the photo hands control back to the user.
  const release = () => {
    target.current = null;
  };
  // Keep the current thumbnail centred in its own scrolling column (never scrolls the page).
  const thumbs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = thumbs.current,
      thumb = box?.children[active] as HTMLElement | undefined;
    if (!box || !thumb) return;
    const b = box.getBoundingClientRect(),
      t = thumb.getBoundingClientRect();
    // Absolute target, so a new image mid-animation retargets smoothly instead of stacking scrolls.
    box.scrollTo({
      top: box.scrollTop + t.top - b.top - (b.height - t.height) / 2,
      left: box.scrollLeft + t.left - b.left - (b.width - t.width) / 2,
      behavior: smooth(),
    });
  }, [active]);
  // Long introductions start collapsed; the toggle only appears when the text overflows.
  const body = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const check = () => setLong(el.scrollHeight > BODY_LIMIT + 80);
    const ro = new ResizeObserver(check);
    ro.observe(el.firstElementChild || el);
    check();
    return () => ro.disconnect();
  }, [product.bodyHtml]);
  const toggleBody = () => {
    if (expanded)
      document.getElementById("gioi-thieu")?.scrollIntoView({ block: "start" });
    setExpanded(!expanded);
  };
  const onSale =
    product.salePrice != null &&
    product.price != null &&
    product.salePrice < product.price;
  const sections = [
    product.bodyHtml && { id: "gioi-thieu", label: "Giới thiệu" },
    product.specs.length > 0 && { id: "thong-so", label: "Thông số" },
    product.inBox.length > 0 && { id: "trong-hop", label: "Trong hộp" },
    product.faq.length > 0 && { id: "cau-hoi", label: "Câu hỏi" },
  ].filter((s): s is { id: string; label: string } => !!s);
  const keySpecs = product.specs.filter((s) => s.key).slice(0, 4);
  return (
    <>
      {/* Booking from here pre-ticks accessory installation and names the product. */}
      <BookingPreset
        serviceKeys={["nang-cap-lap-dat-phu-kien-o-to"]}
        note={`Lắp đặt: ${product.name}`}
      />
      <section className="section accessory-detail">
        <div className="container">
          <nav className="accessory-breadcrumb" aria-label="Đường dẫn">
            <Link href="/">Trang chủ</Link>
            <Icon name="chevron" />
            <Link href="/phu-kien">Phụ kiện</Link>
            <Icon name="chevron" />
            <span aria-current="page">{product.name}</span>
          </nav>
          <div className="accessory-top">
            <div className="accessory-gallery">
              {pics.length > 1 && (
                <div
                  className="accessory-thumbs"
                  aria-label="Ảnh sản phẩm"
                  ref={thumbs}
                >
                  {pics.map((p, i) => (
                    <button
                      key={p.src + i}
                      type="button"
                      aria-label={`Xem ảnh ${i + 1}`}
                      aria-current={i === active}
                      onClick={() => show(i)}
                    >
                      <Photo {...p} sizes="96px" />
                    </button>
                  ))}
                </div>
              )}
              <div className="accessory-main">
                <div
                  className="accessory-strip"
                  ref={strip}
                  onScroll={onScroll}
                  onPointerDown={release}
                  onWheel={release}
                >
                  {pics.map((p, i) => (
                    <div className="accessory-slide" key={p.src + i}>
                      <Photo
                        {...p}
                        priority={i === 0}
                        sizes="(max-width: 1199px) 100vw, 50vw"
                      />
                    </div>
                  ))}
                </div>
                {pics.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="accessory-nav"
                      data-dir="prev"
                      aria-label="Ảnh trước"
                      onClick={() => show((active - 1 + pics.length) % pics.length)}
                    >
                      <Icon name="chevron" />
                    </button>
                    <button
                      type="button"
                      className="accessory-nav"
                      data-dir="next"
                      aria-label="Ảnh sau"
                      onClick={() => show((active + 1) % pics.length)}
                    >
                      <Icon name="chevron" />
                    </button>
                  </>
                )}
                {pics.length > 1 && (
                  <span className="accessory-counter" aria-hidden="true">
                    {active + 1}/{pics.length}
                  </span>
                )}
              </div>
              {keySpecs.length > 0 && (
                <dl className="accessory-keyspecs">
                  {keySpecs.map((s, i) => (
                    <div key={s.label + i}>
                      {s.icon && <Icon name={s.icon} />}
                      <dd>{s.value}</dd>
                      <dt>{s.label}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <div className="accessory-info">
              <h1>{product.name}</h1>
              <div className="accessory-price">
                <strong>{accessoryPrice(product)}</strong>
                {onSale && (
                  <>
                    <s>{money(product.price!)}</s>
                    <span className="accessory-badge">
                      -
                      {Math.round(
                        (1 - product.salePrice! / product.price!) * 100,
                      )}
                      %
                    </span>
                  </>
                )}
              </div>
              {product.description && (
                <p className="accessory-description">{product.description}</p>
              )}
              {product.highlights.length > 0 && (
                <ul className="accessory-highlights">
                  {product.highlights.map((h) => (
                    <li key={h}>
                      <Icon name="check" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="accessory-actions">
                <BookingLauncher label="Đặt lịch lắp đặt" />
                <Button href={phone.href} variant="secondary" icon="phone">
                  Gọi
                </Button>
                {/* Zalo chat on the shop's phone number. */}
                <Button
                  href={`https://zalo.me/${phone.text.replace(/\D/g, "")}`}
                  variant="secondary"
                  icon="zalo"
                >
                  Zalo
                </Button>
              </div>
              <p className="accessory-note">
                <Icon name="shield" />
                Hàng chính hãng, lắp đặt và bảo hành tại xưởng.
              </p>
            </div>
          </div>
        </div>
      </section>
      {sections.length > 1 && (
        <nav className="accessory-tabs" aria-label="Mục trong trang">
          <div className="container">
            {sections.map((s) => (
              <a key={s.id} href={"#" + s.id}>
                {s.label}
              </a>
            ))}
          </div>
        </nav>
      )}
      {product.bodyHtml && (
        <section className="section accessory-block" id="gioi-thieu">
          <div className="container">
            <h2>Giới thiệu</h2>
            {/* HTML is generated from validated rich text with every value escaped. */}
            <div
              ref={body}
              className="accessory-body-wrap"
              data-collapsed={long && !expanded}
            >
              <div
                className="rich-content accessory-body"
                dangerouslySetInnerHTML={{ __html: product.bodyHtml }}
              />
            </div>
            {long && (
              <div
                className="accessory-body-toggle"
                data-collapsed={!expanded}
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={toggleBody}
                >
                  {expanded ? "Thu gọn" : "Xem thêm"}
                  <Icon name="chevron" />
                </button>
              </div>
            )}
          </div>
        </section>
      )}
      {product.specs.length > 0 && (
        <section className="section accessory-block" id="thong-so">
          <div className="container">
            <h2>Thông số kỹ thuật</h2>
            <dl className="accessory-specs">
              {product.specs.map((s, i) => (
                <div key={s.label + i}>
                  <dd>{s.value}</dd>
                  <dt>{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}
      {product.inBox.length > 0 && (
        <section className="section accessory-block" id="trong-hop">
          <div className="container">
            <h2>Trong hộp có gì</h2>
            <ul className="accessory-inbox">
              {product.inBox.map((x, i) => (
                <li key={x.title + i}>
                  {x.image && (
                    <div className="accessory-inbox-photo">
                      <Photo {...x.image} sizes="240px" />
                    </div>
                  )}
                  <span>{x.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {product.faq.length > 0 && (
        <section className="section accessory-block" id="cau-hoi">
          <div className="container">
            <FAQ items={product.faq} compact />
          </div>
        </section>
      )}
      {related.length > 0 && (
        <section className="section accessory-block accessory-related">
          <div className="container">
            <h2>Phụ kiện liên quan</h2>
            <ul className="accessories-grid">
              {related.map((p) => (
                <li key={p.id}>
                  <AccessoryCard product={p} href={"/phu-kien/" + p.id} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
