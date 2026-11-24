// Built-in website content expressed in the CMS payload shapes. The website shows these
// until a published CMS document overrides the same key; the admin prefills its forms from them.
import { articles, projects, services, site } from "./content";
import { homeNavigation } from "./home-vi";

/** Header after "Phụ kiện": the home menu, with "Tra cứu" (vehicle status lookup) in place of "Thành quả". */
export const headerDefaults = () =>
  homeNavigation.slice(1, 5).map(({ label, href }) =>
    href === "/thanh-qua"
      ? { label: "Tra cứu", href: "/tra-cuu" }
      : { label, href },
  );
import { accessories, accessoryBrands, catalogId } from "./accessories";

type Img = { src: string; alt: string; assetId?: string };
const blocksHtml = (blocks: { tag: string; html: string }[]) =>
  blocks
    .map((b) =>
      b.tag === "li"
        ? `<ul><li>${b.html}</li></ul>`
        : `<${b.tag}>${b.html}</${b.tag}>`,
    )
    .join("")
    .replace(/<\/ul><ul>/g, "");
/** Seed dates are written DD/MM/YYYY; payloads use YYYY-MM-DD. */
export const isoDate = (d: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
};

export const defaultServices = services.map((s, order) => ({
  key: s.slug,
  html: s.overviewHtml,
  payload: {
    order,
    title: s.title,
    description: s.description,
    image: s.image as Img,
    overviewImages: s.overviewImages as Img[],
    processIntroduction: s.processIntroduction,
    process: s.process.map((p) => ({ title: p.title, text: p.description })),
    benefitsTitle: s.benefitsTitle,
    benefitsIntroduction: s.benefitsIntroduction,
    benefits: s.benefits.map((b) => ({ title: b.title, text: b.description })),
    faqIntroduction: s.faqIntroduction,
    faq: s.faq.map((f) => ({ question: f.question, answer: f.answer })),
    gallery: s.gallery as Img[],
  },
}));
export const defaultArticles = articles.map((a) => ({
  key: a.slug,
  html: blocksHtml(a.content),
  payload: {
    title: a.title,
    description: a.description,
    category: a.category,
    date: isoDate(a.date),
    image: a.image as Img,
  },
}));
export const defaultProjects = projects.map((p, order) => ({
  key: `du-an-${order + 1}`,
  html: "",
  payload: {
    order,
    title: p.title,
    vehicle: p.vehicle,
    duration: p.duration,
    services: p.services,
    description: p.description,
    before: p.before as Img,
    after: p.after as Img,
  },
}));
export const defaultAccessories = accessories.map((a, order) => ({
  key: a.id,
  html: "",
  payload: {
    order,
    featured: order < 4,
    name: a.name,
    brand: a.brand,
    category: a.category,
    price: "price" in a ? (a.price as number) : null,
    salePrice: null,
    description: a.description,
    images: [{ src: a.image, alt: a.name }],
    source: a.source,
  },
}));
/** Built-in brands (logo files in /images/brands) and the categories the sample products use. */
/** Starter car makes and models for the booking form, until the admin saves a list. */
export const defaultVehicles = {
  brands: [
    {
      name: "Toyota",
      models: [
        "Vios",
        "Yaris",
        "Yaris Cross",
        "Corolla Altis",
        "Corolla Cross",
        "Camry",
        "Raize",
        "Veloz Cross",
        "Avanza Premio",
        "Innova",
        "Innova Cross",
        "Fortuner",
        "Hilux",
        "Land Cruiser Prado",
        "Land Cruiser",
      ],
    },
    {
      name: "Hyundai",
      models: [
        "Grand i10",
        "Accent",
        "Elantra",
        "Creta",
        "Venue",
        "Stargazer",
        "Custin",
        "Tucson",
        "Santa Fe",
        "Palisade",
      ],
    },
    {
      name: "Kia",
      models: [
        "Morning",
        "Soluto",
        "K3",
        "K5",
        "Sonet",
        "Seltos",
        "Carens",
        "Sportage",
        "Sorento",
        "Carnival",
      ],
    },
    {
      name: "Mazda",
      models: [
        "Mazda2",
        "Mazda3",
        "Mazda6",
        "CX-3",
        "CX-30",
        "CX-5",
        "CX-8",
        "BT-50",
      ],
    },
    {
      name: "Honda",
      models: ["Brio", "City", "Civic", "Accord", "HR-V", "BR-V", "CR-V"],
    },
    {
      name: "Mitsubishi",
      models: [
        "Attrage",
        "Xpander",
        "Xpander Cross",
        "Xforce",
        "Outlander",
        "Pajero Sport",
        "Triton",
      ],
    },
    {
      name: "Ford",
      models: [
        "Territory",
        "Ranger",
        "Ranger Raptor",
        "Everest",
        "Explorer",
        "Transit",
      ],
    },
    {
      name: "VinFast",
      models: [
        "VF 3",
        "VF 5",
        "VF 6",
        "VF 7",
        "VF 8",
        "VF 9",
        "Fadil",
        "Lux A2.0",
        "Lux SA2.0",
      ],
    },
    { name: "Suzuki", models: ["Swift", "Ciaz", "Ertiga", "XL7", "Jimny"] },
    { name: "Nissan", models: ["Almera", "Kicks", "Navara", "Terra"] },
    { name: "Isuzu", models: ["D-Max", "mu-X"] },
    { name: "Peugeot", models: ["2008", "3008", "408", "5008"] },
    { name: "MG", models: ["MG5", "ZS", "HS", "MG4"] },
    {
      name: "Mercedes-Benz",
      models: [
        "A-Class",
        "C-Class",
        "E-Class",
        "S-Class",
        "GLA",
        "GLB",
        "GLC",
        "GLE",
        "GLS",
        "Maybach",
      ],
    },
    {
      name: "BMW",
      models: [
        "3 Series",
        "5 Series",
        "7 Series",
        "X3",
        "X4",
        "X5",
        "X6",
        "X7",
      ],
    },
    { name: "Audi", models: ["A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8"] },
    { name: "Lexus", models: ["ES", "IS", "LS", "NX", "RX", "GX", "LX"] },
    {
      name: "Volkswagen",
      models: ["Polo", "Virtus", "T-Cross", "Tiguan", "Teramont"],
    },
    { name: "Subaru", models: ["Forester", "Outback", "BRZ"] },
    {
      name: "Porsche",
      models: ["Macan", "Cayenne", "Panamera", "911", "Taycan"],
    },
  ] as { name: string; models: string[] }[],
};
export const defaultCatalog = {
  brands: accessoryBrands.map((b) => ({
    id: b.file,
    name: b.name,
    logo: { src: `/images/brands/${b.file}.png`, alt: b.name },
  })),
  categories: [...new Set(accessories.map((a) => a.category))].map((name) => ({
    id: catalogId(name),
    name,
  })),
};
export const defaultLists = {
  SERVICE: defaultServices,
  NEWS: defaultArticles,
  PROJECT: defaultProjects,
  ACCESSORY: defaultAccessories,
} as const;

