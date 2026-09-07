"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import {
  createProjectTask,
  updateProjectTask,
} from "../services/project-tasks-service"
import type { ProjectTask, ProjectTaskInput } from "../types"
import { ProjectTaskForm } from "./project-task-form"

export function AddProjectTaskDialog({
  projectId,
  projectEndDate,
}: {
  projectId: string
  projectEndDate?: string
}) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon data-icon="inline-start" />
        Thêm công việc
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm công việc</DialogTitle>
          <DialogDescription>Công việc thuộc dự án này.</DialogDescription>
        </DialogHeader>
        <ProjectTaskForm
          submitLabel="Thêm"
          projectEndDate={projectEndDate}
          onSubmit={async (values) => {
            if (!user) throw new Error("Chưa đăng nhập")
            await createProjectTask(projectId, values, user.uid)
            toast.success("Đã thêm công việc.")
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

export function EditProjectTaskDialog({
  task,
  projectEndDate,
  open,
  onOpenChange,
}: {
  task: ProjectTask | null
  projectEndDate?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa công việc</DialogTitle>
          <DialogDescription>Cập nhật thông tin công việc.</DialogDescription>
        </DialogHeader>
        {task ? (
          <ProjectTaskForm
            submitLabel="Lưu"
            projectEndDate={projectEndDate}
            defaultValues={
              {
                title: task.title,
                assigneeKey: task.assigneeKey,
                status: task.status,
                priority: task.priority,
                startDate: task.startDate,
                endDate: task.endDate,
              } satisfies ProjectTaskInput
            }
            onSubmit={async (values) => {
              await updateProjectTask(task.id, values)
              toast.success("Đã lưu.")
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
