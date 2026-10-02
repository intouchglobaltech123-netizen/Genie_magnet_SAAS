import type { Metadata } from "next";
import { LandingPage, loadSite } from "@/live/site";

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  return { title: site.brandName };
}

export default async function Page() {
  return <LandingPage site={await loadSite()} />;
}
