"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import {
  cskhStaffName,
  dailyRevenue,
  debtByMonth,
  formatDm,
  formatDmy,
  formatMoney,
  formatMonth,
  receiptsIn,
  sumRevenue,
  type CskhPaymentKind,
  type CskhPeriod,
  type CskhReport,
  type CskhRevenue,
} from "../types"
import {
  PeriodExpandButtons,
  PeriodLabelCell,
  periodRowClass,
  usePeriodTree,
} from "./period-tree"

const KIND_TITLE: Record<CskhPaymentKind, string> = {
  chot: "Doanh thu khách chốt",
  no: "Doanh thu trả nợ",
}

/** A revenue cell; click to see the payments behind it. */
function RevenueCell({
  report,
  period,
  kind,
  value,
}: {
  report: CskhReport
  period: CskhPeriod
  kind: CskhPaymentKind
  value: number
}) {
  if (value === 0) return <span className="text-muted-foreground">0</span>
  const receipts = receiptsIn(report.customers, period.dates).filter(
    (r) => r.kind === kind
  )
  return (
    <Popover.Root>
      <Popover.Trigger className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid">
        {formatMoney(value)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="end" className="z-50">
          <Popover.Popup className="z-50 w-96 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <p className="mb-2 text-sm font-medium">
              {KIND_TITLE[kind]} · {period.label}
            </p>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
              {receipts.map((r) => (
                <div
                  key={`${r.customerId}-${r.id}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground tabular-nums">
                      {formatDm(r.date)}
                    </span>{" "}
                    {r.customerName}
                    <span className="text-muted-foreground">
                      {" "}
                      · {cskhStaffName(r.staffKey)}
                      {kind === "no" ? ` · nợ ${formatMonth(r.debtMonth)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney(r.amount)}
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

function RevenueCells({
  report,
  period,
  sums,
}: {
  report: CskhReport
  period: CskhPeriod
  sums: CskhRevenue
}) {
  return (
    <>
      <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
        <RevenueCell report={report} period={period} kind="chot" value={sums.chot} />
      </td>
      <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
        <RevenueCell report={report} period={period} kind="no" value={sums.no} />
      </td>
      <td className="bg-muted/30 px-3 py-1.5 text-right font-semibold whitespace-nowrap tabular-nums">
        {formatMoney(sums.chot + sums.no)}
      </td>
    </>
  )
}

/**
 * Thống kê doanh thu: money received, by the day it came in (month → week →
 * day), split into khách chốt trả and trả nợ. A debt is revenue of the month
 * it is paid in, whichever month it is from — the debt month is shown with
 * each payment and summed below.
 */
export function CskhRevenueSheet({ report }: { report: CskhReport }) {
  const daily = React.useMemo(
    () => dailyRevenue(report.customers, report.dates),
    [report]
  )
  const receipts = React.useMemo(
    () => receiptsIn(report.customers, report.dates),
    [report]
  )
  const debts = React.useMemo(() => debtByMonth(receipts), [receipts])
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <PeriodExpandButtons
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs">
                <th className="sticky left-0 z-10 min-w-44 bg-muted px-3 py-2 text-left font-semibold">
                  Thời gian
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Doanh thu khách chốt
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Doanh thu trả nợ
                </th>
                <th className="bg-muted px-3 py-2 text-right font-semibold">
                  Tổng doanh thu
                </th>
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
                  <RevenueCells
                    report={report}
                    period={node}
                    sums={sumRevenue(daily, node.dates)}
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
                  <RevenueCells
                    report={report}
                    period={grand}
                    sums={sumRevenue(daily, report.dates)}
                  />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Doanh thu tính vào ngày nhận tiền. Khách mua tháng A trả nợ vào tháng
          B thì khoản đó là doanh thu trả nợ của tháng B (ghi chú &quot;nợ
          tháng A&quot;). Số liệu lấy từ các lần nhận tiền nhập ở danh sách khách
          bên Thống kê chi tiết.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Trả nợ nhận trong kỳ, theo tháng nợ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có khoản trả nợ nào trong khoảng đã chọn.
            </p>
          ) : (
            <table className="w-full max-w-md border-collapse text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Nợ của tháng</th>
                  <th className="py-1.5 text-right font-medium">Số khoản</th>
                  <th className="py-1.5 text-right font-medium">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {debts.map((d) => (
                  <tr key={d.month ?? "none"} className="border-b last:border-b-0">
                    <td className="py-1.5">{formatMonth(d.month)}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.count}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMoney(d.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Các khoản nhận tiền trong kỳ ({receipts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có khoản nhận tiền nào. Nhập ở danh sách khách bên Thống kê
              chi tiết (cột Đã trả) hoặc nút &quot;Thêm khách trả nợ&quot;.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-2 py-2 text-left font-medium">Ngày nhận</th>
                    <th className="px-2 py-2 text-left font-medium">Khách</th>
                    <th className="px-2 py-2 text-left font-medium">Nhân viên</th>
                    <th className="px-2 py-2 text-left font-medium">Loại</th>
                    <th className="px-2 py-2 text-left font-medium">
                      Nợ của tháng
                    </th>
                    <th className="px-2 py-2 text-right font-medium">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr
                      key={`${r.customerId}-${r.id}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-2 py-1.5 tabular-nums">
                        {formatDmy(r.date)}
                      </td>
                      <td className="max-w-56 truncate px-2 py-1.5">
                        {r.customerName}
                      </td>
                      <td className="px-2 py-1.5">{cskhStaffName(r.staffKey)}</td>
                      <td className="px-2 py-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            r.kind === "no" &&
                              "border-amber-500/40 text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {r.kind === "no" ? "Trả nợ" : "Khách chốt trả"}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5">
                        {r.kind === "no" ? formatMonth(r.debtMonth) : ""}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatMoney(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
