import content from "@/data/site-content.json";

export const { services, articles, projects, home, about, legal, banners } =
  content;
export type Service = (typeof services)[number];
export type Article = (typeof articles)[number];
export type SiteImage = { src: string; alt: string };
export type ContentBlock = { tag: string; text: string; html: string };
export const site = {
  name: "HyperAuto Care",
  phone: "0772 584 279",
  phoneHref: "tel:+84772584279",
  email: "contact@hyperautocare.com",
  address: "000 Harbor Avenue SW, Suite 120",
  city: "Seattle, WA 98126",
  logo: "/images/Aoa83BW1jq5HjPbFpH0LRrs0vA.svg",
  directions: "https://www.google.com/maps?cid=16780304667859729852&hl=en-US",
  mapEmbed:
    "https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s000+Harbor+Avenue+SW,+Suite+120!6i17",
};
export const navigation = [
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Our Work", href: "/our-work" },
  { label: "News & Offers", href: "/news" },
  { label: "About", href: "/about" },
  { label: "Brands", href: "/#brands" },
];
