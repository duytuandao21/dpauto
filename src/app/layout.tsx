import type { Metadata, Viewport } from "next";
import "@/styles/fonts.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  // Canonical URLs are relative; the public domain makes them absolute.
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }
    : {}),
  title: {
    default: "DPAuto – Trạm Dịch Vụ Toàn Trung | Bảo dưỡng, sửa chữa và chăm sóc ô tô",
    template: "%s | DPAuto",
  },
  description:
    "DPAuto – Trạm Dịch Vụ Toàn Trung: bảo dưỡng, sửa chữa, vệ sinh họng nạp, dán PPF, phim cách nhiệt, decal đổi màu và phụ kiện ô tô tại 787–789 Quốc lộ 13, Hiệp Bình, TP. Hồ Chí Minh.",
  // The favicon (or logo) uploaded in "Cài đặt website", or the built-in logo.
  icons: { icon: "/site-logo/favicon" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e20000",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="dpauto-theme">{children}</body>
    </html>
  );
}
