import type { Metadata, Viewport } from "next";
import "@/styles/fonts.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "HyperAuto Care | Seattle Car Detailing & Vehicle Protection",
    template: "%s | HyperAuto Care",
  },
  description:
    "Professional car care, auto detailing, ceramic coating, paint protection film, window tint and vehicle protection services in Seattle.",
  icons: { icon: "/images/logo-dpauto.png" },
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
