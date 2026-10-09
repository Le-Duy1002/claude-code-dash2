"use client"

import * as React from "react"
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import {
  autoSyncedRecently,
  fetchPageDashboard,
  markAutoSynced,
  syncPancakeRange,
} from "../services/work-tracking-service"
import { resolveReportRange, type PageDashboardReport } from "../types"
import { DateRangePicker, type RangeValue } from "./date-range-picker"
import { DemoDashboardSection } from "./demo-dashboard-section"

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
  estimated,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** some days in range have no Pancake figure yet — value includes a self-estimated part */
  estimated?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
        {estimated ? (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
          >
            <AlertTriangleIcon className="size-3" />
            Một phần ước tính
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}

/** fixed categorical order, never reassigned per filter — see dataviz skill */
const PAGE_CHART_COLORS = [
  "var(--chart-orange)",
  "var(--chart-blue)",
  "var(--chart-3)",
]

export function PageDashboardView() {
  const { user } = useAuth()
  const [mode, setMode] = React.useState<"pages" | "demo">("pages")
  const [dateRange, setDateRange] = React.useState<RangeValue>({
    range: "thisMonth",
  })
  const [pageFilter, setPageFilter] = React.useState<string>("all")
  const [report, setReport] = React.useState<PageDashboardReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [syncing, setSyncing] = React.useState<string | null>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const r = await fetchPageDashboard(
          {
            range: dateRange.range,
            from: dateRange.from,
            to: dateRange.to,
            hourFrom: dateRange.hourFrom,
            hourTo: dateRange.hourTo,
          },
          signal
        )
        setReport(r)
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [dateRange]
  )

  React.useEffect(() => {
    if (!user) return
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [user, load])

  // auto-sync today once on open (shared 5-min cooldown with other Pancake views)
  const autoSyncTried = React.useRef(false)
  React.useEffect(() => {
    if (!user || autoSyncTried.current) return
    autoSyncTried.current = true
    if (autoSyncedRecently()) return
    markAutoSynced()
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
    syncPancakeRange(today, today)
      .then(() => load())
      .catch(() => {})
  }, [user, load])

  async function syncNow() {
    const { fromMs, toMs } = resolveReportRange(
      dateRange.range,
      dateRange.from,
      dateRange.to
    )
    const fromISO = new Date(fromMs + 7 * 3_600_000).toISOString().slice(0, 10)
    const toISO = new Date(Math.min(toMs, Date.now()) - 1 + 7 * 3_600_000)
      .toISOString()
      .slice(0, 10)
    setSyncing("Đang đồng bộ Pancake…")
    try {
      const result = await syncPancakeRange(fromISO, toISO, {
        onProgress: (done, total) =>
          setSyncing(`Đồng bộ Pancake — ${done}/${total} ngày…`),
      })
      if (result.incomplete.length > 0) {
        toast.warning(
          `Đồng bộ xong phần lớn nhưng ${result.incomplete.length} ngày còn dữ liệu chưa lấy hết — bấm lại để lấy tiếp.`
        )
      } else {
        toast.success("Đã đồng bộ xong")
      }
      await load()
      setRefreshKey((k) => k + 1)
    } catch (e) {
      toast.error(`Đồng bộ lỗi: ${(e as Error).message}`)
    } finally {
      setSyncing(null)
    }
  }

  const pages = React.useMemo(() => report?.pages ?? [], [report])
  const selected =
    pageFilter === "all" ? report?.combined : pages.find((p) => p.id === pageFilter)

  const chartConfig: ChartConfig = React.useMemo(() => {
    const cfg: ChartConfig = {}
    pages.forEach((p, i) => {
      cfg[p.id] = {
        label: p.name,
        color: PAGE_CHART_COLORS[i % PAGE_CHART_COLORS.length],
      }
    })
    return cfg
  }, [pages])

  const chartData = React.useMemo(() => {
    if (!report) return []
    return report.daily.map((d) => {
      const row: Record<string, string | number> = { date: d.date }
      for (const p of pages) {
        if (pageFilter !== "all" && pageFilter !== p.id) continue
        row[p.id] = d.byPage[p.id]?.newConversations ?? 0
      }
      return row
    })
  }, [report, pages, pageFilter])

  const visiblePageIds =
    pageFilter === "all" ? pages.map((p) => p.id) : [pageFilter]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">
            Thống kê trang Pancake
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "pages"
              ? "Hội thoại mới, đơn chốt, tỉ lệ chốt — lọc theo khoảng thời gian và khung giờ, gộp chung hoặc theo từng trang."
              : "Phễu demo: nhắn đến → cá nhân xem → cá nhân chốt, theo từng người hoặc cả team."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            showHourFilter={mode === "pages"}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(syncing) || loading}
            onClick={syncNow}
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={cn("size-4", syncing && "animate-spin")}
            />
            {syncing ?? "Đồng bộ ngay"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted p-1">
        <Button
          size="sm"
          variant={mode === "pages" ? "default" : "ghost"}
          onClick={() => setMode("pages")}
        >
          Hội thoại &amp; đơn chốt
        </Button>
        <Button
          size="sm"
          variant={mode === "demo" ? "default" : "ghost"}
          onClick={() => setMode("demo")}
        >
          Demo
        </Button>
      </div>

      {mode === "demo" ? (
        <DemoDashboardSection dateRange={dateRange} refreshKey={refreshKey} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={pageFilter === "all" ? "default" : "outline"}
              onClick={() => setPageFilter("all")}
            >
              Gộp chung
            </Button>
            {pages.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={pageFilter === p.id ? "default" : "outline"}
                onClick={() => setPageFilter(p.id)}
              >
                {p.name}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {loading && !report ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : (
              <>
                <StatCard
                  label="Hội thoại mới"
                  value={formatInt(selected?.newConversations ?? 0)}
                  estimated={(report?.estimatedDays.newConversations.length ?? 0) > 0}
                />
                <StatCard
                  label="Đơn chốt"
                  value={formatInt(selected?.ordersClosed ?? 0)}
                  sub={`/ ${formatInt(selected?.ordersTotal ?? 0)} tổng đơn`}
                  estimated={(report?.estimatedDays.ordersClosed.length ?? 0) > 0}
                />
                <StatCard
                  label="Tỉ lệ chốt"
                  value={formatPct(selected?.closeRate ?? null)}
                  sub="đơn chốt / hội thoại mới"
                  estimated={
                    (report?.estimatedDays.newConversations.length ?? 0) > 0 ||
                    (report?.estimatedDays.ordersClosed.length ?? 0) > 0
                  }
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Hội thoại mới theo ngày
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pt-2 sm:px-6">
              {loading && !report ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-[250px] w-full"
                >
                  <AreaChart data={chartData}>
                    <defs>
                      {visiblePageIds.map((id) => (
                        <linearGradient
                          key={id}
                          id={`fill-${id}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={`var(--color-${id})`}
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor={`var(--color-${id})`}
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={(value: string) => value.slice(5)}
                    />
                    <ChartTooltip
                      cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                      content={<ChartTooltipContent indicator="line" />}
                    />
                    {visiblePageIds.length > 1 ? (
                      <ChartLegend content={<ChartLegendContent />} />
                    ) : null}
                    {visiblePageIds.map((id) => (
                      <Area
                        key={id}
                        dataKey={id}
                        type="natural"
                        stroke={`var(--color-${id})`}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill={`url(#fill-${id})`}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                      />
                    ))}
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {report ? (
            <p className="text-xs text-muted-foreground">
              {report.lastSyncedAtMs
                ? `Đồng bộ lần cuối ${new Date(report.lastSyncedAtMs).toLocaleString("vi-VN")}`
                : "Chưa đồng bộ dữ liệu cho khoảng thời gian này"}
              {report.missingDays.length > 0 ? (
                <Badge variant="outline" className="ml-2">
                  {report.missingDays.length} ngày chưa đồng bộ
                </Badge>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
