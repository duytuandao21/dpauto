"use client";
import { useEffect } from "react";

type Preset = { serviceKeys: string[]; note?: string };
let current: Preset | null = null;
/** What the booking form pre-fills on the page being viewed (read when the form opens). */
export const bookingPreset = () => current;

/**
 * Rendered by a service or accessory page: any "Đặt lịch" button opened there (page, header,
 * mobile bar) pre-ticks these website services and suggests the note. Cleared when leaving.
 */
export function BookingPreset({ serviceKeys, note }: Preset) {
  const keys = serviceKeys.join(",");
  useEffect(() => {
    current = { serviceKeys: keys ? keys.split(",") : [], note };
    return () => {
      current = null;
    };
  }, [keys, note]);
  return null;
}
