import { SettingsFrame } from "@/live/settings-frame";

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
