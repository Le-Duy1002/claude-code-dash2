"use client"

import * as React from "react"
import { AlertTriangleIcon } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { RangeValue } from "@/features/pancake/components/date-range-picker"

import { fetchCskhReport } from "../services/cskh-service"
import {
  CSKH_PAGE_NAME,
  formatDateTime,
  type CskhCustomer,
  type CskhReport,
} from "../types"
import { CskhCustomerList } from "./cskh-customer-list"
import { CskhDetailTable } from "./cskh-detail-table"

type Sheet = "detail" | "revenue"

/**
 * The "Chăm sóc khách hàng" tab of Chỉ số (page Hẻm Trong Đường): two
 * sheets — Thống kê chi tiết and Thống kê doanh thu — over the page's date
 * range.
 */
export function CskhSection({
  dateRange,
  refreshKey,
}: {
  dateRange: RangeValue
  /** bump to re-fetch (e.g. after a sync) without changing `dateRange` */
  refreshKey?: number
}) {
  const { user } = useAuth()
  const [sheet, setSheet] = React.useState<Sheet>("detail")
  const [report, setReport] = React.useState<CskhReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!user) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetchCskhReport(
      { range: dateRange.range, from: dateRange.from, to: dateRange.to },
      ctrl.signal
    )
      .then(setReport)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message)
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [user, dateRange.range, dateRange.from, dateRange.to, refreshKey])

  const replaceCustomer = React.useCallback((next: CskhCustomer) => {
    setReport((prev) =>
      prev
        ? {
            ...prev,
            customers: prev.customers.map((c) => (c.id === next.id ? next : c)),
          }
        : prev
    )
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={sheet === "detail" ? "default" : "outline"}
          onClick={() => setSheet("detail")}
        >
          Thống kê chi tiết
        </Button>
        <Button
          size="sm"
          variant={sheet === "revenue" ? "default" : "outline"}
          onClick={() => setSheet("revenue")}
        >
          Thống kê doanh thu
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {CSKH_PAGE_NAME}
          {report
            ? ` · ${
                report.lastSyncedAtMs
                  ? `đồng bộ lúc ${formatDateTime(report.lastSyncedAtMs)}`
                  : "chưa đồng bộ khách chốt"
              }`
            : ""}
        </span>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}
      {report?.warnings.map((w) => (
        <div
          key={w}
          className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          {w}
        </div>
      ))}

      {sheet === "revenue" ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Thống kê doanh thu — nội dung sẽ được bổ sung.
        </p>
      ) : loading && !report ? (
        <Skeleton className="h-72 w-full" />
      ) : report ? (
        <>
          <CskhDetailTable report={report} />
          <p className="text-xs text-muted-foreground">
            Khách xem = số lần gắn tag tên nhân viên trong ngày (giống Pancake,
            có thể âm khi gỡ tag). Khách chốt = hội thoại có cả tag
            &quot;Chốt sale&quot; và tag tên nhân viên, tính vào ngày được gắn
            &quot;Chốt sale&quot;. Giá bản luận tính theo ngày chốt, Đã trả
            theo ngày khách trả. AOV = giá bản luận / khách chốt · Tỉ lệ chốt =
            khách chốt / khách xem.
          </p>
          <CskhCustomerList
            customers={report.customers}
            onChange={replaceCustomer}
          />
        </>
      ) : null}
    </div>
  )
}
