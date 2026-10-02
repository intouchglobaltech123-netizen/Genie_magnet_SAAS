import { LiveImportReport } from "@/live/import-report";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveImportReport id={id} />;
}
