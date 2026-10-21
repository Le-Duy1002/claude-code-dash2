"use client"

import * as React from "react"
import { FileSpreadsheetIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { exportReport } from "../services/report-service"
import {
  REPORT_KINDS,
  REPORT_MAX_DAYS,
  defaultReportRange,
  reportFileName,
  reportRangeError,
  type ReportKind,
} from "../types"

/** A project a report can be saved into. */
export type ReportTarget = { id: string; label: string }

const todayVn = () =>
  new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)

function SimpleSelect({
  id,
  value,
  onChange,
  items,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  items: { value: string; label: string }[]
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => v != null && onChange(v)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

/**
 * "Xuất báo cáo": pick a report template, a date range and the project (or
 * sub-project) to save into — the server builds the file from live data and
 * puts it into that project's Drive folder as a Google Sheet.
 */
export function ExportReportDialog({
  targets,
  defaultTargetId,
}: {
  targets: ReportTarget[]
  defaultTargetId?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [kind, setKind] = React.useState<ReportKind>(REPORT_KINDS[0].value)
  const [range, setRange] = React.useState(() => defaultReportRange(todayVn()))
  const [targetId, setTargetId] = React.useState(
    defaultTargetId ?? targets[0]?.id ?? ""
  )
  const [pending, setPending] = React.useState(false)

  const target = targets.find((t) => t.id === targetId) ?? targets[0]
  const rangeError = reportRangeError(range.from, range.to, todayVn())
  const kindInfo = REPORT_KINDS.find((k) => k.value === kind)!

  async function handleExport() {
    if (!target || rangeError) return
    setPending(true)
    try {
      const result = await exportReport(target.id, { kind, ...range })
      toast.success(`Đã lưu "${result.name}" vào ${target.label}.`, {
        description: result.warnings.length
          ? result.warnings.join(" ")
          : undefined,
        action: {
          label: "Mở file",
          onClick: () => window.open(result.webViewLink, "_blank", "noopener"),
        },
        duration: 15_000,
      })
      setOpen(false)
    } catch (error) {
      toast.error(`Không xuất được báo cáo: ${(error as Error).message}`)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        // targets can load after mount — pick the default on each open
        if (next) setTargetId(defaultTargetId ?? targets[0]?.id ?? "")
        setOpen(next)
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FileSpreadsheetIcon data-icon="inline-start" />
        Xuất báo cáo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xuất báo cáo</DialogTitle>
          <DialogDescription>
            App lấy số liệu mới nhất, tạo file Google Sheets và lưu thẳng vào
            thư mục Drive của dự án bạn chọn.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-kind">Mẫu báo cáo</Label>
            <SimpleSelect
              id="report-kind"
              value={kind}
              onChange={(v) => setKind(v as ReportKind)}
              items={REPORT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            />
            <p className="text-xs text-muted-foreground">{kindInfo.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-from">Từ ngày</Label>
              <Input
                id="report-from"
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-to">Đến ngày</Label>
              <Input
                id="report-to"
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="report-target">Lưu vào dự án</Label>
            {targets.length ? (
              <SimpleSelect
                id="report-target"
                value={target?.id ?? ""}
                onChange={setTargetId}
                items={targets.map((t) => ({ value: t.id, label: t.label }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có dự án nào.</p>
            )}
          </div>

          {rangeError ? (
            <p className="text-sm text-destructive">{rangeError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tên file: {reportFileName(kind, range.from, range.to)} · tối đa{" "}
              {REPORT_MAX_DAYS} ngày mỗi lần xuất.
              {pending ? " Đang lấy số liệu Pancake, có thể mất 1–2 phút…" : ""}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={pending}
            >
              Huỷ
            </DialogClose>
            <Button
              type="button"
              disabled={pending || Boolean(rangeError) || !target}
              onClick={handleExport}
            >
              {pending ? "Đang xuất…" : "Xuất"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
