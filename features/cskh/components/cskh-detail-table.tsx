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

type OpenCell = { group: string; period: CskhPeriod }

function MetricCells({
  period,
  sums,
  onOpen,
}: {
  period: CskhPeriod
  sums: Record<string, CskhMetrics>
  onOpen: (cell: OpenCell) => void
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
              i === 0 && "border-l-2",
              g.key === CSKH_TOTAL && "bg-muted/30"
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
                    "border-l-2 px-2 py-1.5 text-center font-semibold",
                    g.key === CSKH_TOTAL && "bg-muted"
                  )}
                >
                  {g.name}
                </th>
              ))}
            </tr>
            <tr className="border-b bg-muted/30">
              {CSKH_GROUPS.map((g) =>
                METRIC_COLS.map((c, i) => (
                  <th
                    key={`${g.key}-${c.key}`}
                    className={cn(
                      "px-2 py-1.5 text-right font-medium whitespace-nowrap text-muted-foreground",
                      i === 0 && "border-l-2"
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
