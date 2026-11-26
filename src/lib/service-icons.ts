// Icon images shipped with the site (public/icons/dich-vu/<slug>.png) for the built-in services.
const bundled = new Set([
  "bao-duong-dinh-ky",
  "dan-decal-doi-mau",
  "dan-phim-cach-nhiet",
  "dan-ppf-bao-ve-son",
  "giao-nhan-xe-tan-noi",
  "nang-cap-lap-dat-phu-kien",
  "phu-ceramic",
  "sua-chua-o-to",
  "ve-sinh-hong-nap",
]);
/** Same style as the bundled set, for services the admin has not given an icon yet. */
export const defaultServiceIcon = "/icons/dich-vu/mac-dinh.png";
/** Shortcut tile for an accessory category without an uploaded image. */
export const defaultAccessoryIcon = "/icons/phu-kien/mac-dinh.png";
export const bundledServiceIcon = (slug: string) =>
  bundled.has(slug) ? `/icons/dich-vu/${slug}.png` : undefined;
