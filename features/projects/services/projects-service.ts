import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"

import {
  nextProjectCode,
  type Project,
  type ProjectInput,
  type ProjectStatus,
} from "../types"

const projectsCollection = collection(db, "projects")

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

function mapProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    code: (data.code as string) ?? "",
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    startDate: (data.startDate as string) ?? "",
    endDate: (data.endDate as string) ?? "",
    ownerKeys: Array.isArray(data.ownerKeys)
      ? (data.ownerKeys as string[])
      : [],
    status: (data.status as ProjectStatus) ?? "active",
    driveFolderId: (data.driveFolderId as string) ?? null,
    driveFolderUrl: (data.driveFolderUrl as string) ?? null,
    driveFolderPending: Boolean(data.driveFolderPending),
    createdByUid: (data.createdByUid as string) ?? "",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  }
}

/** Mọi dự án, mới nhất trước (sắp xếp client-side, không cần index). */
export function subscribeToProjects(
  onData: (projects: Project[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    projectsCollection,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapProject(d.id, d.data()))
        .sort((a, b) => b.createdAt - a.createdAt)
      onData(rows)
    },
    (error) => onError?.(error)
  )
}

export function subscribeToProject(
  projectId: string,
  onData: (project: Project | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "projects", projectId),
    (snap) => onData(snap.exists() ? mapProject(snap.id, snap.data()) : null),
    (error) => onError?.(error)
  )
}

/**
 * Tạo dự án. `existing` dùng để sinh mã kế tiếp. Thư mục tài liệu Drive để
 * `driveFolderPending = true` — đợt tài liệu sẽ khởi tạo và gỡ cờ này.
 */
export async function createProject(
  input: ProjectInput,
  createdByUid: string,
  existing: Project[]
): Promise<string> {
  const ref = await addDoc(projectsCollection, {
    name: input.name.trim(),
    description: input.description.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    ownerKeys: input.ownerKeys,
    code: nextProjectCode(existing),
    status: "active" satisfies ProjectStatus,
    driveFolderId: null,
    driveFolderPending: true,
    createdByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateProject(
  projectId: string,
  input: Partial<ProjectInput> & { status?: ProjectStatus }
): Promise<void> {
  await updateDoc(doc(db, "projects", projectId), {
    ...input,
    updatedAt: serverTimestamp(),
  })
}
