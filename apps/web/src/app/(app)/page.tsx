"use client";

import { useDemo } from "@/lib/store";
import { FounderDashboard } from "@/features/overview/dashboard/founder-dashboard";
import { RoleDashboard } from "@/features/overview/dashboard/role-dashboard";

export default function DashboardPage() {
  const role = useDemo((s) => s.role);
  if (role === "founder" || role === "client") return <FounderDashboard />;
  return <RoleDashboard role={role} />;
}
