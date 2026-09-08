import { auth } from "@/lib/firebase"

export type ProjectFolderResult = {
  driveFolderId: string
  driveFolderUrl: string | null
  already?: boolean
}

/**
 * Ensures the project has a Google Drive folder — creates it on first call,
 * returns the existing one afterwards. Server-side (OAuth as the projects
 * folder owner).
 */
export async function ensureProjectFolder(
  projectId: string
): Promise<ProjectFolderResult> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")

  const response = await fetch(`/api/projects/${projectId}/folder`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || `Lỗi ${response.status}`)
  }
  return body as ProjectFolderResult
}
