import { auth } from "@/lib/firebase"

import {
  ProjectFormError,
  type LinkedDriveFolder,
  type ProjectDriveCheck,
} from "../types"

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

/**
 * Checks a pasted link to an existing Drive folder for a new project. Throws
 * `ProjectFormError` with the reason when the folder can't be used.
 */
export async function checkDriveFolderLink(
  link: string
): Promise<LinkedDriveFolder> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")

  const response = await fetch("/api/projects/drive-folder", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ link }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ProjectFormError(body.error || `Lỗi ${response.status}`)
  }
  return body as LinkedDriveFolder
}

/**
 * "Kiểm tra Drive": can the app write into the project's folder? With
 * `repair`, recreates a deleted folder / shares it with the mirror account.
 */
export async function checkProjectDrive(
  projectId: string,
  repair = false
): Promise<ProjectDriveCheck> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")

  const response = await fetch(`/api/projects/${projectId}/drive-check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repair }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || `Lỗi ${response.status}`)
  }
  return body as ProjectDriveCheck
}
