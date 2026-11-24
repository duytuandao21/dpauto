// Built-in banners and bodies of the inner pages, in the CMS section shape.
import { about, banners, legal } from "./content";

const html = (blocks: { tag: string; html: string }[]) =>
  blocks
    .map((b) =>
      b.tag === "li"
        ? `<ul><li>${b.html}</li></ul>`
        : `<${b.tag}>${b.html}</${b.tag}>`,
    )
    .join("")
    .replace(/<\/ul><ul>/g, "");

export const pageDefaults = {
  services: { title: "Dịch vụ của chúng tôi", image: banners.services },
  "our-work": {
    title: "Thành quả",
    image: {
      src: "/images/5jFIDmf3fDYVLCeKxRoGZM5XCA.webp",
      alt: "SUV đen mở cửa trong xưởng chăm sóc xe",
    },
  },
  news: { title: "Tin tức từ DPAuto", image: banners.news },
  about: {
    title: "Về DPAuto",
    image: banners.about,
    // Page blocks, prefilled from the original layout's copy and photos.
    parts: {
      story: {
        subtitle: "CÂU CHUYỆN",
        title: about.blocks[1].text,
        description: about.blocks[2].text,
        note: about.blocks[3].text,
        images: [about.images[2], about.images[3], about.images[4]],
        videos: [{ src: about.video[0].src, alt: "Video xưởng DPAuto" }],
      },
      approach: {
        title: "Cách chúng tôi làm việc, Tận tâm từng bước",
        items: about.approach.map((a) => ({
          title: a.title,
          text: a.description,
        })),
      },
      workshop: {
        title: "Xưởng chăm sóc xe chuyên nghiệp",
        description: about.blocks[18].text,
        image: about.images[5],
        items: about.workshop.map((a) => ({
          title: a.title,
          text: a.description,
        })),
      },
      team: {
        title: "Những con người tận tâm với công việc",
        description: about.blocks[28].text,
        note: about.blocks[29].text,
        image: about.images[6],
        images: [about.images[7]],
      },
    },
  },
  contact: { title: "Liên hệ", image: banners.contact },
  "phu-kien": {
    title: "Phụ kiện ô tô",
    description:
      "Thêm tiện nghi, nâng tầm trải nghiệm lái xe với những phụ kiện phù hợp cho chiếc xe của bạn.",
    // Shown as the FAQ block under the product list.
    items: [
      {
        title: "Lắp đặt phụ kiện mất bao lâu?",
        text: "Tùy loại phụ kiện và dòng xe. DPAuto sẽ báo thời gian cụ thể khi tư vấn để bạn chủ động sắp xếp lịch.",
      },
      {
        title: "Phụ kiện có phù hợp với xe của tôi không?",
        text: "Bạn cho DPAuto biết dòng xe và đời xe, đội ngũ kỹ thuật sẽ tư vấn phụ kiện tương thích trước khi lắp.",
      },
      {
        title: "Phụ kiện được bảo hành như thế nào?",
        text: "Mỗi sản phẩm có chính sách bảo hành riêng theo hãng. Vui lòng liên hệ DPAuto để được tư vấn chi tiết.",
      },
      {
        title: "Tôi có cần đặt lịch trước khi đến lắp?",
        text: "Nên đặt lịch trước để DPAuto chuẩn bị sẵn sản phẩm và kỹ thuật viên, bạn đến là được phục vụ ngay.",
      },
    ],
  },
  privacy: { title: "Chính sách bảo mật" },
  terms: { title: "Điều khoản sử dụng" },
};
/** Original legal text as HTML, used to prefill the editor. */
export const legalHtml = {
  privacy: html(legal.privacy),
  terms: html(legal.terms),
};
export type PageKey = keyof typeof pageDefaults;
