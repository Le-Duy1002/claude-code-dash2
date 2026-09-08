"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  MessageSquareIcon,
  PencilIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { DeleteTaskDialog } from "@/features/tasks"

import { deleteProjectTask } from "../services/project-tasks-service"
import {
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  daysUntil,
  describeRemaining,
  formatDate,
  staffName,
  type ProjectTask,
  type RemainingTone,
} from "../types"

type SortKey =
  | "title"
  | "assignee"
  | "startDate"
  | "endDate"
  | "status"
  | "priority"
  | "remaining"
type SortState = { key: SortKey; dir: "asc" | "desc" }

const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  title: "asc",
  assignee: "asc",
  startDate: "asc",
  endDate: "asc",
  status: "asc",
  priority: "desc",
  remaining: "asc",
}

function compare(a: ProjectTask, b: ProjectTask, key: SortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title, "vi")
    case "assignee":
      return staffName(a.assigneeKey).localeCompare(staffName(b.assigneeKey), "vi")
    case "startDate":
      return a.startDate.localeCompare(b.startDate)
    case "endDate":
      return a.endDate.localeCompare(b.endDate)
    case "status":
      return TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]
    case "priority":
      return TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority]
    case "remaining":
      return daysUntil(a.endDate) - daysUntil(b.endDate)
    default:
      return 0
  }
}

const TONE_CLASS: Record<RemainingTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-destructive",
  warning: "text-amber-600 dark:text-amber-500",
  muted: "text-muted-foreground",
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string
  sortKey: SortKey
  sort: SortState | null
  onSort: (key: SortKey) => void
}) {
  const active = sort?.key === sortKey
  const Icon = !active
    ? ChevronsUpDownIcon
    : sort.dir === "asc"
      ? ChevronUpIcon
      : ChevronDownIcon
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-mx-2 inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      >
        {label}
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            active ? "text-foreground" : "text-muted-foreground/50"
          )}
        />
      </button>
    </TableHead>
  )
}

export function ProjectTaskTable({
  tasks,
  loading,
  onEdit,
  onOpenComments,
}: {
  tasks: ProjectTask[]
  loading: boolean
  onEdit: (task: ProjectTask) => void
  onOpenComments: (task: ProjectTask) => void
}) {
  const [sort, setSort] = React.useState<SortState | null>(null)

  function handleSort(key: SortKey) {
    setSort((cur) =>
      cur?.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: DEFAULT_DIR[key] }
    )
  }

  const rows = React.useMemo(() => {
    if (!sort) return tasks
    const sorted = [...tasks]
    sorted.sort((a, b) => {
      const r = compare(a, b, sort.key)
      return sort.dir === "asc" ? r : -r
    })
    return sorted
  }, [tasks, sort])

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[820px]">
        <TableHeader className="bg-muted">
          <TableRow>
            <SortableHead label="Công việc" sortKey="title" sort={sort} onSort={handleSort} />
            <SortableHead label="Người đảm nhiệm" sortKey="assignee" sort={sort} onSort={handleSort} />
            <SortableHead label="Bắt đầu" sortKey="startDate" sort={sort} onSort={handleSort} />
            <SortableHead label="Kết thúc" sortKey="endDate" sort={sort} onSort={handleSort} />
            <SortableHead label="Trạng thái" sortKey="status" sort={sort} onSort={handleSort} />
            <SortableHead label="Ưu tiên" sortKey="priority" sort={sort} onSort={handleSort} />
            <SortableHead label="Còn lại" sortKey="remaining" sort={sort} onSort={handleSort} />
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                Đang tải...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                Không có công việc khớp bộ lọc.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((task) => {
              const remaining = describeRemaining(task)
              return (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>{staffName(task.assigneeKey)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(task.startDate)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(task.endDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TASK_STATUS_BADGE[task.status]}>
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TASK_PRIORITY_BADGE[task.priority]}>
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-medium whitespace-nowrap",
                      TONE_CLASS[remaining.tone]
                    )}
                  >
                    {remaining.label}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => onOpenComments(task)}
                      >
                        <MessageSquareIcon />
                        <span className="sr-only">Bình luận</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => onEdit(task)}
                      >
                        <PencilIcon />
                        <span className="sr-only">Sửa công việc</span>
                      </Button>
                      <DeleteTaskDialog
                        taskName={task.title}
                        onConfirm={() => deleteProjectTask(task.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
