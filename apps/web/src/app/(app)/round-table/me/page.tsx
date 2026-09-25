import { MyFeedback } from "@/features/round-table/my-feedback";

export default async function MyRoundTableFeedbackPage({ searchParams }: { searchParams: Promise<{ person?: string; session?: string }> }) {
  const { person, session } = await searchParams;
  return <MyFeedback initialPerson={person} initialSession={session} />;
}
