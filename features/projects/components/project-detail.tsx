"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
  FolderSyncIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import {
  DateRangePicker,
  type RangeValue,
} from "@/features/pancake/components/date-range-picker"
import { resolveReportRange } from "@/features/pancake/types"

import { ensureProjectFolder } from "../services/project-folder-service"
import { subscribeToProject } from "../services/projects-service"
import { subscribeToProjectTasks } from "../services/project-tasks-service"
import {
  PROJECT_STAFF,
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  daysUntil,
  formatDate,
  isProjectOverdue,
  projectProgress,
  staffName,
  type Project,
  type ProjectTask,
} from "../types"
import { ProjectDocuments } from "./project-documents"
import {
  AddProjectTaskDialog,
  EditProjectTaskDialog,
} from "./project-task-dialogs"
import { ProjectTaskTable } from "./project-task-table"

const VN_OFFSET = 7 * 60 * 60 * 1000
const isoOf = (ms: number) =>
  new Date(ms + VN_OFFSET).toISOString().slice(0, 10)

const STATUS_ITEMS = [{ value: "all", label: "Mọi trạng thái" }, ...TASK_STATUS_OPTIONS]
const PRIORITY_ITEMS = [{ value: "all", label: "Mọi mức độ" }, ...TASK_PRIORITY_OPTIONS]
const ASSIGNEE_ITEMS = [
  { value: "all", label: "Mọi nhân viên" },
  ...PROJECT_STAFF.map((s) => ({ value: s.key, label: s.name })),
]

function FilterSelect({
  value,
  onChange,
  items,
  width,
}: {
  value: string
  onChange: (v: string) => void
  items: { value: string; label: string }[]
  width: string
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(v ?? "all")}>
      <SelectTrigger size="sm" className={width}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { user } = useAuth()

  const [project, setProject] = React.useState<Project | null>(null)
  const [tasks, setTasks] = React.useState<ProjectTask[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [status, setStatus] = React.useState("all")
  const [priority, setPriority] = React.useState("all")
  const [assignee, setAssignee] = React.useState("all")
  const [rangeOn, setRangeOn] = React.useState(false)
  const [range, setRange] = React.useState<RangeValue>({ range: "thisMonth" })

  const [editTask, setEditTask] = React.useState<ProjectTask | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [folderBusy, setFolderBusy] = React.useState(false)

  async function createFolder() {
    setFolderBusy(true)
    try {
      await ensureProjectFolder(projectId)
      toast.success("Đã tạo thư mục tài liệu Drive.")
    } catch (e) {
      toast.error(`Không tạo được thư mục: ${(e as Error).message}`)
    } finally {
      setFolderBusy(false)
    }
  }

  React.useEffect(() => {
    if (!user) return
    setLoading(true)
    const u1 = subscribeToProject(
      projectId,
      (p) => {
        setProject(p)
        setNotFound(p === null)
        setLoading(false)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      }
    )
    const u2 = subscribeToProjectTasks(projectId, setTasks, () => {})
    return () => {
      u1()
      u2()
    }
  }, [user, projectId])

  const visible = React.useMemo(() => {
    let out = tasks
    if (status !== "all") out = out.filter((t) => t.status === status)
    if (priority !== "all") out = out.filter((t) => t.priority === priority)
    if (assignee !== "all") out = out.filter((t) => t.assigneeKey === assignee)
    if (rangeOn) {
      const { fromMs, toMs } = resolveReportRange(range.range, range.from, range.to)
      const fromIso = isoOf(fromMs)
      const toIso = isoOf(toMs - 1)
      out = out.filter((t) => {
        const s = t.startDate || t.endDate || ""
        const e = t.endDate || t.startDate || ""
        return !s && !e ? false : s <= toIso && e >= fromIso
      })
    }
    return out
  }, [tasks, status, priority, assignee, rangeOn, range])

  function handleEdit(task: ProjectTask) {
    setEditTask(task)
    setEditOpen(true)
  }

  const progress = projectProgress(tasks)
  const overdue = project ? isProjectOverdue(project, tasks) : false

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <Link
        href="/du-an"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Tất cả dự án
      </Link>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading && !project ? (
        <Skeleton className="h-40 w-full" />
      ) : notFound ? (
        <p className="text-sm text-muted-foreground">Không tìm thấy dự án này.</p>
      ) : project ? (
        <>
          {/* header */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {project.code}
              </span>
              <h1 className="font-heading text-lg font-medium">{project.name}</h1>
              <Badge variant="outline">
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
              {overdue ? <Badge variant="destructive">Quá hạn</Badge> : null}
            </div>
            {project.description ? (
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Phụ trách:{" "}
              {project.ownerKeys.map((k) => staffName(k)).join(", ") || "—"}
              {" · "}
              {project.startDate ? formatDate(project.startDate) : "?"} –{" "}
              {project.endDate ? formatDate(project.endDate) : "?"}
              {" · "}
              {progress.total > 0
                ? `${progress.done}/${progress.total} công việc hoàn thành`
                : "chưa có công việc"}
            </p>
            {project.driveFolderId ? (
              <a
                href={project.driveFolderUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <FolderSyncIcon className="size-3.5" />
                Thư mục tài liệu trên Drive
                <ExternalLinkIcon className="size-3" />
              </a>
            ) : (
              <div className="inline-flex w-fit items-center gap-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
                <FolderSyncIcon className="size-3.5" />
                Chưa có thư mục tài liệu Drive.
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6"
                  disabled={folderBusy}
                  onClick={createFolder}
                >
                  {folderBusy ? "Đang tạo…" : "Tạo thư mục ngay"}
                </Button>
              </div>
            )}
          </div>

          {/* toolbar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                value={status}
                onChange={setStatus}
                items={STATUS_ITEMS}
                width="w-40"
              />
              <FilterSelect
                value={priority}
                onChange={setPriority}
                items={PRIORITY_ITEMS}
                width="w-36"
              />
              <FilterSelect
                value={assignee}
                onChange={setAssignee}
                items={ASSIGNEE_ITEMS}
                width="w-40"
              />
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={rangeOn}
                  onChange={(e) => setRangeOn(e.target.checked)}
                />
                Lọc thời gian
              </label>
              {rangeOn ? (
                <DateRangePicker value={range} onChange={setRange} />
              ) : null}
            </div>
            <AddProjectTaskDialog
              projectId={projectId}
              projectEndDate={project.endDate}
            />
          </div>

          <ProjectTaskTable
            tasks={visible}
            loading={loading}
            onEdit={handleEdit}
          />

          <p className="text-xs text-muted-foreground">
            {visible.length}/{tasks.length} công việc
            {(() => {
              const late = tasks.filter(
                (t) => t.status !== "done" && t.endDate && daysUntil(t.endDate) < 0
              ).length
              return late > 0 ? ` · ${late} việc quá hạn` : ""
            })()}
          </p>

          <ProjectDocuments
            projectId={projectId}
            driveFolderUrl={project.driveFolderUrl}
          />

          <EditProjectTaskDialog
            task={editTask}
            projectEndDate={project.endDate}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </>
      ) : null}
    </div>
  )
}
