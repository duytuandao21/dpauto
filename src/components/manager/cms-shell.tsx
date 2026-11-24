"use client";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/admin/auth-gate";

/** Sign-in and session gate for the website admin (/admin). */
export function CmsShell({ children }: { children: ReactNode }) {
  return <AuthGate cms>{children}</AuthGate>;
}
