import { CheckCheck, ExternalLink, Reply } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WaMessage {
  text: string;
  time: string;
  /** Quick-reply or call-to-action buttons of an approved WhatsApp template. */
  buttons?: { label: string; kind?: "url" | "reply" }[];
  /** Outgoing (from the agency) unless the client replied. */
  from?: "agency" | "client";
}

/**
 * Faithful preview of a WhatsApp Business message thread. Colours are WhatsApp's own,
 * so the preview reads as "this is what the client will see on their phone".
 */
export function WhatsAppPreview({
  business = "Genie Magnet",
  subtitle = "Business account",
  messages,
  className,
}: {
  business?: string;
  subtitle?: string;
  messages: WaMessage[];
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border shadow-card", className)} aria-label={`WhatsApp preview from ${business}`}>
      <div className="flex items-center gap-2.5 bg-[#075E54] px-3.5 py-2.5 text-white">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-body font-semibold">GM</span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-body font-semibold">{business}</div>
          <div className="truncate text-body text-white/75">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-2 bg-[#ECE5DD] p-3 dark:bg-[#0B141A]">
        {messages.map((m, i) => {
          const mine = (m.from ?? "agency") === "agency";
          return (
            <div key={i} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[88%] rounded-lg shadow-sm", mine ? "rounded-tl-none bg-white dark:bg-[#202C33]" : "rounded-tr-none bg-[#D9FDD3] dark:bg-[#005C4B]")}>
                <div className="whitespace-pre-line px-2.5 pb-1 pt-1.5 text-body text-[#111B21] dark:text-[#E9EDEF]">{m.text}</div>
                <div className="flex items-center justify-end gap-1 px-2.5 pb-1 text-body text-[#667781] dark:text-[#8696A0]">
                  {m.time}
                  {!mine && <CheckCheck className="size-3.5 text-[#53BDEB]" />}
                </div>
                {m.buttons && (
                  <div className="divide-y divide-[#E9EDEF] border-t border-[#E9EDEF] dark:divide-[#2A3942] dark:border-[#2A3942]">
                    {m.buttons.map((b) => (
                      <div key={b.label} className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-body font-medium text-[#008069] dark:text-[#00A884]">
                        {b.kind === "url" ? <ExternalLink className="size-3.5" /> : <Reply className="size-3.5" />}
                        {b.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
