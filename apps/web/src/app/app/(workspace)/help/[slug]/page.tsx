import { LiveHelpArticle } from "@/live/help";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LiveHelpArticle slug={slug} />;
}
