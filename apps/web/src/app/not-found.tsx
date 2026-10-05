import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { BrandMark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";

/** Any address the product does not have: a calm way back instead of the framework's bare 404. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <BrandMark className="mb-8" />
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="size-6" />
      </span>
      <h1 className="mt-5 text-heading font-semibold text-text-primary">This page could not be found</h1>
      <p className="mt-2 max-w-md text-body text-muted-foreground">The address may be mistyped, or the page has moved. Nothing has been lost.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/app">
            <ArrowLeft />
            Go to Home
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app/help">Help and support</Link>
        </Button>
      </div>
    </main>
  );
}
