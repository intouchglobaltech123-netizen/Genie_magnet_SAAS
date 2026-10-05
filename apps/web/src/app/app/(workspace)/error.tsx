"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A page that failed to show: the menu stays, with a way to try again or go Home. */
export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-20 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="mt-5 text-heading font-semibold text-text-primary">This page could not be shown</h1>
      <p className="mt-2 max-w-md text-body text-muted-foreground">
        Something went wrong while opening it. Your work is saved. Try again, or write to support if it keeps happening.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw />
          Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app">Go to Home</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/app/support">Write to support</Link>
        </Button>
      </div>
    </div>
  );
}
