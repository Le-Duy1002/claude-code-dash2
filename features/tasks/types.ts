export type TaskStatus = "todo" | "in_progress" | "done"

export type TaskPriority = "low" | "medium" | "high"

/**
 * A task as stored in Firestore, plus its document id.
 * `startDate` / `endDate` are ISO calendar dates (`yyyy-mm-dd`) so they can be
 * bound directly to `<input type="date">` and compared lexicographically.
 */
export interface Task {
  id: string
  title: string
  name: string
  startDate: string
  endDate: string
  status: TaskStatus
  priority: TaskPriority
  ownerUid: string
  createdAt: number
  updatedAt: number
}

/**
 * A comment on a task, stored in the `tasks/{taskId}/comments` subcollection.
 * `parentId` is `null` for a top-level comment and the id of the comment being
 * replied to otherwise, so every reply knows which thread it belongs to.
 */
export interface TaskComment {
  id: string
  content: string
  parentId: string | null
  createdByUid: string
  createdByName: string
  createdAt: number
}

/** A comment plus its nested replies and its depth in the thread. */
export interface TaskCommentNode extends TaskComment {
  depth: number
  replies: TaskCommentNode[]
}

/**
 * Turns the flat, oldest-first comment list into a parent/child tree. A comment
 * whose parent is missing (e.g. the parent was deleted) is kept as a top-level
 * node so nothing disappears silently.
 */
export function buildCommentTree(comments: TaskComment[]): TaskCommentNode[] {
  const byId = new Map<string, TaskCommentNode>()
  for (const comment of comments) {
    byId.set(comment.id, { ...comment, depth: 0, replies: [] })
  }

  const roots: TaskCommentNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent) {
      node.depth = parent.depth + 1
      parent.replies.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

/** `1000` -> `"14:05 · 09/06/2026"` for comment timestamps. */
export function formatDateTime(ms: number): string {
  if (!ms) return "Vừa xong"
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(ms))
}

/** The editable fields of a task, shared by the add and update forms. */
export type TaskInput = Pick<
  Task,
  "title" | "name" | "startDate" | "endDate" | "status" | "priority"
>

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  done: "Hoàn thành",
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
}

export const TASK_STATUS_OPTIONS = (
  Object.keys(TASK_STATUS_LABELS) as TaskStatus[]
).map((value) => ({ value, label: TASK_STATUS_LABELS[value] }))

export const TASK_PRIORITY_OPTIONS = (
  Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]
).map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] }))

/** Badge styling per status / priority, keyed to the shared `Badge` variants. */
export const TASK_STATUS_BADGE: Record<
  TaskStatus,
  "default" | "secondary" | "outline"
> = {
  todo: "outline",
  in_progress: "secondary",
  done: "default",
}

export const TASK_PRIORITY_BADGE: Record<
  TaskPriority,
  "destructive" | "secondary" | "outline"
> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
}

/** Logical sort order for status and priority columns. */
export const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
}

export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Whole days from today until `endDate`. Negative once the deadline has passed,
 * `0` when it is today.
 */
export function daysUntil(endDate: string): number {
  if (!endDate) return 0
  const end = new Date(`${endDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / MS_PER_DAY)
}

export type RemainingTone = "positive" | "negative" | "warning" | "muted"

/**
 * The "Còn lại" (time remaining) cell: a label plus a tone the table maps to a
 * colour. Deadlines in the future are green, past deadlines red, today amber.
 */
export function describeRemaining(
  task: Pick<Task, "endDate" | "status">
): { label: string; tone: RemainingTone } {
  if (!task.endDate) return { label: "—", tone: "muted" }
  if (task.status === "done") return { label: "Đã hoàn thành", tone: "positive" }

  const days = daysUntil(task.endDate)
  if (days > 0) return { label: `Còn ${days} ngày`, tone: "positive" }
  if (days < 0) return { label: `Quá hạn ${Math.abs(days)} ngày`, tone: "negative" }
  return { label: "Hết hạn hôm nay", tone: "warning" }
}

/** `yyyy-mm-dd` -> `dd/mm/yyyy` for display. */
export function formatDate(date: string): string {
  if (!date) return "—"
  const [year, month, day] = date.split("-")
  return `${day}/${month}/${year}`
}
