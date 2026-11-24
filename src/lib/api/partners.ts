"use client";
import { useEffect, useState } from "react";
import { apiEnabled, request } from "./client";

/** Names saved on a booking/ticket when it was made (renaming a sale does not rewrite it). */
export type PartnerSnapshot = {
  partnerId: string;
  partnerName: string;
  saleId: string;
  saleName: string;
};
export type PartnerSale = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  version: number;
};
export type Partner = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  version: number;
  sales: PartnerSale[];
};

export function usePartners(reload = 0) {
  const [partners, setPartners] = useState<Partner[]>([]),
    [loading, setLoading] = useState(apiEnabled),
    [error, setError] = useState("");
  useEffect(() => {
    if (!apiEnabled) return;
    const a = new AbortController();
    request<Partner[]>("admin/partners", { signal: a.signal })
      .then((r) => {
        setPartners(r.data);
        setError("");
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [reload]);
  return { partners, loading, error };
}

/** "Xe Lướt Toàn Trung · Sale A" */
export const partnerLabel = (p?: PartnerSnapshot | null) =>
  p ? `${p.partnerName} · ${p.saleName}` : "";
