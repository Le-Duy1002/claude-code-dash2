"use client"

import * as React from "react"
import { AlertTriangleIcon } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import {
  fetchStaffOrders,
  type StaffOrdersReport,
} from "../services/staff-orders-service"
import { STAFF } from "../staff"
import type { RangeValue } from "./date-range-picker"
import { formatInt, formatPct, StatCard } from "./stat-card"

/**
 * "Đơn chốt theo nhân viên": each person's closed orders from Pancake's own
 * staff table, and their share of the total the "Đơn chốt" card shows.
 */
export function StaffOrdersSection({
  dateRange,
  refreshKey,
  pageId,
  totalOrders,
  totalLoading,
  totalEstimated,
}: {
  dateRange: RangeValue
  /** bump this to force a re-fetch (e.g. after a sync) without changing `dateRange` */
  refreshKey?: number
  /** a page's id, or "all" for every page */
  pageId: string
  /** the "Đơn chốt" card's figure, for the same page and range */
  totalOrders: number
  totalLoading: boolean
  totalEstimated: boolean
}) {
  const { user } = useAuth()
  const [person, setPerson] = React.useState("all")
  const [report, setReport] = React.useState<StaffOrdersReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!user) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetchStaffOrders(
      {
        range: dateRange.range,
        from: dateRange.from,
        to: dateRange.to,
        hourFrom: dateRange.hourFrom,
        hourTo: dateRange.hourTo,
      },
      ctrl.signal
    )
      .then((r) => {
        setReport(r)
        setLoading(false)
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return
        // numbers from the previous range must not stay up beside the error
        setReport(null)
        setError((e as Error).message)
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [user, dateRange, refreshKey])

  function ordersOf(staffKey: string): number {
    const byPage = report?.orders[staffKey] ?? {}
    if (pageId !== "all") return byPage[pageId] ?? 0
    return Object.values(byPage).reduce((sum, n) => sum + n, 0)
  }

  function shareOf(orders: number): number | null {
    return totalOrders > 0 ? (orders / totalOrders) * 100 : null
  }

  const selected = STAFF.find((member) => member.key === person)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Đơn chốt theo nhân viên</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={person === "all" ? "default" : "outline"}
            onClick={() => setPerson("all")}
          >
            Tất cả
          </Button>
          {STAFF.map((member) => (
            <Button
              key={member.key}
              size="sm"
              variant={person === member.key ? "default" : "outline"}
              onClick={() => setPerson(member.key)}
            >
              {member.name}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangleIcon className="size-4 shrink-0" />
          Không lấy được số đơn theo nhân viên: {error}
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

      {loading || totalLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : !report ? null : selected ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label="Số đơn chốt"
            value={formatInt(ordersOf(selected.key))}
            sub="theo thống kê Nhân viên của Pancake"
          />
          <StatCard
            label="Tỉ lệ chốt"
            value={formatPct(shareOf(ordersOf(selected.key)))}
            sub={`${formatInt(ordersOf(selected.key))} / ${formatInt(totalOrders)} đơn chốt tổng`}
            estimated={totalEstimated}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STAFF.map((member) => (
            <StatCard
              key={member.key}
              label={member.name}
              value={formatInt(ordersOf(member.key))}
              sub={`${formatPct(shareOf(ordersOf(member.key)))} đơn chốt tổng`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
