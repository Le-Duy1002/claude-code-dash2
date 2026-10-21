"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { checkProjectDrive } from "../services/project-folder-service"
import type { ProjectDriveCheck } from "../types"

/**
 * "Kiểm tra Drive": runs the server check on open — the write account, the
 * folder still existing, a test write, and the mirror being able to read —
 * and offers the automatic fix (new folder / share) when one applies.
 */
export function DriveCheckDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = React.useState(false)
  const [result, setResult] = React.useState<ProjectDriveCheck | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const run = React.useCallback(
    async (repair: boolean) => {
      setPending(true)
      setError(null)
      try {
        setResult(await checkProjectDrive(projectId, repair))
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setPending(false)
      }
    },
    [projectId]
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setResult(null)
          void run(false)
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <ShieldCheckIcon data-icon="inline-start" />
        Kiểm tra Drive
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kiểm tra thư mục Drive</DialogTitle>
          <DialogDescription>
            Thử ghi một tệp vào thư mục của dự án rồi xoá đi, để chắc báo cáo
            xuất ra sẽ lưu được vào đây.
          </DialogDescription>
        </DialogHeader>

        {pending && !result ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Đang kiểm tra…
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {result ? (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {result.checks.map((check) => (
                <li key={check.key} className="flex items-start gap-2 text-sm">
                  {check.ok ? (
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0">
                    <span className="font-medium">{check.label}</span>
                    <span
                      className={cn(
                        "block break-words text-xs",
                        check.ok ? "text-muted-foreground" : "text-destructive"
                      )}
                    >
                      {check.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <p
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                result.ok
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              )}
            >
              {result.ok
                ? "Kết nối Drive ổn — báo cáo xuất ra sẽ lưu vào thư mục này."
                : result.repairable
                  ? "Có lỗi app tự sửa được: bấm “Sửa tự động”."
                  : "Có lỗi cần xử lý ở phía Google (xem chi tiết ở trên)."}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {result.folderUrl ? (
                <a
                  href={result.folderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mr-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLinkIcon className="size-3.5" />
                  Mở thư mục Drive
                </a>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(false)}
              >
                Kiểm tra lại
              </Button>
              {result.repairable ? (
                <Button size="sm" disabled={pending} onClick={() => run(true)}>
                  {pending ? "Đang sửa…" : "Sửa tự động"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
