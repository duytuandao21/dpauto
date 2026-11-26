"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import Link from "next/link";
import { banners, services, type Service } from "@/lib/content";
import { homeServices } from "@/lib/home-vi";
import { homeDefaults } from "@/lib/home-defaults";
import { pageDefaults } from "@/lib/page-defaults";
import { useImage, useSection, useSite } from "@/components/site/site-content";
import { Photo } from "@/components/ui/photo";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { HomeScrollFrame } from "./home-motion";
import { priceText, type ServicePrice } from "@/lib/service-price";
import { HomeSectionHeading as SectionHeading } from "./home-motion";

export function ServicesSection({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const section = useSection("home.services", homeDefaults["home.services"]);
  const { services: list } = useSite();
  if (!section) return null;
  title = section.title || title || homeDefaults["home.services"].title;
  description =
    section.description ??
    description ??
    homeDefaults["home.services"].description;
  const shown = list.length ? list : homeServices;
  return (
    <section className="section services-section" id="services">
      <div className="container">
        <SectionHeading title={title} description={description} />
        <div className="services-grid">
          {shown.map((service) => (
            <HomeScrollFrame
              from={{ x: 24, y: 48, rotateX: 6, rotateY: 20 }}
              key={service.slug}
            >
              <motion.div
                initial="rest"
                whileHover="hover"
                whileFocus="hover"
                animate="rest"
                className="service-card"
                variants={{
                  rest: {
                    background: "var(--service-frame-rest)",
                  },
                  hover: {
                    background: "var(--service-frame-hover)",
                  },
                }}
                transition={{
                  type: "spring",
                  stiffness: 254,
                  damping: 24,
                  mass: 1,
                }}
              >
                <Link
                  href={`/dich-vu/${service.slug}`}
                  className="service-card-link"
                >
                  <div className="service-card-top">
                    <Photo {...service.image} />
                    <h3>{service.title}</h3>
                  </div>
                  <motion.div
                    className="service-card-bottom"
                    variants={{
                      rest: {
                        backgroundColor: "var(--service-bottom-rest, #15181b)",
                      },
                      hover: {
                        backgroundColor: "var(--service-bottom-hover, #0b0d0f)",
                      },
                    }}
                  >
                    <p>{service.description}</p>
                    <div className="service-card-foot">
                      <ServicePriceTag
                        price={("price" in service && service.price) || null}
                      />
                      <motion.span
                        className="service-card-cta"
                        variants={{
                          rest: {
                            backgroundColor:
                              "var(--service-button-bg, #202428)",
                          },
                          hover: {
                            backgroundColor:
                              "var(--service-button-bg, #202428)",
                          },
                        }}
                      >
                        <motion.span
                          className="service-card-cta-text"
                          variants={{
                            rest: { width: 0, opacity: 0 },
                            hover: { width: "auto", opacity: 1 },
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 254,
                            damping: 24,
                          }}
                        >
                          Xem chi tiết
                        </motion.span>
                        <Icon name="arrow" />
                      </motion.span>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            </HomeScrollFrame>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServicesBanner() {
  const banner =
      useSection("services", pageDefaults.services) || pageDefaults.services,
    resolve = useImage(),
    image = resolve(banner.image, banners.services)!;
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const scale = useTransform(progress, [0, 1], [1, 1.4]);
  return (
    <section className="work-banner services-banner">
      <motion.div
        className="work-banner-image"
        style={reduced ? undefined : { scale }}
      >
        <Photo {...image} priority sizes="100vw" />
      </motion.div>
      <div className="work-banner-overlay" />
      <div className="container work-banner-heading">
        <h1>{banner.title}</h1>
      </div>
    </section>
  );
}

export function ServicesList() {
  const { services: list } = useSite();
  return (
    <section className="services-index">
      <div className="container">
        <div className="services-list">
          {(list.length ? list : services).map((service) => (
            <ServiceStackCard key={service.slug} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceStackCard({
  service,
}: {
  service: Pick<Service, "slug" | "title" | "description" | "image"> & {
    price?: ServicePrice;
  };
}) {
  const reduced = useReducedMotion();
  const enter = reduced ? { scale: 1, y: 0 } : { scale: 1.06, y: 40 };
  return (
    <motion.div
      className="service-stack-card"
      initial={reduced ? false : enter}
      animate={enter}
      whileInView={{ scale: 1, y: 0 }}
      viewport={{ amount: 0.5, once: false }}
      transition={{
        type: "tween",
        duration: reduced ? 0 : 0.6,
        ease: [0.44, 0, 0.56, 1],
      }}
    >
      <article className="service-list-item">
        <div className="service-list-image">
          <Photo {...service.image} sizes="100vw" />
        </div>
        <div className="service-list-copy">
          <Link href={`/dich-vu/${service.slug}`}>
            <h2>{service.title}</h2>
          </Link>
          <p>{service.description}</p>
          <div className="service-list-foot">
            <ServicePriceTag price={service.price ?? null} />
            <Button href={`/dich-vu/${service.slug}`}>Xem chi tiết</Button>
          </div>
        </div>
      </article>
    </motion.div>
  );
}

/** "Giá từ 239.000đ" / "Giá chỉ …" / "Liên hệ báo giá" on a service card. */
function ServicePriceTag({ price }: { price: ServicePrice }) {
  const { label, value } = priceText(price);
  return (
    <p className={`service-card-price${price ? "" : " is-contact"}`}>
      {label && <span>{label}</span>}
      <strong>{value}</strong>
    </p>
  );
}
