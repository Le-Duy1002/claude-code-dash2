"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  DownloadCloudIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"

import { toast } from "sonner"

import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import {
  fetchWorkTracking,
  triggerPancakeSync,
} from "../services/work-tracking-service"
import {
  CRITERIA,
  CRITERION_BY_ID,
  SCORE_LABEL,
  type CriterionId,
  type CriterionResult,
  type Score,
} from "../scoring"
import {
  RANGE_LABELS,
  RANGE_OPTIONS,
  SHIFT_OPTIONS,
  formatDateTime,
  formatPercent,
  formatVnd,
  type PageKey,
  type RangeKey,
  type ShiftKey,
  type StaffEvaluation,
  type WorkReport,
} from "../types"

const SCORE_CLASS: Record<Score, string> = {
  1: "bg-destructive/10 text-destructive",
  3: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  5: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}

const RATING_CLASS: Record<string, string> = {
  "Xuất sắc": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "Tốt": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Khá": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Đạt": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Chưa đạt": "bg-destructive/10 text-destructive",
  "Chưa đủ dữ liệu": "bg-muted text-muted-foreground",
}

type Drill = { staffKey: string; criterionId: CriterionId } | null

function ScoreCell({
  result,
  active,
  onClick,
}: {
  result: CriterionResult
  active: boolean
  onClick: () => void
}) {
  const label = result.pending
    ? "—"
    : result.score != null
      ? String(result.score)
      : "—"
  return (
    <TableCell className="p-1 text-center">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 text-sm font-medium tabular-nums transition-all",
          result.score != null
            ? SCORE_CLASS[result.score]
            : "bg-muted text-muted-foreground",
          active && "ring-2 ring-ring"
        )}
        title={
          result.pending
            ? `Chờ: ${result.pendingReason}`
            : `${SCORE_LABEL[result.score as Score]} · giá trị ${
                result.value ?? "—"
              }`
        }
      >
        {label}
      </button>
    </TableCell>
  )
}

