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

import { createTask } from "../services/tasks-service"
import { TaskForm } from "./task-form"

export function AddTaskDialog() {
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
          <DialogDescription>
            Nhập thông tin công việc mới. Bấm &ldquo;Thêm&rdquo; để lưu.
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          submitLabel="Thêm"
          onSubmit={async (values) => {
            if (!user) throw new Error("Chưa đăng nhập")
            await createTask(user.uid, values)
            toast.success("Đã thêm công việc.")
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
