"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { updateDocument } from "../services/documents-service"
import type { DocumentItem } from "../types"

function EditForm({
  document,
  onOpenChange,
}: {
  document: DocumentItem
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = React.useState(document.name)
  const [description, setDescription] = React.useState(document.description)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const canRename = document.source === "web"

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError("Vui lòng nhập tên tài liệu.")
      return
    }
    setError(null)
    setPending(true)
    try {
      await updateDocument(document.id, { name, description })
      toast.success("Đã cập nhật tài liệu.")
      onOpenChange(false)
    } catch {
      setError("Đã có lỗi xảy ra. Vui lòng thử lại.")
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="document-name">Tên tài liệu</Label>
        <Input
          id="document-name"
          value={name}
          autoFocus
          disabled={!canRename}
          onChange={(event) => setName(event.target.value)}
        />
        {!canRename && (
          <p className="text-xs text-muted-foreground">
            Tệp này được thêm trực tiếp trên Drive — đổi tên trong Drive, chỉ sửa
            được mô tả ở đây.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="document-edit-description">Mô tả</Label>
        <Textarea
          id="document-edit-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DialogClose
          render={<Button type="button" variant="outline" />}
          disabled={pending}
        >
          Huỷ
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    </form>
  )
}

export function EditDocumentDialog({
  document,
  open,
  onOpenChange,
}: {
  document: DocumentItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa tài liệu</DialogTitle>
          <DialogDescription>
            Đổi tên đồng bộ sang Drive; mô tả chỉ lưu trên web.
          </DialogDescription>
        </DialogHeader>
        {document && (
          <EditForm
            key={document.id}
            document={document}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
