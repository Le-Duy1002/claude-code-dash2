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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { syncProjectDocuments } from "../services/project-documents-service"
import {
  checkDriveFolderLink,
  ensureProjectFolder,
} from "../services/project-folder-service"
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
        <NewProjectForm
          existing={existing}
          parent={parent}
          onDone={(id) => {
            setOpen(false)
            onCreated?.(id)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

/**
 * A big project can use an existing Drive folder by pasting its link; the link
 * is checked first, so a bad one creates nothing. A sub-project's folder always
 * goes inside its parent's, so it gets no such field.
 */
function NewProjectForm({
  existing,
  parent,
  onDone,
}: {
  existing: Project[]
  parent: Project | null
  onDone: (projectId: string) => void
}) {
  const { user } = useAuth()
  const [folderLink, setFolderLink] = React.useState("")

  return (
    <ProjectForm
      submitLabel="Tạo"
      onSubmit={async (values) => {
        if (!user) throw new Error("Chưa đăng nhập")
        const link = folderLink.trim()
        const folder = link ? await checkDriveFolderLink(link) : null
        const id = await createProject(values, user.uid, existing, parent, folder)
        toast.success(
          folder
            ? `Đã tạo dự án và gắn thư mục “${folder.name}”.`
            : parent
              ? "Đã tạo dự án con."
              : "Đã tạo dự án."
        )
        onDone(id)
        // chạy ở nền — nút "Đồng bộ Drive" và "Tạo thư mục" trên trang dự án
        // là phương án dự phòng nếu bước này lỗi
        const setUp = folder ? syncProjectDocuments(id) : ensureProjectFolder(id)
        setUp.catch(() => {})
      }}
    >
      {parent ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-drive-link">
            Thư mục Drive có sẵn (không bắt buộc)
          </Label>
          <Input
            id="project-drive-link"
            value={folderLink}
            onChange={(e) => setFolderLink(e.target.value)}
            placeholder="Dán link thư mục Google Drive"
          />
          <p className="text-xs text-muted-foreground">
            Dán link thì dự án dùng luôn thư mục đó và hiện các tệp bên trong.
            Để trống thì web tạo thư mục mới.
          </p>
        </div>
      )}
    </ProjectForm>
  )
}
