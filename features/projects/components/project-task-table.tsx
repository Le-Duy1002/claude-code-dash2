"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  MessageSquareIcon,
  PencilIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
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

import { deleteProjectTask, updateProjectTask } from "../services/project-tasks-service"
import {
  PROJECT_STAFF,
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
  staffName,
  type ProjectTask,
  type RemainingTone,
  type TaskPriority,
  type TaskStatus,
} from "../types"

const ASSIGNEE_ITEMS = PROJECT_STAFF.map((s) => ({ value: s.key, label: s.name }))

function StatusCell({ task }: { task: ProjectTask }) {
  async function change(value: string | null) {
    if (!value || value === task.status) return
    try {
      await updateProjectTask(task.id, { status: value as TaskStatus })
    } catch (e) {
      toast.error(`Lỗi đổi trạng thái: ${(e as Error).message}`)
    }
  }
  return (
    <Select items={TASK_STATUS_OPTIONS} value={task.status} onValueChange={change}>
      <SelectTrigger
        className={cn(
          "h-6 w-fit gap-1 rounded-4xl border px-2 py-0 text-xs font-medium [&_svg]:size-3",
          TASK_STATUS_BADGE[task.status]
        )}
      >
        {TASK_STATUS_LABELS[task.status]}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {TASK_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function PriorityCell({ task }: { task: ProjectTask }) {
  async function change(value: string | null) {
    if (!value || value === task.priority) return
    try {
      await updateProjectTask(task.id, { priority: value as TaskPriority })
    } catch (e) {
      toast.error(`Lỗi đổi ưu tiên: ${(e as Error).message}`)
    }
  }
  return (
    <Select items={TASK_PRIORITY_OPTIONS} value={task.priority} onValueChange={change}>
      <SelectTrigger className="h-auto w-fit gap-1 border-0 bg-transparent p-0 shadow-none hover:opacity-80 [&_svg]:hidden">
        <Badge variant={TASK_PRIORITY_BADGE[task.priority]}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {TASK_PRIORITY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function AssigneeCell({ task }: { task: ProjectTask }) {
  async function change(value: string | null) {
    if (!value || value === task.assigneeKey) return
    try {
      await updateProjectTask(task.id, { assigneeKey: value })
    } catch (e) {
      toast.error(`Lỗi đổi người đảm nhiệm: ${(e as Error).message}`)
    }
  }
  return (
    <Select items={ASSIGNEE_ITEMS} value={task.assigneeKey} onValueChange={change}>
      <SelectTrigger className="h-7 w-fit gap-1 border-0 bg-transparent px-1.5 py-0.5 text-sm shadow-none hover:bg-muted [&_svg]:size-3.5">
        {staffName(task.assigneeKey)}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {ASSIGNEE_ITEMS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function DateCell({
  value,
  onSave,
}: {
  value: string
  onSave: (next: string) => Promise<void>
}) {
  const [editing, setEditing] = React.useState(false)

  async function save(next: string) {
    setEditing(false)
    if (!next || next === value) return
    try {
      await onSave(next)
    } catch (e) {
      toast.error(`Lỗi đổi ngày: ${(e as Error).message}`)
    }
  }

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={value}
        onBlur={(e) => void save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false)
          if (e.key === "Enter") void save((e.target as HTMLInputElement).value)
        }}
        className="h-7 rounded-md border border-input bg-transparent px-1.5 text-sm text-foreground outline-none focus-visible:border-ring"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="-mx-1.5 rounded-md px-1.5 py-0.5 whitespace-nowrap hover:bg-muted"
      title="Bấm để đổi ngày"
    >
      {formatDate(value)}
    </button>
  )
}

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
                  <TableCell>
                    <AssigneeCell task={task} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <DateCell
                      value={task.startDate}
                      onSave={(v) => updateProjectTask(task.id, { startDate: v })}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <DateCell
                      value={task.endDate}
                      onSave={(v) => updateProjectTask(task.id, { endDate: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusCell task={task} />
                  </TableCell>
                  <TableCell>
                    <PriorityCell task={task} />
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
