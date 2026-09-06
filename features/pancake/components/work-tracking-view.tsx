"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  DownloadCloudIcon,
  ExternalLinkIcon,
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
import { cn } from "@/lib/utils"

import {
  autoSyncedRecently,
  fetchWorkTracking,
  markAutoSynced,
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
  SHIFT_OPTIONS,
  formatDate,
  formatDateTime,
  pancakeConvLink,
  type PageKey,
  type ShiftKey,
  type StaffEvaluation,
  type WorkReport,
} from "../types"
import { DateRangePicker, type RangeValue } from "./date-range-picker"

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
  const [showDetails, setShowDetails] = React.useState(false)

  function copyText(text: string, note: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(note),
      () => toast.error("Không copy được")
    )
  }

  // group repeated offenders (same conversation / same reason)
  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      {
        atMs: number
        label: string
        detail?: string
        customerId?: string
        pageId?: string
        conversationId?: string
        count: number
      }
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
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Hội thoại làm mất điểm ({result.offenders.length}
                {result.offenders.length >= 40 ? "+" : ""}) — bấm tên khách hoặc{" "}
                <ExternalLinkIcon className="inline size-3" /> để mở hội thoại
              </p>
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                aria-expanded={showDetails}
              >
                {showDetails ? "Ẩn ID & link" : "Hiện ID & link"}
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 transition-transform",
                    showDetails && "rotate-180"
                  )}
                />
              </button>
            </div>
            <ul className="flex flex-col divide-y rounded-md border text-sm">
              {grouped.map((e, i) => {
                const link = pancakeConvLink(e.pageId, e.conversationId)
                return (
                  <li key={i} className="flex flex-col gap-1 px-2.5 py-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="tabular-nums text-muted-foreground">
                        {formatDateTime(e.atMs)}
                      </span>
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-baseline gap-1 font-medium underline-offset-2 hover:underline"
                          title="Mở hội thoại trên Pancake"
                        >
                          {e.label}
                          <ExternalLinkIcon className="size-3.5 self-center" />
                        </a>
                      ) : (
                        <span className="font-medium">{e.label}</span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          copyText(e.label, `Đã copy tên: ${e.label}`)
                        }
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        copy tên
                      </button>
                      {e.detail ? (
                        <span className="text-destructive">— {e.detail}</span>
                      ) : null}
                      {e.count > 1 ? (
                        <span className="text-muted-foreground">×{e.count}</span>
                      ) : null}
                    </div>
                    {showDetails ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-1 text-[0.7rem] text-muted-foreground">
                        {e.customerId ? (
                          <button
                            type="button"
                            onClick={() =>
                              copyText(e.customerId!, "Đã copy ID khách")
                            }
                            className="font-mono underline-offset-2 hover:underline"
                            title="Bấm để copy ID khách"
                          >
                            ID: {e.customerId}
                          </button>
                        ) : null}
                        {link ? (
                          <button
                            type="button"
                            onClick={() =>
                              copyText(link, "Đã copy link hội thoại")
                            }
                            className="underline-offset-2 hover:underline"
                            title="Bấm để copy link hội thoại"
                          >
                            Copy link hội thoại
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
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
  const [legendOpen, setLegendOpen] = React.useState(false)

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
        <p className="text-xs text-muted-foreground">
          <strong>Rep đúng hạn / Bỏ sót</strong> chỉ xét hội thoại cần người
          xử lý: tính từ tin đầu khách nhắn <em>sau</em> loạt Botcake, trong giờ
          trực (bỏ khung 0h–8h). Bỏ qua hội thoại có tag Demo / Thông điệp / Hẹn
          / Khách rác / Đã chốt, tin được Botcake trả lời trong 20′, và câu chốt
          cuối kiểu “cảm ơn, liên hệ sau”. <strong>Bỏ sót</strong> = nhân viên đã
          vào hội thoại nhưng bỏ ngỏ tin cuối của khách quá 20 phút.
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

        {/* legend: what each criterion means + its 3 thresholds — collapsible */}
        <div className="rounded-lg border bg-muted/20">
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-expanded={legendOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <span className="text-sm font-medium">
              Chú thích tiêu chí đánh giá
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                legendOpen && "rotate-180"
              )}
            />
          </button>

          {legendOpen ? (
            <div className="border-t px-3 pt-2.5 pb-3">
              <p className="mb-3 text-xs text-muted-foreground">
                Mỗi tiêu chí có 3 mốc cố định, công khai — đạt mốc nào nhận
                điểm đó: <strong className="text-destructive">Kém = 1</strong>
                ,{" "}
                <strong className="text-amber-600 dark:text-amber-400">
                  Đạt = 3
                </strong>
                ,{" "}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  Vượt = 5
                </strong>
                .
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {CRITERIA.map((def) => (
                  <div key={def.id} className="rounded-md border bg-card p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">
                        <span className="text-muted-foreground">
                          {def.sheetNo}.
                        </span>{" "}
                        {def.label}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        trọng số {def.weight}%
                      </span>
                    </div>
                    <dl className="mt-2 grid grid-cols-3 divide-x rounded border text-[0.7rem] leading-snug">
                      <div className="px-2 py-1.5">
                        <dt className="font-semibold text-destructive">Kém</dt>
                        <dd className="mt-0.5 text-muted-foreground">
                          {def.bands.kem}
                        </dd>
                      </div>
                      <div className="px-2 py-1.5">
                        <dt className="font-semibold text-amber-600 dark:text-amber-400">
                          Đạt
                        </dt>
                        <dd className="mt-0.5 text-muted-foreground">
                          {def.bands.dat}
                        </dd>
                      </div>
                      <div className="px-2 py-1.5">
                        <dt className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Vượt
                        </dt>
                        <dd className="mt-0.5 text-muted-foreground">
                          {def.bands.vuot}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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

export function WorkTrackingView() {
  const { user } = useAuth()
  const [dateRange, setDateRange] = React.useState<RangeValue>({
    range: "thisMonth",
  })
  const [shift, setShift] = React.useState<ShiftKey>("all")
  const [page, setPage] = React.useState<PageKey>("all")
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
    fetchWorkTracking({ ...dateRange, shift, page }, controller.signal)
      .then(setReport)
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [user, dateRange, shift, page])

  React.useEffect(() => load(), [load])

  const runSync = React.useCallback(
    async (opts?: { days?: number; auto?: boolean }) => {
      const days =
        opts?.days ??
        (report ? Math.min(14, Math.max(1, report.missingDays.length)) : 1)
      setSyncing(true)
      const id = toast.loading(
        opts?.auto
          ? "Đang đồng bộ dữ liệu hôm nay từ Pancake…"
          : `Đang đồng bộ ${days} ngày từ Pancake… (quét toàn bộ hội thoại, có thể vài phút)`
      )
      try {
        const result = await triggerPancakeSync(days)
        const crawled = result.days.reduce((s, d) => s + d.convsCrawled, 0)
        toast.success(
          `Đồng bộ xong ${result.days.length} ngày · ${crawled} hội thoại`,
          { id }
        )
        load()
      } catch (cause) {
        toast.error(`Đồng bộ lỗi: ${(cause as Error).message}`, { id })
      } finally {
        setSyncing(false)
      }
    },
    [report, load]
  )

  // auto-sync today's data once when the page opens (shared 5-min cooldown
  // with the other Pancake view via localStorage)
  const autoSyncTried = React.useRef(false)
  React.useEffect(() => {
    if (!user || autoSyncTried.current) return
    autoSyncTried.current = true
    if (!autoSyncedRecently()) {
      markAutoSynced()
      void runSync({ days: 1, auto: true })
    }
  }, [user, runSync])

  const pageOptions = React.useMemo(
    () => [
      { value: "all", label: "Cả 2 page" },
      ...(report?.pages.map((p) => ({ value: p.id, label: p.name })) ?? []),
    ],
    [report]
  )

  const rangeLabel =
    dateRange.range === "custom" && report
      ? `${formatDate(report.fromMs)} – ${formatDate(report.toMs - 1)}`
      : RANGE_LABELS[dateRange.range]

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
          <DateRangePicker value={dateRange} onChange={setDateRange} />
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
            onClick={() => runSync()}
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
          ? `${rangeLabel} · ${
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
