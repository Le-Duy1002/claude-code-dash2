"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import {
  addMonths,
  averageDebtLag,
  cskhStaffName,
  dailyRevenue,
  DEBT_LAG_CAP,
  debtLag,
  debtLagLabel,
  debtMonthTable,
  defaultDebtMonth,
  formatDm,
  formatDmy,
  formatLagMonths,
  formatMoney,
  formatMonth,
  outstanding,
  receiptsIn,
  sumRevenue,
  type CskhPaymentKind,
  type CskhPeriod,
  type CskhReceipt,
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

/** One line of a money popover: who / when, and how much. */
type MoneyLine = { key: string; lead?: string; name: string; meta: string; amount: number }

/** An amount; click to see the lines behind it. Zero shows as `empty`. */
function MoneyPopover({
  title,
  value,
  lines,
  empty = "0",
}: {
  title: string
  value: number
  lines: MoneyLine[]
  empty?: string
}) {
  if (value === 0) return <span className="text-muted-foreground">{empty}</span>
  return (
    <Popover.Root>
      <Popover.Trigger className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid">
        {formatMoney(value)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="end" className="z-50">
          <Popover.Popup className="z-50 w-96 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <p className="mb-2 text-sm font-medium">{title}</p>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">
                    {line.lead ? (
                      <span className="text-muted-foreground tabular-nums">
                        {line.lead}{" "}
                      </span>
                    ) : null}
                    {line.name}
                    <span className="text-muted-foreground"> · {line.meta}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney(line.amount)}
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

function receiptLines(receipts: CskhReceipt[]): MoneyLine[] {
  return receipts.map((r) => ({
    key: `${r.customerId}-${r.id}`,
    lead: formatDm(r.date),
    name: r.customerName,
    meta: `${cskhStaffName(r.staffKey)}${
      r.kind === "no" ? ` · nợ ${formatMonth(r.debtMonth)}` : ""
    }`,
    amount: r.amount,
  }))
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
  const receipts =
    value === 0
      ? []
      : receiptsIn(report.customers, period.dates).filter((r) => r.kind === kind)
  return (
    <MoneyPopover
      title={`${KIND_TITLE[kind]} · ${period.label}`}
      value={value}
      lines={receiptLines(receipts)}
    />
  )
}

/** An amount with a small note under it (the month it came in, or a share). */
function LagCell({
  note,
  children,
}: {
  note?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-end leading-tight">
      {children}
      {note ? (
        <span className="text-[11px] font-normal text-muted-foreground">
          {note}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Nợ theo tháng: a row per debt month, a column per "thu về sau mấy tháng"
 * (each cell notes the month the money came in), then the total collected,
 * the average lag and what is still owed. Every amount opens the payments
 * (or the customers still owing) behind it.
 */
function DebtMonthTable({
  report,
  receipts,
}: {
  report: CskhReport
  receipts: CskhReceipt[]
}) {
  const { lags, rows } = React.useMemo(
    () => debtMonthTable(report.customers, report.dates),
    [report]
  )
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Không có khoản nợ nào — chưa thu nợ trong khoảng đã chọn và không ai
        còn nợ.
      </p>
    )
  }

  const debtReceipts = receipts.filter((r) => r.kind === "no")
  const paidLines = (debtMonth: string | null | undefined, lag?: number) =>
    receiptLines(
      debtReceipts.filter(
        (r) =>
          (debtMonth === undefined || r.debtMonth === debtMonth) &&
          (lag === undefined || debtLag(r) === lag)
      )
    )
  const owingLines = (debtMonth: string | null | undefined): MoneyLine[] =>
    report.customers
      .filter(
        (c) =>
          (outstanding(c) ?? 0) > 0 &&
          (debtMonth === undefined || defaultDebtMonth(c) === debtMonth)
      )
      .map((c) => ({
        key: c.id,
        name: c.customerName,
        meta: `${cskhStaffName(c.staffKey)} · ${
          c.legacy ? "khách cũ" : `chốt ${formatDm(c.closedDate)}`
        }`,
        amount: outstanding(c) ?? 0,
      }))

  const total = {
    byLag: lags.map((lag) =>
      rows.reduce((s, row) => s + (row.paidByLag[lag] ?? 0), 0)
    ),
    paid: rows.reduce((s, row) => s + row.paid, 0),
    count: rows.reduce((s, row) => s + row.count, 0),
    owing: rows.reduce((s, row) => s + row.owing, 0),
  }
  const share = (value: number) =>
    value && total.paid
      ? `${Math.round((value / total.paid) * 100)}%`
      : undefined
  const cell = "px-3 py-1.5 text-right whitespace-nowrap tabular-nums"
  const head = "px-3 py-2 text-right font-semibold"

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs">
            <th
              rowSpan={2}
              className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold"
            >
              Nợ của tháng
            </th>
            <th
              colSpan={lags.length}
              className="border-x px-3 py-1.5 text-center font-semibold"
            >
              Đã thu về sau mấy tháng
            </th>
            <th rowSpan={2} className={cn(head, "bg-muted")}>
              Tổng đã thu
            </th>
            <th rowSpan={2} className={head}>
              Bình quân thu sau
            </th>
            <th rowSpan={2} className={head}>
              Số khoản
            </th>
            <th rowSpan={2} className={head}>
              Còn nợ (hiện tại)
            </th>
          </tr>
          <tr className="border-b bg-muted/50 text-xs">
            {lags.map((lag) => (
              <th key={lag} className={cn(head, "font-medium last:border-r")}>
                {debtLagLabel(lag)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const label = `Nợ ${formatMonth(row.month)}`
            return (
              <tr key={row.month ?? "none"} className="border-b last:border-b-0">
                <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium">
                  {label}
                </td>
                {lags.map((lag) => {
                  const value = row.paidByLag[lag] ?? 0
                  // the month it came in is fixed by the row and the column,
                  // except for the last "N+ tháng" column
                  const paidIn =
                    row.month && lag < DEBT_LAG_CAP
                      ? formatMonth(addMonths(row.month, lag))
                      : null
                  return (
                    <td key={lag} className={cell}>
                      <LagCell
                        note={value && paidIn ? `thu ${paidIn}` : undefined}
                      >
                        <MoneyPopover
                          title={`${label} · thu ${debtLagLabel(
                            lag
                          ).toLowerCase()}${paidIn ? ` (${paidIn})` : ""}`}
                          value={value}
                          lines={paidLines(row.month, lag)}
                          empty="—"
                        />
                      </LagCell>
                    </td>
                  )
                })}
                <td className={cn(cell, "bg-muted/30 font-semibold")}>
                  <MoneyPopover
                    title={`${label} · đã thu trong kỳ`}
                    value={row.paid}
                    lines={paidLines(row.month)}
                    empty="—"
                  />
                </td>
                <td className={cell}>
                  {formatLagMonths(row.month ? averageDebtLag([row]) : null)}
                </td>
                <td className={cell}>{row.count || "—"}</td>
                <td className={cn(cell, row.owing > 0 && "text-destructive")}>
                  <MoneyPopover
                    title={`${label} · còn nợ`}
                    value={row.owing}
                    lines={owingLines(row.month)}
                    empty="—"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
        {rows.length > 1 ? (
          <tfoot>
            <tr className="border-t-2 bg-muted/50 font-semibold">
              <td className="sticky left-0 z-10 bg-muted px-3 py-1.5">Tổng</td>
              {lags.map((lag, i) => (
                <td key={lag} className={cell}>
                  <LagCell note={share(total.byLag[i])}>
                    <MoneyPopover
                      title={`Thu nợ ${debtLagLabel(lag).toLowerCase()}`}
                      value={total.byLag[i]}
                      lines={paidLines(undefined, lag)}
                      empty="—"
                    />
                  </LagCell>
                </td>
              ))}
              <td className={cn(cell, "bg-muted")}>
                <MoneyPopover
                  title="Đã thu nợ trong kỳ"
                  value={total.paid}
                  lines={paidLines(undefined)}
                  empty="—"
                />
              </td>
              <td className={cell}>{formatLagMonths(averageDebtLag(rows))}</td>
              <td className={cell}>{total.count || "—"}</td>
              <td className={cn(cell, total.owing > 0 && "text-destructive")}>
                <MoneyPopover
                  title="Còn nợ"
                  value={total.owing}
                  lines={owingLines(undefined)}
                  empty="—"
                />
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
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
            Nợ theo tháng — thu về sau mấy tháng, còn nợ bao nhiêu
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <DebtMonthTable report={report} receipts={receipts} />
          <p className="text-xs text-muted-foreground">
            Mỗi dòng là nợ của một tháng (tháng khách chốt, hoặc tháng nợ ghi
            khi thêm khách trả nợ). &quot;Sau N tháng&quot; = tháng nhận tiền
            trừ tháng nợ (nợ T9 trả vào T10 là sau 1 tháng), chữ nhỏ dưới số
            là tháng nhận; dòng Tổng ghi tỉ lệ trên tổng đã thu. Chỉ tính các
            khoản trả nợ nhận trong khoảng ngày đang chọn; khoản trả sau{" "}
            {DEBT_LAG_CAP} tháng trở lên gộp chung một cột. Bình quân thu sau
            = số tháng trung bình, tính theo số tiền. Còn nợ = giá bản luận −
            đã trả, tính đến hiện tại và chỉ với khách đã nhập giá. Bấm vào số
            để xem từng khách.
          </p>
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
