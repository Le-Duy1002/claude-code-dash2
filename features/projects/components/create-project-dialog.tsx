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

import { ensureProjectFolder } from "../services/project-folder-service"
import { createProject } from "../services/projects-service"
import type { Project } from "../types"
import { ProjectForm } from "./project-form"

/**
 * "Tạo dự án" — or, with `parent`, "Tạo dự án con": its code continues the
 * parent's and its Drive folder goes inside the parent's folder.
 */
export function CreateProjectDialog({
  existing,
  parent = null,
  onCreated,
}: {
  existing: Project[]
  parent?: Project | null
  onCreated?: (projectId: string) => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const title = parent ? "Tạo dự án con" : "Tạo dự án"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={parent ? "outline" : "default"} />}>
        <PlusIcon data-icon="inline-start" />
        {title}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {parent
              ? `Thuộc ${parent.code} ${parent.name}. Thư mục Drive của dự án con nằm trong thư mục của dự án lớn — báo cáo xuất vào dự án con sẽ lưu ở đó.`
              : "Mã dự án được sinh tự động. Thư mục tài liệu Drive sẽ được tạo sau."}
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          submitLabel="Tạo"
          onSubmit={async (values) => {
            if (!user) throw new Error("Chưa đăng nhập")
            const id = await createProject(values, user.uid, existing, parent)
            toast.success(parent ? "Đã tạo dự án con." : "Đã tạo dự án.")
            setOpen(false)
            onCreated?.(id)
            // tạo thư mục Drive ở nền — nút "Tạo thư mục" trên trang dự án
            // là phương án dự phòng nếu bước này lỗi
            ensureProjectFolder(id).catch(() => {})
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
