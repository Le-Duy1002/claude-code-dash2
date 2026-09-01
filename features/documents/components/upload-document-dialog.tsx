"use client"

import * as React from "react"
import { UploadIcon } from "lucide-react"
import { toast } from "sonner"

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
import { Textarea } from "@/components/ui/textarea"

import { MAX_UPLOAD_BYTES, uploadDocument } from "../services/documents-service"
import { formatFileSize } from "../types"

export function UploadDocumentDialog({
  onUploaded,
}: {
  onUploaded?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [description, setDescription] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fileInputKey, setFileInputKey] = React.useState(0)

  function reset() {
    setFile(null)
    setDescription("")
    setError(null)
    setFileInputKey((key) => key + 1)
  }

  function handleOpenChange(next: boolean) {
    if (pending) return
    setOpen(next)
    if (!next) reset()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!file) {
      setError("Vui lòng chọn tệp.")
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `Tệp vượt quá ${formatFileSize(MAX_UPLOAD_BYTES)} — hãy tải trực tiếp lên thư mục Drive.`
      )
      return
    }

    setError(null)
    setPending(true)
    try {
      await uploadDocument(file, description)
      toast.success("Đã tải tài liệu lên Drive.")
      setOpen(false)
      reset()
      onUploaded?.()
    } catch (err) {
      setError(
        (err as { code?: string }).code === "drive_upload_failed"
          ? "Không tải lên Drive được. Kiểm tra cấu hình OAuth."
          : "Tải lên thất bại. Vui lòng thử lại."
      )
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <UploadIcon data-icon="inline-start" />
        Đính kèm tài liệu
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Đính kèm tài liệu</DialogTitle>
          <DialogDescription>
            Tệp được tải lên thư mục Google Drive chung và hiển thị cho mọi thành
            viên.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="document-file">Tệp</Label>
            <Input
              key={fileInputKey}
              id="document-file"
              type="file"
              disabled={pending}
              className="h-auto py-1.5 file:mr-3 file:cursor-pointer"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setError(null)
              }}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatFileSize(file.size)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="document-description">Mô tả (tuỳ chọn)</Label>
            <Textarea
              id="document-description"
              rows={2}
              value={description}
              disabled={pending}
              placeholder="Nội dung, phiên bản, ghi chú..."
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={pending || !file}>
              {pending ? "Đang tải lên..." : "Tải lên"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
