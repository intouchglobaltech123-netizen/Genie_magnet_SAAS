"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface ShellState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
}

export const useShell = create<ShellState>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
    }),
    {
      name: "gm-shell-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ collapsed: s.collapsed }),
      skipHydration: true,
    },
  ),
);
