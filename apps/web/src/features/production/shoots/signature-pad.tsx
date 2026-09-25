"use client";

import { useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignaturePad({ onSave, disabled }: { onSave: (dataUrl: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  const ctx = () => {
    const c = ref.current;
    if (!c) return null;
    const g = c.getContext("2d");
    if (!g) return null;
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-text-primary").trim() || "black";
    return g;
  };

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-secondary">
        <canvas
          ref={ref}
          width={640}
          height={180}
          aria-label="Signature pad"
          role="img"
          className="h-[120px] w-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            if (disabled) return;
            const g = ctx();
            if (!g) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const p = point(e);
            g.beginPath();
            g.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const g = ctx();
            if (!g) return;
            const p = point(e);
            g.lineTo(p.x, p.y);
            g.stroke();
            if (!dirty) setDirty(true);
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
        />
        {!dirty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-body text-muted-foreground">
            Client signs here with a finger or stylus
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-border" />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          size="xs"
          variant="ghost"
          disabled={!dirty}
          onClick={() => {
            const c = ref.current;
            c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
            setDirty(false);
          }}
        >
          <Eraser /> Clear
        </Button>
        <Button size="xs" variant="accent" disabled={!dirty || disabled} onClick={() => ref.current && onSave(ref.current.toDataURL("image/png"))}>
          Save signature
        </Button>
      </div>
    </div>
  );
}