/** Store information. Address and map come from the homepage hero (the real garage);
 *  email and social links are still sample values to be replaced in the admin. */
export const defaultSettings = {
  name: "DPAuto - Trạm dịch vụ Toàn Trung",
  tagline: "Chăm sóc ô tô chuyên nghiệp",
  phone: site.phone,
  email: site.email,
  address: "787–789 Quốc lộ 13",
  city: "Hiệp Bình, TP. Hồ Chí Minh",
  directions: "https://maps.app.goo.gl/tQo14o41XcLVovCV7",
  mapEmbed: "",
  hours: [
    { label: "Thứ Hai – Thứ Sáu", value: "08:00 – 18:00" },
    { label: "Thứ Bảy", value: "08:00 – 12:00" },
    { label: "Chủ Nhật", value: "Nghỉ" },
  ],
  socials: {
    facebook:
      "https://www.facebook.com/people/Tr%E1%BA%A1m-D%E1%BB%8Bch-V%E1%BB%A5-To%C3%A0n-Trung-Car-Accessories-Auto-Care/61590104625046/",
    tiktok: "https://www.tiktok.com/@toantrung.service.center",
  } as Record<string, string>,
  logo: { src: "/images/logo-dpauto.png", alt: "DPAuto" },
  favicon: null as { src: string; alt: string; assetId?: string } | null,
  footerText: "",
};
export const defaultNavigation = {
  header: [
    { label: "Dịch vụ", href: "/dich-vu" },
    { label: "Phụ kiện", href: "/phu-kien" },
    ...headerDefaults(),
  ],
  footer: [
    {
      title: "Liên kết",
      links: [
        { label: "Trang chủ", href: "/" },
        ...homeNavigation.map(({ label, href }) => ({ label, href })),
        { label: "Liên hệ", href: "/lien-he" },
      ],
    },
  ],
};
