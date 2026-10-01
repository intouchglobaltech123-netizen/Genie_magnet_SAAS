import { LiveProviders } from "@/live/provider";

// The real application, on the API (Phase 1 onwards). The clickable demo stays at the root until each module is live.
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <LiveProviders>{children}</LiveProviders>;
}
