import {
  collection,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore"

import { auth, db } from "@/lib/firebase"

import type { DocumentItem } from "../types"

const documentsCollection = collection(db, "documents")

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

function mapDocument(id: string, data: Record<string, unknown>): DocumentItem {
  return {
    id,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    fileName: (data.fileName as string) ?? "",
    size: (data.size as number) ?? 0,
    contentType: (data.contentType as string) ?? "application/octet-stream",
    driveFileId: (data.driveFileId as string) ?? id,
    webViewLink: (data.webViewLink as string) ?? "",
    driveModifiedTime: (data.driveModifiedTime as string) ?? "",
    uploadedByName: (data.uploadedByName as string) ?? "Google Drive",
    source: (data.source as string) ?? "drive",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  }
}

/**
 * Realtime subscription to the mirrored document library (newest first). Every
 * logged-in member sees the same list; the server keeps it in step with the
 * shared Google Drive folder. Returns the unsubscribe function.
 */
export function subscribeToDocuments(
  onData: (documents: DocumentItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    documentsCollection,
    (snapshot) => {
      const documents = snapshot.docs
        .map((snap) => mapDocument(snap.id, snap.data()))
        .sort((a, b) => b.createdAt - a.createdAt)
      onData(documents)
    },
    (error) => onError?.(error)
  )
}

/**
 * Asks the server to re-sync from Google Drive now (the "Đồng bộ ngay" button).
 * The Firestore subscription then pushes any changes to every open client.
 */
export async function syncDocumentsFromDrive(): Promise<{
  total: number
  created: number
  updated: number
  deleted: number
}> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")

  const response = await fetch("/api/drive/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Sync failed (${response.status})`)
  }

  return response.json()
}
