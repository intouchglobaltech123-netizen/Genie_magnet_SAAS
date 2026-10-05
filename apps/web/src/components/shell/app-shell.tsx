"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { MobileSidebar, Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useShell } from "./ui-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useShell((s) => s.collapsed);

  useEffect(() => {
    useShell.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileSidebar />
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[256px]")}>
        <Topbar />
        <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8 2xl:px-10">{children}</main>
      </div>
    </div>
  );
}
