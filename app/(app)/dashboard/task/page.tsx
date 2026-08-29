"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import {
  AddTaskDialog,
  DEFAULT_TASK_FILTERS,
  TaskCommentsDialog,
  TaskFilterBar,
  TasksTable,
  UpdateTaskDialog,
  subscribeToTasks,
  type Task,
  type TaskFilters,
} from "@/features/tasks"

function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  const search = filters.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (
      search &&
      !task.title.toLowerCase().includes(search) &&
      !task.name.toLowerCase().includes(search)
    ) {
      return false
    }
    if (filters.status !== "all" && task.status !== filters.status) return false
    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false
    }
    return true
  })
}

export default function TaskPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filters, setFilters] = React.useState<TaskFilters>(DEFAULT_TASK_FILTERS)

  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  const [commentsTaskId, setCommentsTaskId] = React.useState<string | null>(null)
  const [commentsOpen, setCommentsOpen] = React.useState(false)

  React.useEffect(() => {
    if (!user) return
    setLoading(true)
    const unsubscribe = subscribeToTasks(
      user.uid,
      (next) => {
        setTasks(next)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsubscribe
  }, [user])

  const visibleTasks = React.useMemo(
    () => applyFilters(tasks, filters),
    [tasks, filters]
  )

  function handleEdit(task: Task) {
    setEditingTask(task)
    setEditOpen(true)
  }

  function handleOpenComments(task: Task) {
    setCommentsTaskId(task.id)
    setCommentsOpen(true)
  }

  const commentsTask =
    tasks.find((task) => task.id === commentsTaskId) ?? null

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Công việc</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý công việc, thời hạn và mức độ ưu tiên.
          </p>
        </div>
        <AddTaskDialog />
      </div>

      <TaskFilterBar filters={filters} onChange={setFilters} />

      <TasksTable
        tasks={visibleTasks}
        loading={loading}
        onEdit={handleEdit}
        onOpenComments={handleOpenComments}
      />

      <UpdateTaskDialog
        task={editingTask}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <TaskCommentsDialog
        task={commentsTask}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
    </div>
  )
}
