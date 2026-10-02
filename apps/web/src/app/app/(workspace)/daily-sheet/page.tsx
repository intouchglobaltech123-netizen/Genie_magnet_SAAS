import { LiveDailySheet } from "@/live/daily-sheet";

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string; person?: string }> }) {
  const { date, person } = await searchParams;
  return <LiveDailySheet date={date} person={person} />;
}
