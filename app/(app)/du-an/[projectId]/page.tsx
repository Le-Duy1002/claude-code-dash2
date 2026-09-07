import { ProjectDetail } from "@/features/projects"

export default async function DuAnChiTietPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <ProjectDetail projectId={projectId} />
}
