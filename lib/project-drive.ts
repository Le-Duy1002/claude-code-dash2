import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { adminDb } from "./firebase-admin"
import { createProjectFolder } from "./google-drive"

export type ProjectFolder = { id: string; url: string; name: string }

class HttpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

/**
 * Returns the project's Drive folder, creating it on first call. Shared by the
 * folder / upload / sync routes so folder creation lives in one place.
 */
export async function ensureProjectDriveFolder(
  projectId: string
): Promise<ProjectFolder> {
  const ref = adminDb().collection("projects").doc(projectId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError("Không tìm thấy dự án", 404)

  const data = snap.data() as Record<string, unknown>
  const displayName = `${(data.code as string) ?? "PRJ"} ${(data.name as string) ?? ""}`
    .trim()
    .slice(0, 120)

  if (data.driveFolderId) {
    return {
      id: data.driveFolderId as string,
      url: (data.driveFolderUrl as string) ?? "",
      name: displayName,
    }
  }

  const folder = await createProjectFolder(displayName)
  await ref.update({
    driveFolderId: folder.id,
    driveFolderUrl: folder.webViewLink,
    driveFolderPending: false,
    updatedAt: FieldValue.serverTimestamp(),
  })
  return { id: folder.id, url: folder.webViewLink, name: displayName }
}
