import {
  collection,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore"

import { auth, db } from "@/lib/firebase"
import type { DocumentItem } from "@/features/documents/types"

export type ProjectDocItem = DocumentItem & {
  /** immediate parent folder id relative to the project root ("" = root) */
  parentId: string
  isFolder: boolean
}

function projectDocsCollection(projectId: string) {
  return collection(db, "projects", projectId, "documents")
}

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

function mapDoc(id: string, data: Record<string, unknown>): ProjectDocItem {
  return {
    id,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    fileName: (data.fileName as string) ?? "",
    size: Number(data.size ?? 0),
    contentType: (data.contentType as string) ?? "application/octet-stream",
    driveFileId: (data.driveFileId as string) ?? id,
    webViewLink: (data.webViewLink as string) ?? "",
    driveModifiedTime: (data.driveModifiedTime as string) ?? "",
    parentId: (data.parentId as string) ?? "",
    isFolder: Boolean(data.isFolder),
    uploadedByName: (data.uploadedByName as string) ?? "—",
    source: (data.source as string) ?? "drive",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  }
}

export function subscribeToProjectDocuments(
  projectId: string,
  onData: (docs: ProjectDocItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    projectDocsCollection(projectId),
    (snap) => {
      const rows = snap.docs
        .map((d) => mapDoc(d.id, d.data()))
        .sort((a, b) => b.createdAt - a.createdAt)
      onData(rows)
    },
    (error) => onError?.(error)
  )
}

async function idToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")
  return token
}

export async function uploadProjectDocument(
  projectId: string,
  file: File,
  parentId = ""
): Promise<void> {
  const form = new FormData()
  form.append("file", file)
  if (parentId) form.append("parentId", parentId)
  const response = await fetch(`/api/projects/${projectId}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await idToken()}` },
    body: form,
  })
  if (response.status === 413) {
    throw new Error(
      "Tệp vượt giới hạn (~4 MB). Tải trực tiếp lên thư mục Drive của dự án rồi bấm Đồng bộ."
    )
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
}

/** Creates a subfolder or an empty named file inside the project's Drive tree. */
export async function createProjectItem(
  projectId: string,
  params: { parentId?: string; name: string; isFolder: boolean }
): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/documents/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await idToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parentId: params.parentId ?? "",
      name: params.name,
      isFolder: params.isFolder,
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
}

export async function renameProjectDocument(
  projectId: string,
  fileId: string,
  name: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectId}/documents/${fileId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${await idToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
}

export async function deleteProjectDocument(
  projectId: string,
  fileId: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectId}/documents/${fileId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await idToken()}` },
    }
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
}

export async function syncProjectDocuments(projectId: string): Promise<{
  total: number
  created: number
  updated: number
  deleted: number
}> {
  const response = await fetch(
    `/api/projects/${projectId}/documents/sync`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${await idToken()}` },
    }
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
  return body
}
