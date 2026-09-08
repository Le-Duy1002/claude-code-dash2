"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { PencilIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { setProjectTaskStatus } from "../services/project-tasks-service"
import {
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  describeRemaining,
  staffName,
  type ProjectTask,
  type TaskStatus,
} from "../types"

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"]

const TONE_CLASS = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-destructive",
  warning: "text-amber-600 dark:text-amber-500",
  muted: "text-muted-foreground",
} as const

function Card({
  task,
  onEdit,
  overlay = false,
}: {
  task: ProjectTask
  onEdit?: (task: ProjectTask) => void
  overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id })
  const remaining = describeRemaining(task)

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={
        overlay
          ? undefined
          : { transform: CSS.Translate.toString(transform) }
      }
      className={cn(
        "rounded-md border bg-card p-2.5 text-sm shadow-xs",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-2 shadow-lg"
      )}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="font-medium">{task.title}</p>
        {onEdit ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(task)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <PencilIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">{staffName(task.assigneeKey)}</span>
        <Badge variant={TASK_PRIORITY_BADGE[task.priority]}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
        {task.status !== "done" && task.endDate ? (
          <span className={cn("tabular-nums", TONE_CLASS[remaining.tone])}>
            {remaining.label}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Column({
  status,
  tasks,
  onEdit,
}: {
  status: TaskStatus
  tasks: ProjectTask[]
  onEdit: (task: ProjectTask) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[15rem] flex-1 flex-col gap-2 rounded-lg border bg-muted/30 p-2 transition-colors",
        isOver && "border-primary bg-primary/5"
      )}
    >
      <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {TASK_STATUS_LABELS[status]} · {tasks.length}
      </p>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <Card key={task.id} task={task} onEdit={onEdit} />
        ))}
        {tasks.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">
            Kéo thẻ vào đây
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function ProjectKanban({
  tasks,
  onEdit,
}: {
  tasks: ProjectTask[]
  onEdit: (task: ProjectTask) => void
}) {
  const [pending, setPending] = React.useState<Record<string, TaskStatus>>({})
  const [dragId, setDragId] = React.useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // clear an optimistic status once the real data catches up
  React.useEffect(() => {
    setPending((prev) => {
      const next: Record<string, TaskStatus> = {}
      let changed = false
      for (const [id, status] of Object.entries(prev)) {
        const real = tasks.find((t) => t.id === id)
        if (real && real.status === status) changed = true
        else next[id] = status
      }
      return changed ? next : prev
    })
  }, [tasks])

  const statusOf = (t: ProjectTask): TaskStatus => pending[t.id] ?? t.status

  const byColumn = React.useMemo(() => {
    const map: Record<TaskStatus, ProjectTask[]> = {
      todo: [],
      in_progress: [],
      done: [],
    }
    for (const t of tasks) map[statusOf(t)].push(t)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, pending])

  const dragTask = dragId ? tasks.find((t) => t.id === dragId) : null

  function handleStart(event: DragStartEvent) {
    setDragId(String(event.active.id))
  }

  async function handleEnd(event: DragEndEvent) {
    setDragId(null)
    const taskId = String(event.active.id)
    const target = event.over?.id as TaskStatus | undefined
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !target || !COLUMNS.includes(target)) return
    if (statusOf(task) === target) return

    setPending((p) => ({ ...p, [taskId]: target }))
    try {
      await setProjectTaskStatus(taskId, target)
    } catch (e) {
      setPending((p) => {
        const n = { ...p }
        delete n[taskId]
        return n
      })
      toast.error(`Không cập nhật được trạng thái: ${(e as Error).message}`)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setDragId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-1">
        {COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={byColumn[status]}
            onEdit={onEdit}
          />
        ))}
      </div>
      <DragOverlay>
        {dragTask ? <Card task={dragTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
