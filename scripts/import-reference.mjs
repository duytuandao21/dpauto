import fs from "node:fs";
import path from "node:path";

// Converts the inspected reference into local, framework-independent content.
const read = (name) =>
  JSON.parse(fs.readFileSync(`reference/${name}.json`, "utf8"));
const image = (item) => ({
  src: `/images/${new URL(item.src).pathname.split("/").pop()}`,
  alt: item.alt,
});
const block = (item) => ({
  tag: item.tag.toLowerCase(),
  text: item.text,
  html: item.html
    .replaceAll("https://hyperautocare.framer.website", "")
    .replace(/href="(?:\.\.\/|\.\/)+/g, 'href="/')
    .replace(/\s(?:class|style|data-[\w-]+|dir)="[^"]*"/g, ""),
});
const between = (items, start, end) =>
  items.slice(items.findIndex(start), end ? items.findIndex(end) : undefined);
const faq = (name) =>
  fs.existsSync(`reference/${name}-faq.json`) ? read(`${name}-faq`) : [];
const home = read("home");
const serviceOrder = [
  "detail-wash",
  "interior-detailing",
  "paint-correction",
  "ceramic-coating",
  "paint-protection-film-(ppf)",
  "window-tint",
  "engine-bay-detailing",
  "headlight-restoration",
  "glass-water-spot-removal",
  "underbody-coating-protection",
];
const services = serviceOrder.map((slug) => {
  const p = read(`services__${slug}`),
    b = p.blocks;
  const process = between(
    b,
    (e) => e.text === "Service Process",
    (e) => e.name === "Why Choose Us",
  );
  const benefits = between(
    b,
    (e) => e.name === "Why Choose Us",
    (e) => e.name === "FAQ",
  );
  const images = p.images.filter(
    (e) =>
      e.name !== "Image Logo" &&
      e.name !== "Default" &&
      e.name !== "Background",
  );
  return {
    slug,
    title: b.find((e) => e.tag === "H1").text,
    description: b.find((e) => e.name === "Service Introduction").text,
    image: image(images[0]),
    overview: between(
      b,
      (e) => e.name === "Service Overview",
      (e) => e.text === "Service Process",
    )
      .slice(1)
      .map(block),
    overviewHtml: read(`services__${slug}-overview`).html,
    overviewImages: images
      .filter((e) => e.name === "Service Overview")
      .map(image),
    processIntroduction: process.find((e) => e.tag === "P")?.text ?? "",
    process: process
      .filter((e) => e.name === "Process Name")
      .map((e) => ({ title: e.text, description: b[b.indexOf(e) + 1].text })),
    benefitsTitle: benefits[0].text,
    benefitsIntroduction: benefits.find((e) => e.tag === "P")?.text ?? "",
    benefits: benefits
      .filter((e) => e.tag === "H3")
      .map((e) => ({ title: e.text, description: b[b.indexOf(e) + 1].text })),
    faq: faq(`services__${slug}`),
    gallery: images.filter((e) => e.name === "Image").map(image),
  };
});
const newsOrder = [
  "ceramic-coating-maintenance-guide",
  "ppf-vs-ceramic-coating",
  "window-tint-aftercare-guide",
  "seattle-wet-weather-car-care",
  "why-detailing-preparation-matters",
  "seasonal-vehicle-protection-special",
];
const articles = newsOrder.map((slug) => {
  const p = read(`news__${slug}`),
    b = p.blocks;
  const h = b.findIndex((e) => e.tag === "H1");
  const end = b.findIndex((e) => e.text === "< Back to News & Promotion");
  const content = b
    .slice(h + 2, end)
    .filter(
      (e, i, a) =>
        !(e.tag === "P" && a[i - 1]?.tag === "LI" && a[i - 1].text === e.text),
    );
  return {
    slug,
    title: b[h].text,
    category: b[h - 3].text,
    date: b[h - 1].text,
    description: b[h + 1].text,
    image: image(
      p.images.find((e) => e.name !== "Image Logo" && e.name !== "Background"),
    ),
    content: content.map(block),
  };
});
const work = read("our-work");
const projectImages = work.images.filter((e) => e.name === "Variant 1");
const projects = work.blocks
  .filter((e) => e.name === "Title")
  .map((e, i) => {
    const b = work.blocks,
      n = b.indexOf(e);
    return {
      title: e.text,
      vehicle: b[n + 2].text,
      duration: b[n + 4].text,
      services: b[n + 6].text,
      description: b[n + 7].text,
      after: image(projectImages[i * 2]),
      before: image(projectImages[i * 2 + 1]),
    };
  });
const pairs = (blocks, name) =>
  blocks
    .filter((e) => e.name === name && e.tag === "H3")
    .map((e) => ({
      title: e.text,
      description: blocks[blocks.indexOf(e) + 1].text,
    }));
const about = read("about");
const legal = Object.fromEntries(
  ["privacy", "terms"].map((name) => {
    const p = read(name);
    const first = p.blocks.findIndex((e) => e.name === "Legal Eyebrow");
    const last = p.blocks.findIndex((e) => e.name === "Brand Description");
    const b = p.blocks
      .slice(first, last)
      .filter(
        (e, i, a) =>
          !(
            e.tag === "P" &&
            a[i - 1]?.tag === "LI" &&
            a[i - 1].text === e.text
          ),
      );
    return [name, b.map(block)];
  }),
);
const output = {
  services,
  articles,
  projects,
  legal,
  home: {
    faq: faq("home"),
    process: pairs(
      between(
        home.blocks,
        (e) => e.text === "How Our Service Works",
        (e) => e.text === "Service Packages & Pricing",
      ),
      "Title",
    ),
    benefits: pairs(
      between(
        home.blocks,
        (e) => e.text === "Why Drivers Choose HyperAuto Care",
        (e) => e.text === "Customer Reviews",
      ),
      "Title",
    ),
    reviews: home.blocks
      .filter((e) => e.name === "Customer Name")
      .map((e) => {
        let n = home.blocks.indexOf(e);
        return {
          name: e.text,
          text: home.blocks[n - 1].text,
          service: home.blocks[n + 1].text,
        };
      }),
    training: pairs(home.blocks, "Program Name"),
  },
  about: {
    blocks: about.blocks.slice(9, 43).map(block),
    images: about.images.map(image),
    approach: pairs(about.blocks, "Title"),
    workshop: pairs(about.blocks, "Program Name"),
    video: about.videos.map((v) => ({
      src: "/videos/" + new URL(v.src).pathname.split("/").pop(),
      poster: v.poster,
    })),
  },
  banners: Object.fromEntries(
    ["services", "our-work", "news", "about", "contact"].map((name) => [
      name,
      image(read(name).images.find((e) => e.name === "Hero Image")),
    ]),
  ),
};
fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/site-content.json", JSON.stringify(output, null, 2));
console.log(
  `Imported ${services.length} services, ${articles.length} articles, ${projects.length} projects.`,
);
