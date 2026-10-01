"use client";

import { useState } from "react";
import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shell/brand";
import { ApiError, LIVE } from "./api";

/** Data for the real app. On a server without the API (the hosted demo), /app explains instead. */
export function LiveProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // A refusal (not signed in, not allowed, not found) will not change by asking again; only retry outages.
            retry: (failures, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2,
          },
        },
      }),
  );
  if (!LIVE) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <BrandMark className="mx-auto" />
          <h1 className="mt-4 text-subheading font-semibold">The real app is not connected on this server yet</h1>
          <p className="mt-2 text-body text-muted-foreground">This address runs the clickable demo with sample data.</p>
          <Button asChild className="mt-4">
            <Link href="/">Open the demo</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
