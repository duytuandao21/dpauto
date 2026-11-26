import type { CSSProperties } from "react";

export type IconName =
  | "arrow"
  | "chevron"
  | "phone"
  | "pin"
  | "clock"
  | "mail"
  | "check"
  | "shield"
  | "tool"
  | "sparkles"
  | "box"
  | "door"
  | "star"
  | "play"
  | "pause"
  | "volume"
  | "muted"
  | "expand"
  | "close"
  | "search"
  | "sort"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "award"
  | "menu"
  | "camera"
  | "angle"
  | "screen"
  | "memory"
  | "battery"
  | "wifi"
  | "moon"
  | "ruler"
  | "layers"
  | "bolt"
  | "sun"
  | "drop"
  | "car"
  | "engine"
  | "spray"
  | "roller"
  | "zalo";
const paths: Record<
  Exclude<IconName, "facebook" | "instagram" | "tiktok" | "zalo">,
  React.ReactNode
> = {
  arrow: (
    <>
      <path d="M7 17 17 7M7 7h10v10" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  phone: (
    <>
      <path d="M15 3a6 6 0 0 1 6 6M15 7a2 2 0 0 1 2 2M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C9 21 3 15 3 5a2 2 0 0 1 2-2Z" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M7 2v4m10-4v4M3 10h18m-13 6 3 3 5-6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="m12 3 8 4v6c0 5-8 9-8 9s-8-4-8-9V7l8-4Z" />
      <path d="m8 12 3 3 5-5" />
    </>
  ),
  tool: (
    <>
      <path d="M14 6a6 6 0 0 0-7 8L2 19l3 3 5-5a6 6 0 0 0 8-7l-4 4-4-4 4-4Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm8-2v4m-2-2h4" />
    </>
  ),
  box: (
    <>
      <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm-9 5 9 5 9-5M12 12v10M7.5 4.5l9 5" />
    </>
  ),
  door: (
    <>
      <path d="M3 21h18M6 21V4l12-2v19M14 12h.01" />
    </>
  ),
  star: (
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" />
  ),
  play: <path d="m8 5 11 7-11 7V5Z" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  volume: (
    <>
      <path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6" />
    </>
  ),
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4" />,
  sort: <path d="M7 4v16m0 0-3-3m3 3 3-3M13 6h8M13 12h6M13 18h4" />,
  award: (
    <>
      <path d="m12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1 3-2Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  menu: <path d="M5 6h14M5 12h14M5 18h14" />,
  // Accessory key-spec icons.
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  angle: (
    <>
      <path d="M12 20 3.5 8.5a14 14 0 0 1 17 0L12 20Z" />
      <path d="M8 11a7 7 0 0 1 8 0" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8m-4-4v4" />
    </>
  ),
  memory: (
    <>
      <path d="M8 3h7l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6l3-3Z" />
      <path d="M9 7v3m3-3v3m3-3v3" />
    </>
  ),
  battery: (
    <>
      <rect x="2" y="7" width="17" height="10" rx="2" />
      <path d="M22 11v2M6 10v4m4-4v4" />
    </>
  ),
  wifi: <path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
  ruler: (
    <>
      <path d="m3 16 13-13 5 5-13 13-5-5Z" />
      <path d="m7 12 2 2m1-5 2 2m1-5 2 2" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  drop: <path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12Z" />,
  engine: (
    <>
      <path d="M9 4h6M12 4v3" />
      <path d="M6 9h3l1-2h5l2 2h2v3h2v4h-2v2h-2l-2 2h-5l-2-2H6V9Z" />
      <path d="M3 11v6M3 14h3" />
    </>
  ),
  spray: (
    <>
      <path d="M8 11h7v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9Z" />
      <path d="M9.5 11V8h4v3M10 8V4h4.5l1.5 1.5" />
      <path d="M19 4h.01M19.5 7.5h.01M21.5 5.5h.01" />
    </>
  ),
  roller: (
    <>
      <rect x="3" y="3" width="15" height="6" rx="1.5" />
      <path d="M18 6h2.5v5.5H11V15" />
      <rect x="9.5" y="15" width="3" height="6" rx="1" />
    </>
  ),
  car: (
    <>
      <path d="M5 17H3v-5l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5h-2M3 12h18m-11.5 5h5" />
      <circle cx="7.5" cy="17" r="2" />
      <circle cx="16.5" cy="17" r="2" />
    </>
  ),
};
/** Icons the admin can pick for an accessory's key specs; names must match the backend list. */
export const specIcons = [
  ["camera", "Camera / độ phân giải"],
  ["angle", "Góc quay"],
  ["screen", "Màn hình"],
  ["memory", "Thẻ nhớ / dung lượng"],
  ["battery", "Pin"],
  ["bolt", "Nguồn điện / sạc"],
  ["wifi", "Kết nối"],
  ["pin", "Định vị GPS"],
  ["moon", "Ban đêm"],
  ["volume", "Âm thanh"],
  ["ruler", "Kích thước"],
  ["layers", "Chất liệu / lớp phủ"],
  ["drop", "Chống nước"],
  ["sun", "Chống UV / nhiệt"],
  ["car", "Dòng xe"],
  ["shield", "Bảo hành / bảo vệ"],
  ["tool", "Lắp đặt"],
  ["sparkles", "Độ bóng"],
  ["star", "Nổi bật"],
] as const satisfies readonly (readonly [IconName, string])[];
/** Icons for the homepage service shortcuts (CMS service form), with their meaning. */
export const serviceIcons = [
  ["tool", "Cờ lê – bảo dưỡng"],
  ["engine", "Động cơ – sửa chữa"],
  ["spray", "Bình xịt – vệ sinh"],
  ["drop", "Giọt nước – rửa xe"],
  ["roller", "Con lăn – decal, đổi màu"],
  ["shield", "Khiên – bảo vệ sơn"],
  ["sun", "Mặt trời – phim cách nhiệt"],
  ["sparkles", "Lấp lánh – phủ, đánh bóng"],
  ["layers", "Lớp phủ"],
  ["box", "Hộp – phụ kiện"],
  ["camera", "Camera"],
  ["screen", "Màn hình"],
  ["bolt", "Tia điện"],
  ["car", "Ô tô – giao nhận"],
] as const satisfies readonly (readonly [IconName, string])[];
export type ServiceIcon = (typeof serviceIcons)[number][0];
export function Icon({
  name,
  className = "",
  style,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`icon ${className}`}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "facebook" ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M14 22v-9h3l.5-4H14V6.5c0-1.2.3-2 2-2h2V1.1C17.6 1 16.4 1 15 1c-3 0-5 1.8-5 5v3H7v4h3v9h4Z"
        />
      ) : name === "tiktok" ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z"
        />
      ) : name === "zalo" ? (
        // Official Zalo icon (Icon_of_Zalo.svg, 50×50) scaled into the 24×24 box, brand colours kept.
        <g transform="scale(0.48)" stroke="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M22.782 0.166016H27.199C33.2653 0.166016 36.8103 1.05701 39.9572 2.74421C43.1041 4.4314 45.5875 6.89585 47.2557 10.0428C48.9429 13.1897 49.8339 16.7347 49.8339 22.801V27.1991C49.8339 33.2654 48.9429 36.8104 47.2557 39.9573C45.5685 43.1042 43.1041 45.5877 39.9572 47.2559C36.8103 48.9431 33.2653 49.8341 27.199 49.8341H22.8009C16.7346 49.8341 13.1896 48.9431 10.0427 47.2559C6.89583 45.5687 4.41243 43.1042 2.7442 39.9573C1.057 36.8104 0.166016 33.2654 0.166016 27.1991V22.801C0.166016 16.7347 1.057 13.1897 2.7442 10.0428C4.43139 6.89585 6.89583 4.41245 10.0427 2.74421C13.1707 1.05701 16.7346 0.166016 22.782 0.166016Z" fill="#0068FF"/>
            <path opacity="0.12" fillRule="evenodd" clipRule="evenodd" d="M49.8336 26.4736V27.1994C49.8336 33.2657 48.9427 36.8107 47.2555 39.9576C45.5683 43.1045 43.1038 45.5879 39.9569 47.2562C36.81 48.9434 33.265 49.8344 27.1987 49.8344H22.8007C17.8369 49.8344 14.5612 49.2378 11.8104 48.0966L7.27539 43.4267L49.8336 26.4736Z" fill="#001A33"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M7.779 43.5892C10.1019 43.846 13.0061 43.1836 15.0682 42.1825C24.0225 47.1318 38.0197 46.8954 46.4923 41.4732C46.8209 40.9803 47.1279 40.4677 47.4128 39.9363C49.1062 36.7779 50.0004 33.22 50.0004 27.1316V22.7175C50.0004 16.629 49.1062 13.0711 47.4128 9.91273C45.7385 6.75436 43.2461 4.28093 40.0877 2.58758C36.9293 0.894239 33.3714 0 27.283 0H22.8499C17.6644 0 14.2982 0.652754 11.4699 1.89893C11.3153 2.03737 11.1636 2.17818 11.0151 2.32135C2.71734 10.3203 2.08658 27.6593 9.12279 37.0782C9.13064 37.0921 9.13933 37.1061 9.14889 37.1203C10.2334 38.7185 9.18694 41.5154 7.55068 43.1516C7.28431 43.399 7.37944 43.5512 7.779 43.5892Z" fill="white"/>
            <path d="M20.5632 17H10.8382V19.0853H17.5869L10.9329 27.3317C10.7244 27.635 10.5728 27.9194 10.5728 28.5639V29.0947H19.748C20.203 29.0947 20.5822 28.7156 20.5822 28.2606V27.1421H13.4922L19.748 19.2938C19.8428 19.1801 20.0134 18.9716 20.0893 18.8768L20.1272 18.8199C20.4874 18.2891 20.5632 17.8341 20.5632 17.2844V17Z" fill="#0068FF"/>
            <path d="M32.9416 29.0947H34.3255V17H32.2402V28.3933C32.2402 28.7725 32.5435 29.0947 32.9416 29.0947Z" fill="#0068FF"/>
            <path d="M25.814 19.6924C23.1979 19.6924 21.0747 21.8156 21.0747 24.4317C21.0747 27.0478 23.1979 29.171 25.814 29.171C28.4301 29.171 30.5533 27.0478 30.5533 24.4317C30.5723 21.8156 28.4491 19.6924 25.814 19.6924ZM25.814 27.2184C24.2785 27.2184 23.0273 25.9672 23.0273 24.4317C23.0273 22.8962 24.2785 21.645 25.814 21.645C27.3495 21.645 28.6007 22.8962 28.6007 24.4317C28.6007 25.9672 27.3685 27.2184 25.814 27.2184Z" fill="#0068FF"/>
            <path d="M40.4867 19.6162C37.8516 19.6162 35.7095 21.7584 35.7095 24.3934C35.7095 27.0285 37.8516 29.1707 40.4867 29.1707C43.1217 29.1707 45.2639 27.0285 45.2639 24.3934C45.2639 21.7584 43.1217 19.6162 40.4867 19.6162ZM40.4867 27.2181C38.9322 27.2181 37.681 25.9669 37.681 24.4124C37.681 22.8579 38.9322 21.6067 40.4867 21.6067C42.0412 21.6067 43.2924 22.8579 43.2924 24.4124C43.2924 25.9669 42.0412 27.2181 40.4867 27.2181Z" fill="#0068FF"/>
            <path d="M29.4562 29.0944H30.5747V19.957H28.6221V28.2793C28.6221 28.7153 29.0012 29.0944 29.4562 29.0944Z" fill="#0068FF"/>
        </g>
      ) : name === "instagram" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r=".5" />
        </>
      ) : (
        paths[name]
      )}
    </svg>
  );
}
