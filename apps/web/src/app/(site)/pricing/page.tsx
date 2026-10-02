import type { Metadata } from "next";
import { PricingPage, loadSite } from "@/live/site";

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  return { title: `Pricing · ${site.brandName}` };
}

export default async function Page() {
  return <PricingPage site={await loadSite()} />;
}
