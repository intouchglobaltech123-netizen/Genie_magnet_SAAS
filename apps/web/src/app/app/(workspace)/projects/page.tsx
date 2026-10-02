import { LiveProjects } from "@/live/projects";

export default async function Page({ searchParams }: { searchParams: Promise<{ task?: string; project?: string }> }) {
  const { task, project } = await searchParams;
  return <LiveProjects taskId={task} projectId={project} />;
}
