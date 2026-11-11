import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function HeaderButton({
  href,
  children,
  phone = false,
  className = "",
  onClick,
}: {
  href: string;
  children: ReactNode;
  phone?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Button
      href={href}
      variant={phone ? "secondary" : "primary"}
      icon={phone ? "phone" : undefined}
      className={`header-button ${className}`}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
