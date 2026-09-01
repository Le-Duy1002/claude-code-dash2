"use client"

import * as React from "react"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { syncDocumentsFromDrive } from "../services/documents-service"

export function SyncButton() {
  const [pending, setPending] = React.useState(false)

  async function handleSync() {
    setPending(true)
    try {
      const result = await syncDocumentsFromDrive()
      const changed = result.created + result.updated + result.deleted
      toast.success(
        changed === 0
          ? "Đã đồng bộ — không có thay đổi."
          : `Đã đồng bộ: +${result.created} mới, ${result.updated} cập nhật, ${result.deleted} gỡ.`
      )
    } catch {
      toast.error("Đồng bộ thất bại. Kiểm tra cấu hình Google Drive.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={handleSync}
    >
      <RefreshCwIcon
        data-icon="inline-start"
        className={cn(pending && "animate-spin")}
      />
      {pending ? "Đang đồng bộ..." : "Đồng bộ ngay"}
    </Button>
  )
}
