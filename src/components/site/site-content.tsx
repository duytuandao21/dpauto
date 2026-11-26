"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { ServicePrice } from "@/lib/service-price";
import type { CmsAsset } from "@/lib/api/cms";
import type { SiteImage } from "@/lib/content";
import { defaultNavigation, defaultSettings } from "@/lib/cms-defaults";
import {
  image as resolveImage,
  siteCatalog,
  siteVehicles,
  type Payload,
  type SiteCatalog,
  type SiteAccessory,
  type SiteProject,
  type siteNavigation,
  type siteSettings,
} from "@/lib/site-content";

export type SiteData = {
  settings: ReturnType<typeof siteSettings>;
  navigation: ReturnType<typeof siteNavigation>;
  /** Published PAGE payloads by key; null = withdrawn. Missing = built-in default. */
  pages: Record<string, Payload | null>;
  services: {
    slug: string;
    title: string;
    description: string;
    image: SiteImage;
    /** CMS key; the booking catalogue mirrors it as marketingSlug. */
    key?: string;
    /** null/absent = "Liên hệ báo giá". */
    price?: ServicePrice;
    /** Homepage shortcut: uploaded icon image, else this line icon name (serviceIcons). */
    shortcutImage?: SiteImage;
    icon?: string;
  }[];
  accessories: SiteAccessory[];
  catalog: SiteCatalog;
  vehicles: ReturnType<typeof siteVehicles>;
  projects: SiteProject[];
  assets: Record<string, CmsAsset>;
  preview: boolean;
};
const fallback: SiteData = {
  settings: {
    ...defaultSettings,
    phoneHref: "tel:+84772584279",
    custom: false,
  },
  navigation: { ...defaultNavigation, custom: false },
  pages: {},
  services: [],
  accessories: [],
  catalog: siteCatalog({ items: [], assets: {} }),
  vehicles: siteVehicles({ items: [], assets: {} }),
  projects: [],
  assets: {},
  preview: false,
};
const Context = createContext<SiteData>(fallback);
export function SiteContentProvider({
  value,
  children,
}: {
  value: SiteData;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSite = () => useContext(Context);
/** A page section merged over its built-in defaults; null when hidden or withdrawn. */
export function useSection<T extends Payload>(
  key: string,
  defaults: T,
): (T & Payload) | null {
  const raw = useContext(Context).pages[key];
  if (raw === null || raw?.hidden) return null;
  return { ...defaults, ...(raw || {}) };
}
export function useImage() {
  const { assets } = useContext(Context);
  return (v: Payload | null | undefined, fallbackImage?: SiteImage) =>
    resolveImage(v as never, assets) || fallbackImage;
}
