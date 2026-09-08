import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import type { User } from "firebase/auth"

import { db } from "@/lib/firebase"
import type { TaskComment } from "@/features/tasks/types"

function commentsCollection(taskId: string) {
  return collection(db, "projectTasks", taskId, "comments")
}

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

/** Comments on a project task, oldest first (sorted client-side). */
export function subscribeToProjectTaskComments(
  taskId: string,
  onData: (comments: TaskComment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    commentsCollection(taskId),
    (snapshot) => {
      const comments = snapshot.docs
        .map((snap) => {
          const data = snap.data()
          return {
            id: snap.id,
            content: (data.content as string) ?? "",
            parentId: (data.parentId as string | null) ?? null,
            createdByUid: (data.createdByUid as string) ?? "",
            createdByName: (data.createdByName as string) ?? "Người dùng",
            createdAt: toMillis(data.createdAt),
          } satisfies TaskComment
        })
        .sort((a, b) => a.createdAt - b.createdAt)
      onData(comments)
    },
    (error) => onError?.(error)
  )
}

export async function addProjectTaskComment(
  taskId: string,
  params: { content: string; parentId: string | null; user: User }
): Promise<void> {
  const { content, parentId, user } = params
  await addDoc(commentsCollection(taskId), {
    content: content.trim(),
    parentId,
    createdByUid: user.uid,
    createdByName: user.displayName || user.email || "Người dùng",
    createdAt: serverTimestamp(),
  })
}

/** Delete a comment plus every reply beneath it (ids from the caller). */
export async function deleteProjectTaskCommentThread(
  taskId: string,
  commentIds: string[]
): Promise<void> {
  const batch = writeBatch(db)
  for (const commentId of commentIds) {
    batch.delete(doc(db, "projectTasks", taskId, "comments", commentId))
  }
  await batch.commit()
}
