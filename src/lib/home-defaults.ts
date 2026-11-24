// Built-in content of each homepage section, in the CMS section shape. Components render
// these until a published CMS document overrides the section; the admin prefills from them.
import { homeVi } from "./home-vi";

export const heroFeatures = [
  { icon: "award", text: "Đội ngũ giàu kinh nghiệm, chăm chút từng chi tiết." },
  { icon: "box", text: "Sản phẩm và thiết bị chuyên dụng, được chọn lọc kỹ." },
  {
    icon: "shield",
    text: "Chăm sóc chuyên nghiệp, giữ xe sạch đẹp và bền lâu.",
  },
  { icon: "door", text: "Nhận xe trực tiếp với một số dịch vụ." },
] as const;
const pricing: [string, [string, string, string][]][] = [
  [
    "LÀM SẠCH & PHỤC HỒI",
    [
      ["Rửa xe chuyên sâu", "Từ $65", "detail-wash"],
      ["Vệ sinh nội thất", "Từ $180", "interior-detailing"],
      ["Hiệu chỉnh sơn", "Từ $450", "paint-correction"],
      ["Vệ sinh khoang máy", "Từ $95", "engine-bay-detailing"],
      ["Phục hồi đèn pha", "Từ $140", "headlight-restoration"],
    ],
  ],
  [
    "BẢO VỆ & NÂNG CẤP",
    [
      ["Phủ ceramic", "Từ $850", "ceramic-coating"],
      ["Dán phim PPF", "Liên hệ báo giá", "paint-protection-film-ppf"],
      ["Dán phim cách nhiệt", "Từ $280", "window-tint"],
      ["Tẩy ố kính", "Từ $120", "glass-water-spot-removal"],
      ["Phủ gầm bảo vệ", "Từ $380", "underbody-coating-protection"],
    ],
  ],
];
export const brandLogos = [
  { name: "70mai", file: "70mai", width: 447, height: 447 },
  { name: "HELIOZ", file: "helioz", width: 565, height: 353 },
  { name: "ICAR", file: "icar", width: 1094, height: 658 },
  { name: "VINCAR", file: "vincar", width: 225, height: 225 },
  { name: "WOLVER", file: "wolver", width: 1181, height: 295 },
  { name: "YueMi", file: "yuemi", width: 800, height: 200 },
  { name: "Zestech", file: "zestech", width: 800, height: 228 },
];
const reviewPhotos: Record<string, { src: string; label: string }> = {
  "Jason M.": {
    src: "/images/goYpkWeKDzA4B82FnuXUu7k24k.webp",
    label: "photo",
  },
  "Michael R.": { src: "/images/Lkhwq0ZpwZj3WdTam0yk91jo.webp", label: "wide" },
};

