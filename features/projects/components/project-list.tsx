"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangleIcon, FolderKanbanIcon } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import {
  DateRangePicker,
  type RangeValue,
} from "@/features/pancake/components/date-range-picker"
import { resolveReportRange } from "@/features/pancake/types"

import { subscribeToProjects } from "../services/projects-service"
import { subscribeToAllProjectTasks } from "../services/project-tasks-service"
import {
  PROJECT_STATUS_LABELS,
  formatDate,
  isProjectOverdue,
  projectInRange,
  projectProgress,
  staffName,
  type Project,
  type ProjectTask,
} from "../types"
import { CreateProjectDialog } from "./create-project-dialog"

const VN_OFFSET = 7 * 60 * 60 * 1000
const isoOf = (ms: number) =>
  new Date(ms + VN_OFFSET).toISOString().slice(0, 10)

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  active: "secondary",
  done: "default",
  archived: "outline",
}

export function ProjectList() {
  const { user } = useAuth()
  const router = useRouter()

  const [projects, setProjects] = React.useState<Project[]>([])
  const [tasks, setTasks] = React.useState<ProjectTask[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [rangeOn, setRangeOn] = React.useState(false)
  const [range, setRange] = React.useState<RangeValue>({ range: "thisMonth" })

  React.useEffect(() => {
    if (!user) return
    setLoading(true)
    const u1 = subscribeToProjects(
      (rows) => {
        setProjects(rows)
        setLoading(false)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      }
    )
    const u2 = subscribeToAllProjectTasks(setTasks, () => {})
    return () => {
      u1()
      u2()
    }
  }, [user])

  const tasksByProject = React.useMemo(() => {
    const map = new Map<string, ProjectTask[]>()
    for (const t of tasks) {
      const list = map.get(t.projectId) ?? []
      list.push(t)
      map.set(t.projectId, list)
    }
    return map
  }, [tasks])

  const visible = React.useMemo(() => {
    if (!rangeOn) return projects
    const { fromMs, toMs } = resolveReportRange(
      range.range,
      range.from,
      range.to
    )
    const fromIso = isoOf(fromMs)
    const toIso = isoOf(toMs - 1)
    return projects.filter((p) => projectInRange(p, fromIso, toIso))
  }, [projects, rangeOn, range])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Dự án</h1>
          <p className="text-sm text-muted-foreground">
            Mỗi dự án gom công việc và tài liệu của một mục tiêu. Bấm vào dự án
            để xem bảng công việc.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Checkbox
              checked={rangeOn}
              onCheckedChange={(c) => setRangeOn(c === true)}
            />
            Lọc theo thời gian
          </label>
          {rangeOn ? (
            <DateRangePicker value={range} onChange={setRange} />
          ) : null}
          <CreateProjectDialog
            existing={projects}
            onCreated={(id) => router.push(`/du-an/${id}`)}
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <FolderKanbanIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {projects.length === 0
              ? "Chưa có dự án nào."
              : "Không có dự án nào trong khoảng thời gian đã chọn."}
          </p>
          {projects.length === 0 ? (
            <CreateProjectDialog existing={projects} />
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => {
            const pt = tasksByProject.get(project.id) ?? []
            const { done, total } = projectProgress(pt)
            const overdue = isProjectOverdue(project, pt)
            return (
              <Link
                key={project.id}
                href={`/du-an/${project.id}`}
                className="flex flex-col gap-2 rounded-lg border bg-card p-3.5 transition-colors hover:border-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {project.code}
                    </p>
                    <p className="font-medium">{project.name}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[project.status] ?? "outline"}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  {project.ownerKeys.map((k) => staffName(k)).join(", ") || "—"}
                </p>

                <div className="mt-auto flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {total > 0
                      ? `${done}/${total} công việc hoàn thành`
                      : "Chưa có công việc"}
                  </span>
                  {project.endDate ? (
                    <span
                      className={cn(
                        "tabular-nums",
                        overdue
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {overdue ? "Quá hạn · " : "Hạn "}
                      {formatDate(project.endDate)}
                    </span>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
