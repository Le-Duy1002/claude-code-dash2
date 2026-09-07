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

import { createProject } from "../services/projects-service"
import type { Project } from "../types"
import { ProjectForm } from "./project-form"

export function CreateProjectDialog({
  existing,
  onCreated,
}: {
  existing: Project[]
  onCreated?: (projectId: string) => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon data-icon="inline-start" />
        Tạo dự án
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo dự án</DialogTitle>
          <DialogDescription>
            Mã dự án được sinh tự động. Thư mục tài liệu Drive sẽ được tạo sau.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          submitLabel="Tạo"
          onSubmit={async (values) => {
            if (!user) throw new Error("Chưa đăng nhập")
            const id = await createProject(values, user.uid, existing)
            toast.success("Đã tạo dự án.")
            setOpen(false)
            onCreated?.(id)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
