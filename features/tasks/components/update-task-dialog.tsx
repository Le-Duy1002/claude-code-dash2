"use client"

import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { updateTask } from "../services/tasks-service"
import type { Task } from "../types"
import { TaskForm } from "./task-form"

export function UpdateTaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cập nhật công việc</DialogTitle>
          <DialogDescription>
            Chỉnh sửa thông tin công việc rồi bấm &ldquo;Lưu&rdquo;.
          </DialogDescription>
        </DialogHeader>
        {task && (
          <TaskForm
            key={task.id}
            defaultValues={{
              title: task.title,
              name: task.name,
              startDate: task.startDate,
              endDate: task.endDate,
              status: task.status,
              priority: task.priority,
            }}
            submitLabel="Lưu"
            onSubmit={async (values) => {
              await updateTask(task.id, values)
              toast.success("Đã cập nhật công việc.")
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
