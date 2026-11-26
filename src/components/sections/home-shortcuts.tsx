"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { Icon, serviceIcons } from "@/components/ui/icon";
import type { SiteImage } from "@/lib/content";
import {
  bundledServiceIcon,
  defaultAccessoryIcon,
  defaultServiceIcon,
} from "@/lib/service-icons";
import { useSite } from "@/components/site/site-content";
import { homeServices } from "@/lib/home-vi";
import {
  accessories,
  accessoryPrice,
  filterAccessories,
  type CatalogItem,
} from "@/lib/accessories";

/** Under the hero: accessory search, one tile per service, accessory category links. */
export function HomeShortcuts() {
  const { services, accessories: list, catalog } = useSite();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const items: CatalogItem[] = list.length ? list : [...accessories];
  const shown = services.length ? services : homeServices;
  const hits =
    query.trim().length >= 2
      ? filterAccessories({ query, items }).slice(0, 5)
      : [];
  // Every category the admin added, in CMS order (an empty one opens /phu-kien's empty state).
  const categories = catalog.categories;
  // Both rows share one column count, so accessory tiles line up under the services.
  const columns = {
    "--shortcut-columns": Math.min(10, Math.max(shown.length, categories.length)),
  } as React.CSSProperties;
  const search = () =>
    router.push(
      "/phu-kien" + (query.trim() ? "?q=" + encodeURIComponent(query.trim()) : ""),
    );

  return (
    <section className="home-shortcuts" aria-label="Lối tắt">
      <div className="container">
        <div className="home-shortcuts-card">
          <form
            className="home-shortcuts-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
            }}
          >
            <label className="home-shortcuts-field">
              <span className="home-shortcuts-sr">Tìm phụ kiện</span>
              <Icon name="search" />
              <input
                type="search"
                value={query}
                placeholder="Tìm phụ kiện: camera hành trình, màn hình Android…"
                autoComplete="off"
                aria-controls={hits.length ? listId : undefined}
                aria-expanded={open && hits.length > 0}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              />
            </label>
            <Button type="submit" icon="search">
              Tìm
            </Button>
            {open && query.trim().length >= 2 && (
              <div
                className="home-shortcuts-results"
                id={listId}
                // Keeps focus in the input, so Safari (no focus on click) doesn't close it mid-click.
                onMouseDown={(e) => e.preventDefault()}
              >
                {hits.length ? (
                  <ul>
                    {hits.map((p) => (
                      <li key={p.id}>
                        <Link href={"/phu-kien/" + p.id}>
                          <span className="home-shortcuts-thumb">
                            <Photo src={p.image} media={p.media} alt="" sizes="48px" />
                          </span>
                          <span>
                            <strong>{p.name}</strong>
                            <small>{accessoryPrice(p)}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Chưa có phụ kiện phù hợp.</p>
                )}
                <button type="submit" className="home-shortcuts-all">
                  Xem tất cả kết quả cho “{query.trim()}”
                </button>
              </div>
            )}
          </form>

          <div className="home-shortcuts-group">
            <div className="home-shortcuts-head">
              <h2>Dịch vụ</h2>
              <Link href="/dich-vu">Xem tất cả</Link>
            </div>
            <ul className="home-shortcuts-tiles" style={columns}>
              {shown.map((s) => (
                <ShortcutTile
                  key={s.slug}
                  href={"/dich-vu/" + s.slug}
                  title={s.title}
                  image={"shortcutImage" in s ? s.shortcutImage : undefined}
                  icon={"icon" in s ? s.icon : undefined}
                  fallback={bundledServiceIcon(s.slug) || defaultServiceIcon}
                />
              ))}
            </ul>
          </div>

          {categories.length > 0 && (
            <div className="home-shortcuts-group home-shortcuts-group--line">
              <div className="home-shortcuts-head">
                <h2>Phụ kiện</h2>
                <Link href="/phu-kien">Xem tất cả</Link>
              </div>
              <ul className="home-shortcuts-tiles" style={columns}>
                {categories.map((c) => (
                  <ShortcutTile
                    key={c.id}
                    href={"/phu-kien?danh-muc=" + encodeURIComponent(c.name)}
                    title={c.name}
                    image={c.image}
                    fallback={defaultAccessoryIcon}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Tile with: uploaded image → line icon the admin picked → bundled/default image. */
function ShortcutTile({
  href,
  title,
  image,
  icon,
  fallback,
}: {
  href: string;
  title: string;
  image?: SiteImage;
  icon?: string;
  fallback: string;
}) {
  const picked = serviceIcons.find(([name]) => name === icon)?.[0];
  return (
    <li>
      <Link href={href}>
        {!image && picked ? (
          <span className="home-shortcuts-icon">
            <Icon name={picked} />
          </span>
        ) : (
          <span className="home-shortcuts-icon is-image">
            {image ? (
              <Photo {...image} alt="" sizes="64px" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- small static PNG, already sized
              <img src={fallback} alt="" width={160} height={160} />
            )}
          </span>
        )}
        <span>{title}</span>
      </Link>
    </li>
  );
}
