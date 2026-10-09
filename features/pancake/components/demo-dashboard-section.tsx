"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  EyeIcon,
  ReplyIcon,
  SendIcon,
  TargetIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { fetchDemoDashboard } from "../services/work-tracking-service"
import type { DemoDashboardReport } from "../types"
import type { RangeValue } from "./date-range-picker"

function formatInt(n: number): string {
  return n.toLocaleString("vi-VN")
}

function formatPct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`
}

/**
 * Funnel-stage accent: same validated `--chart-orange` token the page
 * dashboard's chart uses (see `app/globals.css`), stepped by opacity rather
 * than a separate hue ramp — an ordinal "how deep into the funnel" cue
 * (gửi -> xem -> chốt), not a value encoding the reader has to decode, so it
 * stays a quiet icon+border accent and never touches the number itself (see
 * dataviz skill: "text never wears the data color").
 */
const FUNNEL_TINT = {
  sent: "color-mix(in oklch, var(--chart-orange) 45%, transparent)",
  viewed: "color-mix(in oklch, var(--chart-orange) 70%, transparent)",
  closed: "var(--chart-orange)",
} as const
/** derived ratios get a lighter, uniform version of the same accent */
const RATIO_TINT = "color-mix(in oklch, var(--chart-orange) 55%, transparent)"

function StatCard({
  label,
  value,
  sub,
  estimated,
  icon: Icon,
  tint,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** some days in range have no Pancake tag figure yet — value includes a self-estimated part */
  estimated?: boolean
  icon?: LucideIcon
  /** funnel-stage accent color (see `FUNNEL_TINT`/`RATIO_TINT`) */
  tint?: string
}) {
  return (
    <Card
      className={cn(tint && "border-t-2")}
      style={tint ? { borderTopColor: tint } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          {estimated ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
            >
              <AlertTriangleIcon className="size-3" />
              Một phần ước tính
            </Badge>
          ) : null}
          {Icon ? (
            <div
              className="flex size-7 items-center justify-center rounded-full"
              style={
                tint
                  ? {
                      backgroundColor: `color-mix(in oklch, ${tint} 16%, transparent)`,
                    }
                  : undefined
              }
            >
              <Icon className="size-3.5" style={tint ? { color: tint } : undefined} />
            </div>
          ) : null}
        </div>
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
  const estimated = (report?.estimatedDays.length ?? 0) > 0

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
          <StatCard
            label="Demo đã gửi"
            value={formatInt(report?.team.sent ?? 0)}
            estimated={estimated}
            icon={SendIcon}
            tint={FUNNEL_TINT.sent}
          />
          <StatCard
            label="Demo đã xem (cá nhân)"
            value={formatInt(report?.team.viewed ?? 0)}
            estimated={estimated}
            icon={EyeIcon}
            tint={FUNNEL_TINT.viewed}
          />
          <StatCard
            label="Demo chốt"
            value={formatInt(report?.team.closed ?? 0)}
            estimated={estimated}
            icon={CheckCircle2Icon}
            tint={FUNNEL_TINT.closed}
          />
          <StatCard
            label="Tỉ lệ chốt demo của team"
            value={formatPct(report?.team.teamCloseRate ?? null)}
            sub="đơn chốt / demo đã xem"
            estimated={estimated}
            icon={TrendingUpIcon}
            tint={RATIO_TINT}
          />
          <StatCard
            label="Tỉ lệ chốt tổng demo đã gửi"
            value={formatPct(report?.team.sentCloseRate ?? null)}
            sub="đơn chốt / demo đã gửi"
            estimated={estimated}
            icon={TargetIcon}
            tint={RATIO_TINT}
          />
          <StatCard
            label="Tỉ lệ phản hồi demo"
            value={formatPct(report?.team.responseRate ?? null)}
            sub="demo đã xem / demo đã gửi"
            estimated={estimated}
            icon={ReplyIcon}
            tint={RATIO_TINT}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Demo đã xem"
            value={formatInt(selectedStaff?.viewed ?? 0)}
            estimated={estimated}
            icon={EyeIcon}
            tint={FUNNEL_TINT.viewed}
          />
          <StatCard
            label="Demo chốt"
            value={formatInt(selectedStaff?.closed ?? 0)}
            estimated={estimated}
            icon={CheckCircle2Icon}
            tint={FUNNEL_TINT.closed}
          />
          <StatCard
            label="Tỉ lệ chốt"
            value={formatPct(selectedStaff?.closeRate ?? null)}
            sub="đơn chốt / demo đã xem"
            estimated={estimated}
            icon={TrendingUpIcon}
            tint={RATIO_TINT}
          />
        </div>
      )}
    </div>
  )
}
