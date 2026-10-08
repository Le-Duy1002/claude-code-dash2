"use client"

import * as React from "react"
import { AlertTriangleIcon } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

import { fetchDemoDashboard } from "../services/work-tracking-service"
import type { DemoDashboardReport } from "../types"
import type { RangeValue } from "./date-range-picker"

function formatInt(n: number): string {
  return n.toLocaleString("vi-VN")
}

function formatPct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}

/**
 * Demo funnel: nhắn đến (tag "demo") -> cá nhân xem ("{X}Demo") -> cá nhân
 * chốt ("{X} Chốt") — per staff, or "Cả team" for the combined funnel
 * (which is the only view where "sent" / response-rate mean anything; a
 * single person's "sent" isn't tracked, only their own viewed → closed).
 */
export function DemoDashboardSection({
  dateRange,
  refreshKey,
}: {
  dateRange: RangeValue
  /** bump this to force a re-fetch (e.g. after a sync) without changing `dateRange` */
  refreshKey?: number
}) {
  const { user } = useAuth()
  const [person, setPerson] = React.useState<string>("team")
  const [report, setReport] = React.useState<DemoDashboardReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!user) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetchDemoDashboard(
      { range: dateRange.range, from: dateRange.from, to: dateRange.to },
      ctrl.signal
    )
      .then(setReport)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message)
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [user, dateRange, refreshKey])

  const staff = report?.staff ?? []
  const selectedStaff = staff.find((s) => s.key === person)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={person === "team" ? "default" : "outline"}
          onClick={() => setPerson("team")}
        >
          Cả team
        </Button>
        {staff.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant={person === s.key ? "default" : "outline"}
            onClick={() => setPerson(s.key)}
          >
            {s.name}
          </Button>
        ))}
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

      {loading && !report ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : person === "team" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Demo đã gửi" value={formatInt(report?.team.sent ?? 0)} />
          <StatCard
            label="Demo đã xem (cá nhân)"
            value={formatInt(report?.team.viewed ?? 0)}
          />
          <StatCard label="Demo chốt" value={formatInt(report?.team.closed ?? 0)} />
          <StatCard
            label="Tỉ lệ chốt demo của team"
            value={formatPct(report?.team.teamCloseRate ?? null)}
            sub="đơn chốt / demo đã xem"
          />
          <StatCard
            label="Tỉ lệ chốt tổng demo đã gửi"
            value={formatPct(report?.team.sentCloseRate ?? null)}
            sub="đơn chốt / demo đã gửi"
          />
          <StatCard
            label="Tỉ lệ phản hồi demo"
            value={formatPct(report?.team.responseRate ?? null)}
            sub="demo đã xem / demo đã gửi"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Demo đã xem"
            value={formatInt(selectedStaff?.viewed ?? 0)}
          />
          <StatCard label="Demo chốt" value={formatInt(selectedStaff?.closed ?? 0)} />
          <StatCard
            label="Tỉ lệ chốt"
            value={formatPct(selectedStaff?.closeRate ?? null)}
            sub="đơn chốt / demo đã xem"
          />
        </div>
      )}
    </div>
  )
}
