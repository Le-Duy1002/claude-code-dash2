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

import type { Task, TaskInput, TaskPriority, TaskStatus } from "../types"

const tasksCollection = collection(db, "tasks")

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

function mapTask(id: string, data: Record<string, unknown>): Task {
  return {
    id,
    title: (data.title as string) ?? "",
    name: (data.name as string) ?? "",
    startDate: (data.startDate as string) ?? "",
    endDate: (data.endDate as string) ?? "",
    status: (data.status as TaskStatus) ?? "todo",
    priority: (data.priority as TaskPriority) ?? "medium",
    ownerUid: (data.ownerUid as string) ?? "",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  }
}

/**
 * Subscribes to every task owned by `ownerUid`, newest first. Sorting is done
 * client-side so the query stays a single-field filter and needs no composite
 * Firestore index. Returns the unsubscribe function.
 */
export function subscribeToTasks(
  ownerUid: string,
  onData: (tasks: Task[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const tasksQuery = query(tasksCollection, where("ownerUid", "==", ownerUid))

  return onSnapshot(
    tasksQuery,
    (snapshot) => {
      const tasks = snapshot.docs
        .map((snap) => mapTask(snap.id, snap.data()))
        .sort((a, b) => b.createdAt - a.createdAt)
      onData(tasks)
    },
    (error) => onError?.(error)
  )
}

export async function createTask(
  ownerUid: string,
  input: TaskInput
): Promise<void> {
  await addDoc(tasksCollection, {
    ...input,
    ownerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateTask(
  taskId: string,
  input: Partial<TaskInput>
): Promise<void> {
  await updateDoc(doc(db, "tasks", taskId), {
    ...input,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(db, "tasks", taskId))
}
