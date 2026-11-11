"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { accessories } from "@/lib/accessories";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { HomeScrollFrame, HomeSectionHeading } from "./home-motion";

export function AccessoriesSection() {
  return (
    <section className="section accessories-section" id="accessories">
      <div className="container">
        <HomeSectionHeading
          title="Phụ kiện ô tô"
          description="Thêm tiện nghi, nâng tầm trải nghiệm lái xe với những phụ kiện phù hợp cho chiếc xe của bạn."
        />
        <ul className="accessories-grid" aria-label="Phụ kiện ô tô tham khảo">
          {accessories.map((product) => (
            <li key={product.id}>
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
                  <Link
                    href="/contact"
                    className="accessory-card-link"
                    aria-label={`Xem chi tiết ${product.category}: ${product.name}`}
                  >
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
                      <p className="accessory-card-category">
                        {product.category}
                      </p>
                      <h3>{product.name}</h3>
                      <p className="accessory-card-description">
                        {product.description}
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
                    </motion.div>
                  </Link>
                </motion.article>
              </HomeScrollFrame>
            </li>
          ))}
        </ul>
        <div className="accessories-help">
          <p>Bạn cần chọn phụ kiện phù hợp với xe?</p>
          <Button href="/contact">Xem thêm phụ kiện</Button>
        </div>
      </div>
    </section>
  );
}
