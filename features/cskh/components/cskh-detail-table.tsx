"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import {
  CSKH_GROUPS,
  CSKH_TOTAL,
  aov,
  closeRate,
  dailyMetrics,
  formatMoney,
  formatPct,
  sumMetrics,
  type CskhCustomer,
  type CskhMetrics,
  type CskhPeriod,
  type CskhReport,
} from "../types"
import { CskhCustomerTable } from "./cskh-customer-list"
import {
  PeriodExpandButtons,
  PeriodLabelCell,
  periodRowClass,
  usePeriodTree,
} from "./period-tree"

const METRIC_COLS: { key: string; label: string }[] = [
  { key: "viewed", label: "Khách xem" },
  { key: "closed", label: "Khách chốt" },
  { key: "price", label: "Giá bản luận" },
  { key: "paid", label: "Đã trả" },
  { key: "aov", label: "AOV" },
  { key: "rate", label: "Tỉ lệ chốt" },
]

/** column index → opens that group's customers for the row's period */
const OPENS_CUSTOMERS = new Set([1, 2, 3])

/**
 * A soft tint per column group so each person's six columns read as one
 * block. Duy and Thương match their colours on the Lịch làm grid.
 */
type GroupTone = {
  /** group name header */
  head: string
  /** metric-name header */
  sub: string
  /** body cells */
  cell: string
  /** the thick divider on the group's left edge */
  edge: string
}

const GROUP_TONES: Record<string, GroupTone> = {
  [CSKH_TOTAL]: {
    head: "bg-muted text-foreground",
    sub: "bg-muted/70",
    cell: "bg-muted/40",
    edge: "border-l-foreground/25",
  },
  duy: {
    head: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
    sub: "bg-sky-50 dark:bg-sky-500/10",
    cell: "bg-sky-50/60 dark:bg-sky-500/5",
    edge: "border-l-sky-400/70 dark:border-l-sky-400/50",
  },
  ky: {
    head: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
    sub: "bg-emerald-50 dark:bg-emerald-500/10",
    cell: "bg-emerald-50/60 dark:bg-emerald-500/5",
    edge: "border-l-emerald-400/70 dark:border-l-emerald-400/50",
  },
  thang: {
    head: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
    sub: "bg-amber-50 dark:bg-amber-500/10",
    cell: "bg-amber-50/60 dark:bg-amber-500/5",
    edge: "border-l-amber-400/70 dark:border-l-amber-400/50",
  },
  thuong: {
    head: "bg-pink-100 text-pink-900 dark:bg-pink-500/20 dark:text-pink-200",
    sub: "bg-pink-50 dark:bg-pink-500/10",
    cell: "bg-pink-50/60 dark:bg-pink-500/5",
    edge: "border-l-pink-400/70 dark:border-l-pink-400/50",
  },
}

function toneOf(group: string): GroupTone {
  return GROUP_TONES[group] ?? GROUP_TONES[CSKH_TOTAL]
}

/** thin divider between metric columns, thick tinted one at a group's edge */
function dividerClass(group: string, index: number): string {
  return index === 0
    ? cn("border-l-2", toneOf(group).edge)
    : "border-l border-l-border/70"
}

type OpenCell = { group: string; period: CskhPeriod }

function MetricCells({
  period,
  sums,
  onOpen,
  strong,
}: {
  period: CskhPeriod
  sums: Record<string, CskhMetrics>
  onOpen: (cell: OpenCell) => void
  /** a month / grand-total row — a little more tint */
  strong?: boolean
}) {
  return (
    <>
      {CSKH_GROUPS.map((g) => {
        const m = sums[g.key]
        const cells: React.ReactNode[] = [
          m.viewed,
          m.closedKnown ? m.closed : "—",
          m.tracked ? formatMoney(m.price) : "—",
          formatMoney(m.paid),
          formatMoney(aov(m)),
          formatPct(closeRate(m)),
        ]
        // the customer list exists from tracking on, and for any payment
        const clickable = m.tracked || m.paid > 0
        return cells.map((cell, i) => (
          <td
            key={`${g.key}-${i}`}
            className={cn(
              "px-2 py-1.5 text-right whitespace-nowrap tabular-nums",
              dividerClass(g.key, i),
              strong ? toneOf(g.key).sub : toneOf(g.key).cell
            )}
          >
            {clickable && OPENS_CUSTOMERS.has(i) ? (
              <button
                type="button"
                onClick={() => onOpen({ group: g.key, period })}
                title="Bấm để xem / nhập khách chốt, giá bản luận, tiền đã trả"
                className="rounded px-1 underline decoration-dotted underline-offset-2 hover:bg-muted hover:decoration-solid"
              >
                {cell}
              </button>
            ) : (
              cell
            )}
          </td>
        ))
      })}
    </>
  )
}

