"use client"

import * as React from "react"
import { HistoryIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import {
  SCHEDULE_CHANGE_LABELS,
  SCHEDULE_STAFF,
  formatDateTime,
  staffName,
  weekLabel,
  type ScheduleChange,
} from "../types"

const STAFF_FILTER = [
  { value: "all", label: "Mọi nhân viên" },
  ...SCHEDULE_STAFF.map((s) => ({ value: s.key, label: s.name })),
]
const SCOPE_FILTER = [
  { value: "all", label: "Tất cả thay đổi" },
  { value: "afterlock", label: "Chỉ sau khi chốt" },
]

export function ChangeHistoryDialog({
  changes,
  monthLabel,
}: {
  changes: ScheduleChange[]
  monthLabel: string
}) {
  const [open, setOpen] = React.useState(false)
  const [staff, setStaff] = React.useState("all")
  const [scope, setScope] = React.useState("all")

  const rows = React.useMemo(
    () =>
      changes.filter((c) => {
        if (staff !== "all" && c.staffKey !== staff) return false
        if (scope === "afterlock" && !c.afterLock) return false
        return true
      }),
    [changes, staff, scope]
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <HistoryIcon data-icon="inline-start" />
        Lịch sử chỉnh lịch
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lịch sử chỉnh lịch — {monthLabel}</DialogTitle>
          <DialogDescription>
            Mọi lần đăng ký, đổi ca, chốt và điều chỉnh sau chốt của tháng này.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Select items={STAFF_FILTER} value={staff} onValueChange={(v) => setStaff(v ?? "all")}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {STAFF_FILTER.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select items={SCOPE_FILTER} value={scope} onValueChange={(v) => setScope(v ?? "all")}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SCOPE_FILTER.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-lg border">
          {rows.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Không có thay đổi nào khớp bộ lọc.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {rows.map((c) => (
                <li key={c.id} className="flex flex-col gap-0.5 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {formatDateTime(c.atMs)}
                    </span>
                    <Badge
                      variant={c.kind === "lock" ? "default" : "outline"}
                      className={cn(
                        c.kind === "unlock" && "text-destructive"
                      )}
                    >
                      {SCHEDULE_CHANGE_LABELS[c.kind]}
                    </Badge>
                    {c.afterLock ? (
                      <Badge variant="destructive">sau chốt</Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {weekLabel(c.weekId)}
                    </span>
                  </div>
                  <p>{c.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    Bởi {c.byName}
                    {c.staffKey ? ` · liên quan ${staffName(c.staffKey)}` : ""}
                    {c.reason ? ` · lý do: ${c.reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
