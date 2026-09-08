"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { saveManual } from "../services/payroll-service"
import {
  computeRow,
  formatHours,
  formatPct,
  formatVnd,
  payrollStaffName,
  type PayrollPeriod,
} from "../types"

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: React.ReactNode
  value: React.ReactNode
  strong?: boolean
  tone?: "bad" | "good"
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1 text-sm",
        strong && "font-medium"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-emerald-600 dark:text-emerald-400"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t pt-2">
      <p className="mb-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  )
}

export function PayslipDialog({
  period,
  staffKey,
  open,
  onOpenChange,
}: {
  period: PayrollPeriod
  staffKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const input = staffKey ? period.rows[staffKey] : undefined
  const locked = period.status === "locked"

  const [demoRevenue, setDemoRevenue] = React.useState("0")
  const [reportLate, setReportLate] = React.useState("0")
  const [fixedApproved, setFixedApproved] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!input) return
    setDemoRevenue(String(input.demoRevenue ?? 0))
    setReportLate(String(input.reportLateCount ?? 0))
    setFixedApproved(Boolean(input.fixedBonusApproved))
    setReason("")
  }, [input, open])

  if (!staffKey || !input) return null

  const draft = {
    ...input,
    demoRevenue: Number(demoRevenue) || 0,
    reportLateCount: Number(reportLate) || 0,
    fixedBonusApproved: fixedApproved,
  }
  const c = computeRow(draft, period.paramsUsed)
  const p = period.paramsUsed

  const dirty =
    draft.demoRevenue !== input.demoRevenue ||
    draft.reportLateCount !== input.reportLateCount ||
    draft.fixedBonusApproved !== input.fixedBonusApproved

  async function save() {
    setBusy(true)
    try {
      await saveManual(
        period.periodId,
        staffKey as string,
        {
          demoRevenue: draft.demoRevenue,
          reportLateCount: draft.reportLateCount,
          fixedBonusApproved: draft.fixedBonusApproved,
        },
        locked ? reason : undefined
      )
      toast.success("Đã lưu")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dRows: {
    label: string
    count: number
    each: number
    pct: number
  }[] = [
    {
      label: "Bỏ sót inbox",
      count: draft.missedCount ?? 0,
      each: p.missedInbox.each,
      pct: c.deductD.missed,
    },
    {
      label: "Nộp báo cáo trễ",
      count: draft.reportLateCount,
      each: p.lateReport.each,
      pct: c.deductD.report,
    },
    {
      label: "Đến muộn",
      count: draft.lateShiftCount,
      each: p.lateShift.each,
      pct: c.deductD.lateShift,
    },
    {
      label: "Bỏ ca 1–1,5h",
      count: draft.shortAbsenceCount,
      each: p.shortAbsence.each,
      pct: c.deductD.shortAbsence,
    },
    {
      label: "Bỏ ca ≥ 1,5h",
      count: draft.longAbsenceCount,
      each: p.longAbsence.each,
      pct: c.deductD.longAbsence,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Phiếu lương · {payrollStaffName(staffKey)}</DialogTitle>
          <DialogDescription>
            Kỳ {period.month}/{period.year} · xếp loại {input.ratingLabel}
            {period.partial ? " · bản dựng thử" : ""}
          </DialogDescription>
        </DialogHeader>

        <Section title="A · Lương giờ">
          <Line
            label="Giờ theo lịch"
            value={input.hasSchedule ? formatHours(input.expectedHours) : "—"}
          />
          <Line
            label="Giờ làm thực tế"
            value={input.hasSchedule ? formatHours(input.paidHours) : "chờ"}
            tone={input.hasSchedule ? undefined : "bad"}
          />
          <Line
            label={`Trong đó giờ cuối ca (×2 = ${formatVnd(p.lastHourRate)})`}
            value={formatHours(input.paidLastHourHours)}
          />
          <Line label="Lương giờ" value={formatVnd(c.hourPay)} strong />
        </Section>

        <Section title="B · Thưởng">
          <div className="flex items-center justify-between gap-3 py-1 text-sm">
            <span className="text-muted-foreground">Doanh thu chốt qua demo</span>
            <Input
              type="number"
              inputMode="numeric"
              className="h-7 w-36 text-right"
              value={demoRevenue}
              disabled={locked && !reason.trim()}
              onChange={(e) => setDemoRevenue(e.target.value)}
            />
          </div>
          <Line
            label={`Tỷ lệ chốt demo ${formatPct(input.demoCloseRate)} → ${c.demoBonusLabel} (${c.demoBonusPct}%)`}
            value={formatVnd(c.demoBonus)}
          />
          <div className="flex items-center justify-between gap-3 py-1 text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <Checkbox
                checked={fixedApproved}
                disabled={locked && !reason.trim()}
                onCheckedChange={(v) => setFixedApproved(Boolean(v))}
              />
              Duyệt thưởng cố định
              {input.ratingIsExcellent ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  (đủ điều kiện)
                </span>
              ) : (
                <span className="text-xs">(chưa “Xuất sắc”)</span>
              )}
            </label>
            <span className="tabular-nums">{formatVnd(c.fixedBonus)}</span>
          </div>
          <Line
            label="Tổng trước khấu trừ"
            value={formatVnd(c.grossBeforeDeduction)}
            strong
          />
        </Section>

        <Section title="C · Trừ hệ số — lỗi tần suất cao">
          <Line
            label={`Phản hồi đúng hạn ${formatPct(input.replyOnTimeRate)}`}
            value={`− ${c.deductReplyPct}%`}
            tone={c.deductReplyPct > 0 ? "bad" : undefined}
          />
          <Line
            label={`Gán tag đúng & đủ ${formatPct(input.tagRate)}`}
            value={`− ${c.deductTagPct}%`}
            tone={c.deductTagPct > 0 ? "bad" : undefined}
          />
        </Section>

        <Section title="D · Lỗi rời rạc — phạt tiền + trừ hệ số">
          {dRows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 py-1 text-sm"
            >
              <span className="text-muted-foreground">
                {r.label}
                {r.label === "Nộp báo cáo trễ" ? (
                  <Input
                    type="number"
                    inputMode="numeric"
                    className="ml-2 inline-block h-6 w-14 text-right"
                    value={reportLate}
                    disabled={locked && !reason.trim()}
                    onChange={(e) => setReportLate(e.target.value)}
                  />
                ) : (
                  <span className="ml-2 tabular-nums">× {r.count}</span>
                )}
              </span>
              <span className="tabular-nums">
                {r.count > 0 ? (
                  <>
                    <span className="text-destructive">{formatVnd(r.count * r.each)}</span>
                    {r.pct > 0 ? (
                      <span className="text-destructive"> · −{r.pct}%</span>
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
          ))}
        </Section>

        <Section title="E · Thực lĩnh">
          <Line
            label={`Tổng % trừ hệ số (trần ${formatPct(p.deductionCapPct)})`}
            value={
              c.totalDeductPctRaw > c.totalDeductPct
                ? `${formatPct(c.totalDeductPctRaw)} → ${formatPct(c.totalDeductPct)}`
                : formatPct(c.totalDeductPct)
            }
            tone={c.totalDeductPct > 0 ? "bad" : undefined}
          />
          <Line label="Hệ số lương còn lại" value={formatPct(c.coefficientPct)} />
          <Line
            label="Lương sau hệ số"
            value={formatVnd(
              Math.round((c.grossBeforeDeduction * c.coefficientPct) / 100)
            )}
          />
          <Line
            label="Trừ tiền phạt (mục D)"
            value={c.penalty.total > 0 ? `− ${formatVnd(c.penalty.total)}` : "—"}
            tone={c.penalty.total > 0 ? "bad" : undefined}
          />
          <Line
            label="TỔNG LƯƠNG THỰC LĨNH"
            value={formatVnd(c.netPay)}
            strong
          />
        </Section>

        {c.pending.length > 0 ? (
          <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            Chưa tính: {c.pending.join("; ")}.
          </p>
        ) : null}

        {locked ? (
          <Textarea
            rows={2}
            placeholder="Lý do điều chỉnh (bắt buộc khi bảng đã chốt)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            disabled={busy || !dirty || (locked && !reason.trim())}
            onClick={save}
          >
            {busy ? "Đang lưu…" : "Lưu khoản thủ công"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
