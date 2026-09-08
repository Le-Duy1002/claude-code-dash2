/**
 * Dự án & công việc trong dự án. Không React, không Firebase.
 *
 * Tái dùng nhãn trạng thái / độ ưu tiên và các helper thời hạn của
 * `features/tasks`; roster nhân viên lấy từ `features/pancake/staff`.
 */

import { STAFF } from "@/features/pancake/staff"
import {
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_OPTIONS,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABELS,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_ORDER,
  daysUntil,
  describeRemaining,
  formatDate,
  type RemainingTone,
  type TaskPriority,
  type TaskStatus,
} from "@/features/tasks/types"

export {
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_OPTIONS,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABELS,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_ORDER,
  daysUntil,
  describeRemaining,
  formatDate,
}
export type { RemainingTone, TaskPriority, TaskStatus }

// ------------------------------------------------------------ roster

export const PROJECT_STAFF: { key: string; name: string }[] = STAFF.map((s) => ({
  key: s.key,
  name: s.name,
}))

const STAFF_NAME = new Map(PROJECT_STAFF.map((s) => [s.key, s.name]))

export function staffName(key: string | null | undefined): string {
  return (key && STAFF_NAME.get(key)) || "—"
}

// ------------------------------------------------------------ project

export type ProjectStatus = "active" | "done" | "archived"

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Đang chạy",
  done: "Hoàn thành",
  archived: "Lưu trữ",
}

export interface Project {
  id: string
  /** mã tự sinh, VD "PRJ-2026-007" */
  code: string
  name: string
  description: string
  startDate: string
  endDate: string
  /** roster key của người phụ trách (1 hoặc nhiều) */
  ownerKeys: string[]
  status: ProjectStatus
  /** id thư mục Drive của dự án; null khi chưa tạo được */
  driveFolderId: string | null
  /** link mở thư mục Drive của dự án */
  driveFolderUrl: string | null
  driveFolderPending: boolean
  createdByUid: string
  createdAt: number
  updatedAt: number
}

export type ProjectInput = Pick<
  Project,
  "name" | "description" | "startDate" | "endDate" | "ownerKeys"
>

/**
 * Mã dự án kế tiếp: `PRJ-<năm>-<số thứ tự trong năm>`. Số thứ tự tính từ số dự
 * án đã tạo trong năm (phía client — chấp nhận hiếm khi trùng cho đội nhỏ).
 */
export function nextProjectCode(existing: Project[], now = new Date()): string {
  const year = now.getFullYear()
  const count = existing.filter((p) => {
    const created = p.createdAt ? new Date(p.createdAt) : now
    return created.getFullYear() === year
  }).length
  return `PRJ-${year}-${String(count + 1).padStart(3, "0")}`
}

// ------------------------------------------------------------ project task

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  /** roster key của nhân viên đảm nhiệm */
  assigneeKey: string
  status: TaskStatus
  priority: TaskPriority
  startDate: string
  endDate: string
  createdByUid: string
  createdAt: number
  updatedAt: number
}

export type ProjectTaskInput = Pick<
  ProjectTask,
  "title" | "assigneeKey" | "status" | "priority" | "startDate" | "endDate"
>

// ------------------------------------------------------------ derived

export function projectProgress(tasks: ProjectTask[]): {
  done: number
  total: number
} {
  return {
    done: tasks.filter((t) => t.status === "done").length,
    total: tasks.length,
  }
}

/** Quá hạn = còn "Đang chạy", ngày kết thúc đã qua và còn công việc chưa xong. */
export function isProjectOverdue(
  project: Project,
  tasks: ProjectTask[]
): boolean {
  if (project.status !== "active" || !project.endDate) return false
  const hasOpen = tasks.some((t) => t.status !== "done")
  return daysUntil(project.endDate) < 0 && hasOpen
}

/** `[start,end]` của dự án có giao với `[fromIso,toIso]` không (bao trùm). */
export function projectInRange(
  project: Project,
  fromIso: string,
  toIso: string
): boolean {
  const s = project.startDate || project.endDate || ""
  const e = project.endDate || project.startDate || ""
  if (!s && !e) return true
  return s <= toIso && e >= fromIso
}