/** One staff's (or everyone's) customers for one period, editable. */
function PeriodCustomersDialog({
  report,
  cell,
  onClose,
  onCustomerChange,
}: {
  report: CskhReport
  cell: OpenCell | null
  onClose: () => void
  onCustomerChange: (next: CskhCustomer) => void
}) {
  const customers = React.useMemo(() => {
    if (!cell) return []
    const dates = new Set(cell.period.dates)
    return report.customers.filter(
      (c) =>
        (cell.group === CSKH_TOTAL || c.staffKey === cell.group) &&
        (dates.has(c.closedDate) || c.payments.some((p) => dates.has(p.date)))
    )
  }, [report.customers, cell])
  const groupName = CSKH_GROUPS.find((g) => g.key === cell?.group)?.name ?? ""

  return (
    <Dialog open={cell != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {groupName} · {cell?.period.label}
          </DialogTitle>
          <DialogDescription>
            Khách chốt và khách trả tiền trong khoảng này. Nhập giá bản luận ở
            ô giá; bấm ô Đã trả để thêm lần nhận tiền (chọn ngày nhận, khách
            chốt trả hay trả nợ). Bảng tự cộng lại.
          </DialogDescription>
        </DialogHeader>
        {customers.length ? (
          <CskhCustomerTable
            customers={customers}
            onChange={onCustomerChange}
          />
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Không có khách chốt hay khoản trả tiền nào trong khoảng này.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Thống kê chi tiết: one row per month, week and day over the selected range
 * (months sum their weeks, weeks their days), with the six metrics for the
 * total and for each staff side by side. Khách chốt / giá / đã trả cells open
 * that staff's customers for the row's period to enter prices and payments.
 */
export function CskhDetailTable({
  report,
  onCustomerChange,
}: {
  report: CskhReport
  onCustomerChange: (next: CskhCustomer) => void
}) {
  const daily = React.useMemo(() => dailyMetrics(report), [report])
  const { tree, rows, expanded, toggle, expandAll, collapseAll } =
    usePeriodTree(report.dates)
  const [openCell, setOpenCell] = React.useState<OpenCell | null>(null)

  const grand: CskhPeriod = {
    id: "all",
    level: "month",
    label: "Tổng cả kỳ",
    dates: report.dates,
    children: [],
  }

  return (
    <div className="flex flex-col gap-2">
      <PeriodExpandButtons
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th
                rowSpan={2}
                className="sticky left-0 z-10 min-w-44 bg-muted px-3 py-2 text-left font-semibold"
              >
                Thời gian
              </th>
              {CSKH_GROUPS.map((g) => (
                <th
                  key={g.key}
                  colSpan={METRIC_COLS.length}
                  className={cn(
                    "px-2 py-1.5 text-center text-sm font-semibold",
                    dividerClass(g.key, 0),
                    toneOf(g.key).head
                  )}
                >
                  {g.name}
                </th>
              ))}
            </tr>
            <tr className="border-b">
              {CSKH_GROUPS.map((g) =>
                METRIC_COLS.map((c, i) => (
                  <th
                    key={`${g.key}-${c.key}`}
                    className={cn(
                      "px-2 py-1.5 text-right font-medium whitespace-nowrap text-muted-foreground",
                      dividerClass(g.key, i),
                      toneOf(g.key).sub
                    )}
                  >
                    {c.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ node, depth }) => (
              <tr key={node.id} className={periodRowClass(node)}>
                <PeriodLabelCell
                  node={node}
                  depth={depth}
                  expanded={expanded.has(node.id)}
                  onToggle={() => toggle(node.id)}
                />
                <MetricCells
                  period={node}
                  sums={sumMetrics(daily, node.dates)}
                  onOpen={setOpenCell}
                  strong={node.level === "month"}
                />
              </tr>
            ))}
          </tbody>
          {tree.length > 1 ? (
            <tfoot>
              <tr className="border-t-2 bg-muted/50 font-semibold">
                <td className="sticky left-0 z-10 bg-muted px-3 py-1.5">
                  Tổng cả kỳ
                </td>
                <MetricCells
                  period={grand}
                  sums={sumMetrics(daily, report.dates)}
                  onOpen={setOpenCell}
                  strong
                />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <PeriodCustomersDialog
        report={report}
        cell={openCell}
        onClose={() => setOpenCell(null)}
        onCustomerChange={onCustomerChange}
      />
    </div>
  )
}