function DrillPanel({
  staff,
  criterionId,
  onClose,
}: {
  staff: StaffEvaluation
  criterionId: CriterionId
  onClose: () => void
}) {
  const def = CRITERION_BY_ID.get(criterionId)!
  const result = staff.criteria.find((c) => c.id === criterionId)!

  // group repeated offenders (same conversation / same reason)
  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      { atMs: number; label: string; detail?: string; count: number }
    >()
    for (const e of result.offenders) {
      const key = `${e.label}|${e.detail ?? ""}`
      const prev = map.get(key)
      if (prev) {
        prev.count += 1
        prev.atMs = Math.min(prev.atMs, e.atMs)
      } else {
        map.set(key, { ...e, count: 1 })
      }
    }
    return [...map.values()].sort((a, b) => a.atMs - b.atMs)
  }, [result.offenders])

  return (
    <div className="mt-3 overflow-hidden rounded-lg border">
      <div className="flex items-start justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <p className="text-sm font-medium">
          {staff.name}
          <span className="mx-1.5 text-muted-foreground">·</span>
          Tiêu chí {def.sheetNo}: {def.label}
        </p>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {result.pending ? (
          <p className="text-sm text-muted-foreground">
            Chưa chấm được — {result.pendingReason}.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className={SCORE_CLASS[result.score as Score]}>
              {result.score} điểm — {SCORE_LABEL[result.score as Score]}
            </Badge>
            <span className="text-muted-foreground">
              Giá trị:{" "}
              <strong className="text-foreground">
                {typeof result.value === "number"
                  ? Math.round(result.value * 10) / 10
                  : "—"}{" "}
                {def.unit}
              </strong>{" "}
              · góp <strong className="text-foreground">
                +{result.points.toFixed(1)}
              </strong>{" "}
              vào điểm tổng
            </span>
          </div>
        )}

        <div className="grid gap-1 rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs sm:grid-cols-3">
          <div>
            <span className="text-destructive">Kém</span> — {def.bands.kem}
          </div>
          <div>
            <span className="text-amber-600 dark:text-amber-400">Đạt</span> —{" "}
            {def.bands.dat}
          </div>
          <div>
            <span className="text-emerald-600 dark:text-emerald-400">Vượt</span> —{" "}
            {def.bands.vuot}
          </div>
        </div>

        {grouped.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Hội thoại làm mất điểm ({result.offenders.length}
              {result.offenders.length >= 40 ? "+" : ""})
            </p>
            <ul className="flex flex-col divide-y rounded-md border text-sm">
              {grouped.map((e, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 px-2.5 py-1.5">
                  <span className="tabular-nums text-muted-foreground">
                    {formatDateTime(e.atMs)}
                  </span>
                  <span className="font-medium">{e.label}</span>
                  {e.detail ? (
                    <span className="text-destructive">— {e.detail}</span>
                  ) : null}
                  {e.count > 1 ? (
                    <span className="text-muted-foreground">×{e.count}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function Scorecard({
  report,
  drill,
  setDrill,
}: {
  report: WorkReport
  drill: Drill
  setDrill: (drill: Drill) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bảng điểm hiệu suất</CardTitle>
        <p className="text-xs text-muted-foreground">
          Mỗi ô: điểm <strong>1 = Kém</strong> / <strong>3 = Đạt</strong> /{" "}
          <strong>5 = Vượt</strong> theo mốc trong bảng đánh giá. Bấm vào ô để
          xem chi tiết lỗi. Cột <strong>Tổng</strong> = điểm quy đổi theo trọng
          số, dùng tính thưởng/lương cuối tháng.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <Table className="[&_td]:border-r [&_th]:border-r [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 bg-card">Nhân viên</TableHead>
                {CRITERIA.map((def) => (
                  <TableHead
                    key={def.id}
                    className="px-1.5 text-center align-bottom text-[0.7rem] leading-tight whitespace-nowrap"
                    title={`${def.sheetNo}. ${def.label}`}
                  >
                    <span className="text-muted-foreground">{def.sheetNo}.</span>{" "}
                    {def.shortLabel}
                  </TableHead>
                ))}
                <TableHead className="text-right">Tổng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.staff.map((staff) => (
                <TableRow key={staff.key}>
                  <TableCell className="sticky left-0 bg-card font-medium">
                    {staff.name}
                    {staff.unconfirmed ? (
                      <span
                        className="ml-1 text-xs text-amber-600 dark:text-amber-400"
                        title="Ghép tài khoản Pancake chưa xác nhận"
                      >
                        (?)
                      </span>
                    ) : null}
                  </TableCell>
                  {staff.criteria.map((result) => (
                    <ScoreCell
                      key={result.id}
                      result={result}
                      active={
                        drill?.staffKey === staff.key &&
                        drill?.criterionId === result.id
                      }
                      onClick={() =>
                        setDrill(
                          drill?.staffKey === staff.key &&
                            drill?.criterionId === result.id
                            ? null
                            : { staffKey: staff.key, criterionId: result.id }
                        )
                      }
                    />
                  ))}
                  <TableCell className="text-right whitespace-nowrap">
                    <span className="tabular-nums font-medium">
                      {staff.total == null
                        ? "—"
                        : `${staff.total.toFixed(1)}/${staff.outOf}`}
                    </span>
                    <Badge
                      className={cn(
                        "ml-1.5",
                        RATING_CLASS[staff.rating] ??
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {staff.rating}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* legend: what each criterion means + its thresholds */}
        <div className="grid gap-x-4 gap-y-1.5 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-2">
          {CRITERIA.map((def) => (
            <div key={def.id} className="flex gap-1.5">
              <span className="font-semibold tabular-nums">{def.sheetNo}.</span>
              <div>
                <span className="font-medium">{def.label}</span>{" "}
                <span className="text-muted-foreground">
                  ({def.weight}%)
                </span>
                <div className="text-muted-foreground">
                  <span className="text-destructive">Kém</span> {def.bands.kem}
                  {"  ·  "}
                  <span className="text-amber-600 dark:text-amber-400">Đạt</span>{" "}
                  {def.bands.dat}
                  {"  ·  "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Vượt
                  </span>{" "}
                  {def.bands.vuot}
                </div>
              </div>
            </div>
          ))}
        </div>

        {drill
          ? (() => {
              const staff = report.staff.find((s) => s.key === drill.staffKey)
              if (!staff) return null
              return (
                <DrillPanel
                  staff={staff}
                  criterionId={drill.criterionId}
                  onClose={() => setDrill(null)}
                />
              )
            })()
          : null}
      </CardContent>
    </Card>
  )
}

function InboxTab({ report }: { report: WorkReport }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nhân viên</TableHead>
          <TableHead className="text-right">Hội thoại xử lý</TableHead>
          <TableHead className="text-right">Đã trả lời</TableHead>
          <TableHead className="text-right">Đúng hạn</TableHead>
          <TableHead className="text-right">Chậm</TableHead>
          <TableHead className="text-right">Bỏ sót</TableHead>
          <TableHead className="text-right">% đúng hạn</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.staff.map((staff) => {
          const d = staff.detail
          const rate = d.replies > 0 ? (d.onTime / d.replies) * 100 : null
          return (
            <TableRow key={staff.key}>
              <TableCell className="font-medium">{staff.name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {d.convHandled}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {d.replies}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {d.onTime}
              </TableCell>
              <TableCell className="text-right tabular-nums">{d.slow}</TableCell>
              <TableCell className="text-right tabular-nums text-destructive">
                {d.missed || ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(rate)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function SalesTab({ report }: { report: WorkReport }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nhân viên</TableHead>
          <TableHead className="text-right">Đơn chốt</TableHead>
          <TableHead className="text-right">Doanh thu</TableHead>
          <TableHead className="text-right">Hội thoại</TableHead>
          <TableHead className="text-right">Tỷ lệ chốt</TableHead>
          <TableHead className="text-right">Khách demo</TableHead>
          <TableHead className="text-right">Chốt demo</TableHead>
          <TableHead className="text-right">Tỷ lệ chốt demo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.staff.map((staff) => {
          const d = staff.detail
          const close =
            d.convHandled > 0 ? (d.ordersClosed / d.convHandled) * 100 : null
          const demo =
            d.demoConversations > 0
              ? (d.demoClosed / d.demoConversations) * 100
              : null
          return (
            <TableRow key={staff.key}>
              <TableCell className="font-medium">{staff.name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {d.ordersClosed}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatVnd(d.revenue)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {d.convHandled}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(close)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {d.demoConversations}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {d.demoClosed}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(demo)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function WorkTrackingView() {
  const { user } = useAuth()
  const [range, setRange] = React.useState<RangeKey>("thisMonth")
  const [shift, setShift] = React.useState<ShiftKey>("all")
  const [page, setPage] = React.useState<PageKey>("all")
  const [tab, setTab] = React.useState("inbox")
  const [drill, setDrill] = React.useState<Drill>(null)

  const [report, setReport] = React.useState<WorkReport | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!user) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setDrill(null)
    fetchWorkTracking({ range, shift, page }, controller.signal)
      .then(setReport)
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [user, range, shift, page])

  React.useEffect(() => load(), [load])

  const runSync = React.useCallback(async () => {
    const days = report
      ? Math.min(14, Math.max(1, report.missingDays.length))
      : 1
    setSyncing(true)
    const id = toast.loading(
      `Đang đồng bộ ${days} ngày từ Pancake… (quét toàn bộ hội thoại, có thể vài phút)`
    )
    try {
      const result = await triggerPancakeSync(days)
      const crawled = result.days.reduce((s, d) => s + d.convsCrawled, 0)
      toast.success(`Đồng bộ xong ${result.days.length} ngày · ${crawled} hội thoại`, {
        id,
      })
      load()
    } catch (cause) {
      toast.error(`Đồng bộ lỗi: ${(cause as Error).message}`, { id })
    } finally {
      setSyncing(false)
    }
  }, [report, load])

  const pageOptions = React.useMemo(
    () => [
      { value: "all", label: "Cả 2 page" },
      ...(report?.pages.map((p) => ({ value: p.id, label: p.name })) ?? []),
    ],
    [report]
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Theo dõi công việc</h1>
          <p className="text-sm text-muted-foreground">
            Bảng điểm hiệu suất từ dữ liệu Pancake — gộp cả 2 page, chấm theo
            mốc đánh giá.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={range}
            onChange={(v) => setRange(v as RangeKey)}
            options={RANGE_OPTIONS}
            width="w-32"
          />
          <FilterSelect
            value={shift}
            onChange={(v) => setShift(v as ShiftKey)}
            options={SHIFT_OPTIONS}
            width="w-36"
          />
          <FilterSelect
            value={page}
            onChange={(v) => setPage(v as PageKey)}
            options={pageOptions}
            width="w-40"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={loading || syncing}
            onClick={() => load()}
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={loading ? "animate-spin" : undefined}
            />
            Làm mới
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={syncing}
            onClick={runSync}
          >
            <DownloadCloudIcon
              data-icon="inline-start"
              className={syncing ? "animate-pulse" : undefined}
            />
            {syncing ? "Đang đồng bộ…" : "Đồng bộ ngay"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {report
          ? `${RANGE_LABELS[range]} · ${
              SHIFT_OPTIONS.find((o) => o.value === shift)?.label
            } · ${
              pageOptions.find((o) => o.value === page)?.label ?? "Cả 2 page"
            } · ${
              report.lastSyncedAtMs
                ? `đồng bộ lúc ${formatDateTime(report.lastSyncedAtMs)}`
                : "chưa có dữ liệu đồng bộ"
            }`
          : "Đang tải…"}
      </p>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading && !report ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {report ? (
        <>
          <Scorecard report={report} drill={drill} setDrill={setDrill} />

          <Card>
            <CardHeader>
              <CardTitle>Chi tiết theo nhóm tiêu chí</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={(v) => setTab(v ?? "inbox")}>
                <TabsList>
                  <TabsTrigger value="inbox">II. Xử lý inbox</TabsTrigger>
                  <TabsTrigger value="sales">IV. Chốt đơn</TabsTrigger>
                  <TabsTrigger value="shift">I. Ca làm</TabsTrigger>
                  <TabsTrigger value="tag">III. Gán tag</TabsTrigger>
                </TabsList>
                <TabsContent value="inbox" className="pt-3">
                  <InboxTab report={report} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tiêu chí 4 &amp; 5. Thời gian phản hồi tính từ tin nhắn mới
                    của khách đến tin đầu tiên của nhân viên. Bot Botcake trả lời
                    không tính là nhân viên phản hồi.
                  </p>
                </TabsContent>
                <TabsContent value="sales" className="pt-3">
                  <SalesTab report={report} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tiêu chí 7 &amp; 8. Đơn chốt = đơn có trạng thái khác nháp.
                    Chốt demo = đơn chốt thuộc hội thoại có tag <code>demo</code>.
                    Tiêu chí 6 (gán tag): hội thoại có đơn chốt phải có tag{" "}
                    <code>Đã chốt</code> đi kèm <code>Tiềm năng</code> (hoặc{" "}
                    <code>Demo</code>).
                  </p>
                </TabsContent>
                <TabsContent value="shift" className="pt-3">
                  <p className="text-sm text-muted-foreground">
                    Tiêu chí 1 &amp; 2 cần lịch ca từng người (sẽ tích hợp sau).
                    Khi có lịch: xác định giờ vào ca / rời ca từ hoạt động
                    Pancake (bot chạy khi có người kích hoạt) và so với ca đã
                    phân.
                  </p>
                </TabsContent>
                <TabsContent value="tag" className="pt-3">
                  <p className="text-sm text-muted-foreground">
                    Tiêu chí 6 — quy tắc hiện tại: hội thoại có đơn chốt (khách
                    chuyển tiền + tạo đơn) phải có tag <code>Đã chốt</code>, và{" "}
                    <code>Đã chốt</code> chỉ hợp lệ khi đi kèm{" "}
                    <code>Tiềm năng</code> — trừ khi cạnh nó có <code>Demo</code>{" "}
                    thì không cần Tiềm năng. Bấm ô &ldquo;6. Gán tag&rdquo; trên
                    bảng điểm để xem từng hội thoại sai.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {report.warnings.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              {report.warnings.map((warning, index) => (
                <div key={index} className="flex gap-1.5">
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
  width,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  width: string
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(v) => onChange(v ?? options[0].value)}
    >
      <SelectTrigger size="sm" className={width}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
