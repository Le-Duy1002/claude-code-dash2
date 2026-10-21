"use client"

import * as React from "react"
import Link from "next/link"
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
  clampReportRange,
  defaultReportRange,
  reportFileName,
  reportRangeError,
  type ReportKind,
} from "../types"

/**
 * A project a report can be saved into. `parentId` names its big project
 * when that one is in the list too — the dialog then offers it under
 * "Dự án con" once the big project is picked.
 */
export type ReportTarget = { id: string; label: string; parentId: string | null }

/** "Dự án con" value meaning "save into the big project itself". */
const NO_SUB = "__none__"

const todayVn = () =>
  new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)

// the last project exported into, per browser — a convenience only
const LAST_TARGET_KEY = "report-export-target"

function lastTarget(): string | null {
  try {
    return window.localStorage.getItem(LAST_TARGET_KEY)
  } catch {
    return null
  }
}

function rememberTarget(id: string): void {
  try {
    window.localStorage.setItem(LAST_TARGET_KEY, id)
  } catch {
    // storage blocked — nothing to remember
  }
}

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
 * "Xuất báo cáo": pick a report template, a date range, then where to save —
 * a big project and, inside it, one of its sub-projects (or the big project
 * itself). The server builds the file from live data and puts it into that
 * project's Drive folder as a Google Sheet. Each open starts from
 * `initialRange` (the page's own filter, when it has one) and the project
 * last exported into.
 */
export function ExportReportDialog({
  targets,
  defaultTargetId,
  initialRange,
}: {
  targets: ReportTarget[]
  defaultTargetId?: string
  initialRange?: { from: string; to: string }
}) {
  const [open, setOpen] = React.useState(false)
  const [kind, setKind] = React.useState<ReportKind>(REPORT_KINDS[0].value)
  const [range, setRange] = React.useState(() => defaultReportRange(todayVn()))
  const [projectId, setProjectId] = React.useState("")
  const [subId, setSubId] = React.useState(NO_SUB)
  const [pending, setPending] = React.useState(false)

  const tops = targets.filter(
    (t) => !t.parentId || !targets.some((x) => x.id === t.parentId)
  )
  const top = tops.find((t) => t.id === projectId) ?? tops[0]
  const subs = top ? targets.filter((t) => t.parentId === top.id) : []
  const sub = subs.find((t) => t.id === subId) ?? null
  const target = sub ?? top
  const targetPath = sub && top ? `${top.label} › ${sub.label}` : top?.label

  /** Selects `id` — a big project, or a sub-project together with its parent. */
  function pick(id: string | null | undefined) {
    const t = targets.find((x) => x.id === id)
    if (t?.parentId && targets.some((x) => x.id === t.parentId)) {
      setProjectId(t.parentId)
      setSubId(t.id)
    } else {
      setProjectId(t?.id ?? tops[0]?.id ?? "")
      setSubId(NO_SUB)
    }
  }

  function changeProject(id: string) {
    setProjectId(id)
    setSubId(targets.find((t) => t.parentId === id)?.id ?? NO_SUB)
  }

  const rangeError = reportRangeError(range.from, range.to, todayVn())
  const kindInfo = REPORT_KINDS.find((k) => k.value === kind)!

  async function handleExport() {
    if (!target || rangeError) return
    setPending(true)
    try {
      const result = await exportReport(target.id, { kind, ...range })
      rememberTarget(target.id)
      toast.success(`Đã lưu "${result.name}" vào ${targetPath}.`, {
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
        // targets and the page's range can change after mount — pick on each open
        if (next) {
          const last = lastTarget()
          pick(
            last && targets.some((t) => t.id === last)
              ? last
              : (defaultTargetId ?? targets[0]?.id)
          )
          setRange(
            initialRange
              ? clampReportRange(initialRange.from, initialRange.to, todayVn())
              : defaultReportRange(todayVn())
          )
        }
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

          {top ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="report-project">Lưu vào dự án</Label>
                  <SimpleSelect
                    id="report-project"
                    value={top.id}
                    onChange={changeProject}
                    items={tops.map((t) => ({ value: t.id, label: t.label }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="report-sub">Dự án con</Label>
                  <SimpleSelect
                    id="report-sub"
                    value={sub?.id ?? NO_SUB}
                    onChange={setSubId}
                    items={[
                      { value: NO_SUB, label: "Không — lưu vào dự án lớn" },
                      ...subs.map((t) => ({ value: t.id, label: t.label })),
                    ]}
                  />
                </div>
              </div>
              <p className="text-sm">
                Sẽ lưu vào:{" "}
                <span className="font-medium">{targetPath}</span>
                {subs.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    (dự án này chưa có dự án con —{" "}
                    <Link
                      href={`/du-an/${top.id}`}
                      className="underline hover:text-foreground"
                    >
                      tạo dự án con
                    </Link>
                    )
                  </span>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa có dự án nào —{" "}
              <Link href="/du-an" className="underline hover:text-foreground">
                tạo dự án / dự án con
              </Link>{" "}
              trước để có chỗ lưu báo cáo.
            </p>
          )}

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