export const homeDefaults = {
  "home.hero": {
    title: "Chăm sóc ô tô chuyên nghiệp",
    description:
      "Giữ xe sạch đẹp, sáng bóng và bền lâu với dịch vụ vệ sinh, phủ ceramic, dán phim cách nhiệt và bảo vệ sơn.",
    image: {
      src: "/images/hero-dpauto-1.png",
      alt: "Kỹ thuật viên Toàn Trung thi công phim cách nhiệt cho ô tô",
    },
    images: [
      {
        src: "/images/garage-team.jpg",
        alt: "Đội ngũ Trạm dịch vụ Toàn Trung trước gara",
      },
    ],
    cta: { label: "Gọi ngay", href: "" },
    note: "https://share.google/pVB8v0vWu4Mhx44U6",
    items: heroFeatures.map((f) => ({ text: f.text })),
  },
  "home.services": {
    title: "Dịch vụ chăm sóc xe",
    description:
      "Từ làm sạch đến bảo vệ chuyên sâu, chọn dịch vụ phù hợp cho xe của bạn.",
  },
  "home.accessories": {
    title: "Phụ kiện ô tô",
    description:
      "Thêm tiện nghi, nâng tầm trải nghiệm lái xe với những phụ kiện phù hợp cho chiếc xe của bạn.",
    note: "Bạn cần chọn phụ kiện phù hợp với xe?",
    cta: { label: "Xem thêm phụ kiện", href: "/phu-kien" },
  },
  "home.process": {
    title: "Quy trình chăm sóc xe",
    note: "Một số dịch vụ nhận xe trực tiếp. Với phủ ceramic, dán PPF, phim cách nhiệt và chăm sóc chuyên sâu, bạn nên gọi trước.",
    image: {
      src: "/images/DtZUUfzGF1adTjqnD7pA9HwQuI.webp",
      alt: "Kỹ thuật viên đánh bóng sơn xe tại xưởng chăm sóc ô tô",
    },
    items: homeVi.process.map((s) => ({ title: s.title, text: s.description })),
  },
  "home.pricing": {
    title: "Dịch vụ & bảng giá",
    description:
      "Giá tùy vào kích thước, tình trạng xe và hạng mục thực hiện. Liên hệ để nhận báo giá chính xác.",
    subtitle: "Bảng giá dịch vụ tham khảo",
    note: "Liên hệ để được tư vấn và báo giá chi tiết.",
    cta: { label: "Gọi tư vấn", href: "" },
    items: pricing.flatMap(([group, rows]) =>
      rows.map(([title, price, slug]) => ({
        meta: group,
        title,
        price,
        href: `/dich-vu/${slug}`,
      })),
    ),
  },
  "home.work": {
    title: "Khác biệt từ từng chi tiết",
    description: "Kết quả thực tế sau khi làm sạch, hiệu chỉnh và phục hồi xe.",
    cta: { label: "Xem thêm thành quả", href: "/thanh-qua" },
  },
  "home.gallery": {
    title: "Theo dõi những hình ảnh và công việc mới nhất tại xưởng.",
    images: [
      {
        src: "/images/mGs8Snpdilvf4Tj97QjW0FdaAy0.webp",
        alt: "Xe sau khi hoàn tất chăm sóc tại DPAuto",
      },
      {
        src: "/images/gv0F2vE8CnjY1WUos05p1ycEuDQ.webp",
        alt: "Chăm sóc xe tại xưởng DPAuto",
      },
      {
        src: "/images/IPz1ZOzMs2KRfySU3adLI7XJnvE.webp",
        alt: "Rửa xe và chăm sóc ngoại thất tại DPAuto",
      },
      {
        src: "/images/o2dUjNf8zaSm1OA9O9k0HFYVSIU.webp",
        alt: "Hoàn thiện bề mặt xe tại DPAuto",
      },
    ],
    cta: { label: "Theo dõi Facebook", href: "https://www.facebook.com/" },
    cta2: { label: "Theo dõi TikTok", href: "https://www.tiktok.com/" },
  },
  "home.benefits": {
    title: "Vì sao chọn DPAuto?",
    image: {
      src: "/images/5jFIDmf3fDYVLCeKxRoGZM5XCA.webp",
      alt: "Xe SUV trong xưởng chăm sóc ô tô DPAuto",
    },
    items: homeVi.benefits.map((b) => ({
      title: b.title,
      text: b.description,
    })),
  },
  "home.reviews": {
    title: "Khách hàng nói gì?",
    description: "Trải nghiệm thực tế của khách hàng tại DPAuto.",
    items: homeVi.reviews.map((r) => ({
      author: r.name,
      text: r.text,
      meta: r.service,
      ...(reviewPhotos[r.name]
        ? {
            image: {
              src: reviewPhotos[r.name].src,
              alt: `Đánh giá của ${r.name} tại DPAuto`,
            },
            label: reviewPhotos[r.name].label,
          }
        : {}),
    })),
  },
  "home.brands": {
    title: "Thương hiệu được lựa chọn",
    description:
      "Những thương hiệu được DPAuto lựa chọn cho các hạng mục chăm sóc và nâng cấp xe.",
    images: brandLogos.map((b) => ({
      src: `/images/brands/${b.file}.png`,
      alt: b.name,
    })),
  },
  "home.news": { title: "Tin mới từ DPAuto" },
  "home.faq": {
    title: "Câu hỏi thường gặp",
    description:
      "Giải đáp về lịch hẹn, thời gian thực hiện và chi phí dịch vụ.",
    items: homeVi.faq.map((f) => ({ title: f.question, text: f.answer })),
  },
  "home.location": { title: "Ghé thăm DPAuto" },
  "home.cta": {
    title: "Chăm chút xứng tầm cho xe của bạn",
    description:
      "Từ làm sạch đến bảo vệ lâu dài, DPAuto luôn đồng hành để xe bạn bền đẹp.",
    image: {
      src: "/images/tzpnoVuiPL9CIASVtJD4w77vGPQ.jpg",
      alt: "Xe Mercedes màu bạc trong xưởng chăm sóc ô tô",
    },
    cta2: { label: "Gọi ngay", href: "" },
  },
};
export type HomeKey = keyof typeof homeDefaults;
/** Homepage sections in display order. */
export const homeOrder: HomeKey[] = [
  "home.hero",
  "home.services",
  "home.accessories",
  "home.process",
  "home.pricing",
  "home.work",
  "home.gallery",
  "home.benefits",
  "home.reviews",
  "home.brands",
  "home.news",
  "home.faq",
  "home.location",
  "home.cta",
];
