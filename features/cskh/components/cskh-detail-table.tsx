"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  CSKH_GROUPS,
  CSKH_TOTAL,
  aov,
  buildPeriodTree,
  closeRate,
  cskhStaffName,
  dailyMetrics,
  formatDm,
  formatMoney,
  formatPct,
  paymentsIn,
  sumMetrics,
  type CskhMetrics,
  type CskhPeriod,
  type CskhReport,
} from "../types"

const METRIC_COLS: { key: string; label: string }[] = [
  { key: "viewed", label: "Khách xem" },
  { key: "closed", label: "Khách chốt" },
  { key: "price", label: "Giá bản luận" },
  { key: "paid", label: "Đã trả" },
  { key: "aov", label: "AOV" },
  { key: "rate", label: "Tỉ lệ chốt" },
]

function flatten(
  nodes: CskhPeriod[],
  expanded: Set<string>,
  depth = 0
): { node: CskhPeriod; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(expanded.has(node.id) ? flatten(node.children, expanded, depth + 1) : []),
  ])
}

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
                  key={`${p.id}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground tabular-nums">
                      {formatDm(p.date)}
                    </span>{" "}
                    {p.customerName}
                    {group === CSKH_TOTAL ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {cskhStaffName(p.staffKey)}
                      </span>
                    ) : null}
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
          m.tracked ? m.closed : "—",
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
  const tree = React.useMemo(() => buildPeriodTree(report.dates), [report.dates])
  const daily = React.useMemo(() => dailyMetrics(report), [report])

  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(tree.map((m) => m.id))
  )
  React.useEffect(() => {
    setExpanded(new Set(tree.map((m) => m.id)))
  }, [tree])

  const allIds = React.useMemo(
    () => tree.flatMap((m) => [m.id, ...m.children.map((w) => w.id)]),
    [tree]
  )
  const rows = flatten(tree, expanded)
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const grand: CskhPeriod = {
    id: "all",
    level: "month",
    label: "Tổng cả kỳ",
    dates: report.dates,
    children: [],
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setExpanded(new Set(allIds))}
        >
          Mở hết từng ngày
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(new Set())}
        >
          Thu gọn theo tháng
        </Button>
      </div>

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
            {rows.map(({ node, depth }) => {
              const sums = sumMetrics(daily, node.dates)
              const canExpand = node.children.length > 0
              return (
                <tr
                  key={node.id}
                  className={cn(
                    "border-b last:border-b-0 hover:bg-muted/40",
                    node.level === "month" && "bg-muted/20 font-semibold",
                    node.level === "week" && "font-medium"
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 px-2 py-1.5 whitespace-nowrap",
                      node.level === "month" ? "bg-muted" : "bg-card"
                    )}
                  >
                    <button
                      type="button"
                      disabled={!canExpand}
                      onClick={() => toggle(node.id)}
                      className="flex items-center gap-1 text-left disabled:cursor-default"
                      style={{ paddingLeft: depth * 16 }}
                    >
                      {canExpand ? (
                        <ChevronRightIcon
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground transition-transform",
                            expanded.has(node.id) && "rotate-90"
                          )}
                        />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      {node.label}
                    </button>
                  </td>
                  <MetricCells report={report} period={node} sums={sums} />
                </tr>
              )
            })}
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
