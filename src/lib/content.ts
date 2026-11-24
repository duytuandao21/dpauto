import content from "@/data/site-content.json";
import type { CmsAsset } from "./api/cms";

export const { services, articles, projects, home, about, legal, banners } =
  content;
export type Service = (typeof services)[number];
export type Article = (typeof articles)[number];
/** media: CMS image with pre-sized AVIF/WebP variants; Photo then serves a responsive picture. */
export type SiteImage = { src: string; alt: string; media?: CmsAsset };
export type ContentBlock = { tag: string; text: string; html: string };
export const site = {
  name: "DPAuto",
  phone: "0772 584 279",
  phoneHref: "tel:+84772584279",
  email: "tramdichvutoantrung@gmail.com",
  address: "787–789 Quốc lộ 13",
  city: "Hiệp Bình, TP. Hồ Chí Minh",
  logo: "/images/Aoa83BW1jq5HjPbFpH0LRrs0vA.svg",
  directions: "https://www.google.com/maps/search/?api=1&query=787-789+Qu%E1%BB%91c+l%E1%BB%99+13+Hi%E1%BB%87p+B%C3%ACnh+TP.+H%E1%BB%93+Ch%C3%AD+Minh",
  mapEmbed:
    "https://www.google.com/maps?q=787-789+Qu%E1%BB%91c+l%E1%BB%99+13+Hi%E1%BB%87p+B%C3%ACnh+TP.+H%E1%BB%93+Ch%C3%AD+Minh&output=embed",
};
export const navigation = [
  { label: "Services", href: "/dich-vu" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Our Work", href: "/thanh-qua" },
  { label: "News & Offers", href: "/tin-tuc" },
  { label: "About", href: "/gioi-thieu" },
  { label: "Brands", href: "/#brands" },
];
