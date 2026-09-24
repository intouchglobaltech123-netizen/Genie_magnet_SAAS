import type { Metadata } from "next";
import { PortalShell } from "@/features/portal/portal-shell";

export const metadata: Metadata = {
  title: "Client Hub · Kaveri Organics",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
