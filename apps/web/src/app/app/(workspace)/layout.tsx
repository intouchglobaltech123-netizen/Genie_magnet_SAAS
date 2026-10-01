import { LiveShell } from "@/live/shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <LiveShell>{children}</LiveShell>;
}
