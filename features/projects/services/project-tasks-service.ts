import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"

import {
  type ProjectTask,
  type ProjectTaskInput,
  type TaskPriority,
  type TaskStatus,
} from "../types"

const tasksCollection = collection(db, "projectTasks")

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

function mapTask(id: string, data: Record<string, unknown>): ProjectTask {
  return {
    id,
    projectId: (data.projectId as string) ?? "",
    title: (data.title as string) ?? "",
    assigneeKey: (data.assigneeKey as string) ?? "",
    status: (data.status as TaskStatus) ?? "todo",
    priority: (data.priority as TaskPriority) ?? "medium",
    startDate: (data.startDate as string) ?? "",
    endDate: (data.endDate as string) ?? "",
    createdByUid: (data.createdByUid as string) ?? "",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  }
}

/** Công việc của một dự án (lọc single-field, sắp xếp client-side). */
export function subscribeToProjectTasks(
  projectId: string,
  onData: (tasks: ProjectTask[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(tasksCollection, where("projectId", "==", projectId))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapTask(d.id, d.data()))
        .sort((a, b) => b.createdAt - a.createdAt)
      onData(rows)
    },
    (error) => onError?.(error)
  )
}

/** Toàn bộ công việc dự án — dùng cho danh sách dự án tính tiến độ. */
export function subscribeToAllProjectTasks(
  onData: (tasks: ProjectTask[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    tasksCollection,
    (snap) => onData(snap.docs.map((d) => mapTask(d.id, d.data()))),
    (error) => onError?.(error)
  )
}

export async function createProjectTask(
  projectId: string,
  input: ProjectTaskInput,
  createdByUid: string
): Promise<void> {
  await addDoc(tasksCollection, {
    ...input,
    title: input.title.trim(),
    projectId,
    createdByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateProjectTask(
  taskId: string,
  input: Partial<ProjectTaskInput>
): Promise<void> {
  await updateDoc(doc(db, "projectTasks", taskId), {
    ...input,
    updatedAt: serverTimestamp(),
  })
}

/** Đổi mỗi trạng thái — dùng cho kéo-thả Kanban. */
export async function setProjectTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<void> {
  await updateDoc(doc(db, "projectTasks", taskId), {
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteProjectTask(taskId: string): Promise<void> {
  await deleteDoc(doc(db, "projectTasks", taskId))
}
