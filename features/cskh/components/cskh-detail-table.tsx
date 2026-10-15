"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

import {
  CSKH_GROUPS,
  CSKH_TOTAL,
  aov,
  closeRate,
  cskhStaffName,
  dailyMetrics,
  formatDm,
  formatMoney,
  formatMonth,
  formatPct,
  paymentsIn,
  sumMetrics,
  type CskhMetrics,
  type CskhPeriod,
  type CskhReport,
} from "../types"
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

function PaidCell({
  report,
  period,
  group,
  value,
}: {
  report: CskhReport
  period: CskhPeriod
  group: string
  value: number
}) {
  if (value === 0) return <span className="text-muted-foreground">0</span>
  const payments = paymentsIn(report.customers, period.dates, group)
  const groupName = CSKH_GROUPS.find((g) => g.key === group)?.name ?? ""
  return (
    <Popover.Root>
      <Popover.Trigger className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid">
        {formatMoney(value)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="end" className="z-50">
          <Popover.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <p className="mb-2 text-sm font-medium">
              Đã trả · {groupName} · {period.label}
            </p>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground tabular-nums">
                      {formatDm(p.date)}
                    </span>{" "}
                    {p.customerName}
                    <span className="text-muted-foreground">
                      {group === CSKH_TOTAL
                        ? ` · ${cskhStaffName(p.staffKey)}`
                        : ""}
                      {p.kind === "no" ? ` · trả nợ ${formatMonth(p.debtMonth)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney(p.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 text-sm font-medium">
              <span>Tổng</span>
              <span className="tabular-nums">{formatMoney(value)}</span>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function MetricCells({
  report,
  period,
  sums,
}: {
  report: CskhReport
  period: CskhPeriod
  sums: Record<string, CskhMetrics>
}) {
  return (
    <>
      {CSKH_GROUPS.map((g) => {
        const m = sums[g.key]
        const cells: React.ReactNode[] = [
          m.viewed,
          m.closedKnown ? m.closed : "—",
          m.tracked ? formatMoney(m.price) : "—",
          <PaidCell
            key="paid"
            report={report}
            period={period}
            group={g.key}
            value={m.paid}
          />,
          formatMoney(aov(m)),
          formatPct(closeRate(m)),
        ]
        return cells.map((cell, i) => (
          <td
            key={`${g.key}-${i}`}
            className={cn(
              "px-2 py-1.5 text-right whitespace-nowrap tabular-nums",
              i === 0 && "border-l-2",
              g.key === CSKH_TOTAL && "bg-muted/30"
            )}
          >
            {cell}
          </td>
        ))
      })}
    </>
  )
}

/**
 * Thống kê chi tiết: one row per month, week and day over the selected range
 * (months sum their weeks, weeks their days), with the six metrics for the
 * total and for each staff side by side.
 */
export function CskhDetailTable({ report }: { report: CskhReport }) {
  const daily = React.useMemo(() => dailyMetrics(report), [report])
  const { tree, rows, expanded, toggle, expandAll, collapseAll } =
    usePeriodTree(report.dates)

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
                  report={report}
                  period={node}
                  sums={sumMetrics(daily, node.dates)}
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
                  report={report}
                  period={grand}
                  sums={sumMetrics(daily, report.dates)}
                />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}
