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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import {
  autoSyncedRecently,
  fetchDailyLog,
  markAutoSynced,
  syncPancakeRange,
  triggerPancakeSync,
} from "../services/work-tracking-service"
import { STAFF } from "../staff"
import {
  RANGE_LABELS,
  SHIFT_OPTIONS,
  formatDate,
  formatDateTime,
  type DailyLogResponse,
  type DailyLogRow,
  type DailyLogTotals,
  type PageKey,
  type ScoreEventLite,
  type ShiftKey,
} from "../types"
import { DateRangePicker, type RangeValue } from "./date-range-picker"
import { OffenderList } from "./offender-list"

type DrillKind = "slow" | "missed" | "tagWrong"
type Drill = { date: string; kind: DrillKind } | null

const DRILL_LABEL: Record<DrillKind, string> = {
  slow: "Rep chậm (3–15′)",
  missed: "Bỏ sót (> 15′)",
  tagWrong: "Tag sai / thiếu",
}
const DRILL_EVENTS: Record<DrillKind, (r: DailyLogRow) => ScoreEventLite[]> = {
  slow: (r) => r.slowEvents,
  missed: (r) => r.missedEvents,
  tagWrong: (r) => r.tagWrongEvents,
}

const STAFF_OPTIONS = STAFF.map((s) => ({ value: s.key, label: s.name }))

function n(value: number | null) {
  return value == null ? "—" : value === 0 ? "·" : String(value)
}

function vnDate(iso: string) {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

type Group = "ca" | "inbox" | "chot" | "note"

const GROUPS: {
  id: Group
  label: string
  cls: string
}[] = [
  { id: "ca", label: "Ca làm việc", cls: "bg-sky-600/15 text-sky-700 dark:text-sky-300" },
  {
    id: "inbox",
    label: "Xử lý inbox & tag (AI quét)",
    cls: "bg-sky-600/15 text-sky-700 dark:text-sky-300",
  },
  {
    id: "chot",
    label: "Chốt đơn",
    cls: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  },
  { id: "note", label: "", cls: "bg-muted" },
]

type Col = {
  group: Group
  label: string
  align: "left" | "right"
  cls?: string
  /** clickable → opens the row drill-down for this error kind */
  drill?: DrillKind
  cell: (r: DailyLogRow) => React.ReactNode
  total: (t: DailyLogTotals) => React.ReactNode
}

const COLS: Col[] = [
  { group: "ca", label: "Ngày", align: "left",
    cell: (r) => vnDate(r.date),
    total: () => "" },
  { group: "ca", label: "Ca", align: "left",
    cell: (r) => r.shift,
    total: (t) => `${t.daysWorked} ngày` },
  { group: "ca", label: "Số giờ làm", align: "right",
    cell: (r) => (r.hoursWorked == null ? "—" : `${r.hoursWorked}h`),
    total: (t) => `${t.hoursWorked}h` },
  { group: "inbox", label: "Tổng hội thoại", align: "right",
    cell: (r) => n(r.totalConversations),
    total: (t) => t.totalConversations },
  { group: "inbox", label: "Rep đúng hạn (≤ 3′)", align: "right",
    cls: "text-emerald-600 dark:text-emerald-400",
    cell: (r) => n(r.replyOnTime),
    total: (t) => t.replyOnTime },
  { group: "inbox", label: "Rep chậm (3–15′)", align: "right",
    cls: "text-amber-600 dark:text-amber-400", drill: "slow",
    cell: (r) => n(r.replySlow),
    total: (t) => t.replySlow },
  { group: "inbox", label: "Bỏ sót (> 15′)", align: "right",
    cls: "text-destructive", drill: "missed",
    cell: (r) => n(r.missed),
    total: (t) => t.missed },
  { group: "inbox", label: "Tag đúng", align: "right",
    cls: "text-emerald-600 dark:text-emerald-400",
    cell: (r) => n(r.tagCorrect),
    total: (t) => t.tagCorrect },
  { group: "inbox", label: "Tag sai / thiếu", align: "right",
    cls: "text-destructive", drill: "tagWrong",
    cell: (r) => n(r.tagWrong),
    total: (t) => t.tagWrong },
  { group: "chot", label: "Khách xem demo", align: "right",
    cell: (r) => n(r.demoCustomers),
    total: (t) => t.demoCustomers },
  { group: "chot", label: "Chốt từ demo", align: "right",
    cell: (r) => n(r.demoClosed),
    total: (t) => t.demoClosed },
  { group: "chot", label: "Đơn chốt tổng", align: "right",
    cell: (r) => n(r.ordersClosed),
    total: (t) => t.ordersClosed },
  { group: "note", label: "Ghi chú", align: "left",
    cls: "text-muted-foreground font-normal",
    cell: (r) => r.note,
    total: () => "" },
]

/** last column index of each group -> gets a right divider */
const DIVIDER_AFTER = new Set(
  GROUPS.slice(0, -1).map(
    (g) =>
      COLS.reduce((last, c, i) => (c.group === g.id ? i : last), -1)
  )
)

const divCls = (i: number) => (DIVIDER_AFTER.has(i) ? "border-r-2" : "")

function rangeText(data: DailyLogResponse): string {
  return data.range === "custom"
    ? `${formatDate(data.fromMs)} – ${formatDate(data.toMs - 1)}`
    : RANGE_LABELS[data.range]
}

function LogTable({
  data,
  drill,
  onDrill,
}: {
  data: DailyLogResponse
  drill: Drill
  onDrill: (next: Drill) => void
}) {
  const drillRow = drill
    ? data.rows.find((r) => r.date === drill.date)
    : undefined
  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
      <Table className="min-w-[960px] text-xs [&_td]:border-r [&_th]:border-r [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {GROUPS.map((g) => {
              const span = COLS.filter((c) => c.group === g.id).length
              return (
                <TableHead
                  key={g.id}
                  colSpan={span}
                  className={cn(
                    "border-b border-r-2 px-2 py-1.5 text-center text-[0.7rem] font-semibold tracking-wide uppercase",
                    g.cls
                  )}
                >
                  {g.label || " "}
                </TableHead>
              )
            })}
          </TableRow>
          <TableRow className="hover:bg-transparent">
            {COLS.map((c, i) => (
              <TableHead
                key={i}
                className={cn(
                  "h-auto px-2 py-1.5 align-bottom leading-tight",
                  c.align === "right" && "text-right",
                  divCls(i)
                )}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.rows.map((row) => (
            <TableRow
              key={row.date}
              className={cn(!row.synced && "opacity-45")}
            >
              {COLS.map((c, i) => {
                const events = c.drill ? DRILL_EVENTS[c.drill](row) : []
                const clickable = c.drill && events.length > 0
                const isActive =
                  drill?.date === row.date && drill?.kind === c.drill
                return (
                  <TableCell
                    key={i}
                    className={cn(
                      "px-2 py-1.5 whitespace-nowrap",
                      c.align === "right" && "text-right tabular-nums",
                      c.cls,
                      divCls(i)
                    )}
                  >
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() =>
                          onDrill(
                            isActive
                              ? null
                              : { date: row.date, kind: c.drill as DrillKind }
                          )
                        }
                        className={cn(
                          "-mx-1 rounded px-1 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid",
                          isActive && "bg-foreground/10 no-underline"
                        )}
                        title="Bấm để xem hội thoại làm mất điểm"
                      >
                        {c.cell(row)}
                      </button>
                    ) : (
                      c.cell(row)
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow className="hover:bg-transparent">
            {COLS.map((c, i) => (
              <TableCell
                key={i}
                className={cn(
                  "px-2 py-1.5 font-semibold whitespace-nowrap",
                  c.align === "right" && "text-right tabular-nums",
                  i === 0 && "font-semibold",
                  divCls(i)
                )}
              >
                {i === 0
                  ? `Tổng ${rangeText(data).toLowerCase()}`
                  : c.total(data.totals)}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
      </div>

      {drill && drillRow ? (
        <div className="border-t">
          <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-2">
            <p className="text-sm font-medium">
              {data.staffName}
              <span className="mx-1.5 text-muted-foreground">·</span>
              {vnDate(drill.date)}
              <span className="mx-1.5 text-muted-foreground">·</span>
              {DRILL_LABEL[drill.kind]}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDrill(null)}
            >
              <XIcon />
            </Button>
          </div>
          <div className="p-3">
            <OffenderList events={DRILL_EVENTS[drill.kind](drillRow)} />
          </div>
        </div>
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
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function DailyLogView() {
  const { user } = useAuth()
  const [staff, setStaff] = React.useState(STAFF[0].key)
  const [dateRange, setDateRange] = React.useState<RangeValue>({
    range: "thisMonth",
  })
  const [shift, setShift] = React.useState<ShiftKey>("all")
  const [page, setPage] = React.useState<PageKey>("all")

  const [data, setData] = React.useState<DailyLogResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [drill, setDrill] = React.useState<Drill>(null)

  const load = React.useCallback(() => {
    if (!user) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setDrill(null)
    fetchDailyLog({ staff, ...dateRange, shift, page }, controller.signal)
      .then(setData)
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [user, staff, dateRange, shift, page])

  React.useEffect(() => load(), [load])

  const runSync = React.useCallback(
    async (auto = false) => {
      setSyncing(true)
      const vnISO = (ms: number) =>
        new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10)

      if (auto) {
        const id = toast.loading("Đang đồng bộ dữ liệu hôm nay từ Pancake…")
        try {
          await triggerPancakeSync(1)
          toast.success("Đã đồng bộ dữ liệu hôm nay", { id })
          load()
        } catch (cause) {
          toast.error(`Đồng bộ lỗi: ${(cause as Error).message}`, { id })
        } finally {
          setSyncing(false)
        }
        return
      }

      const now = Date.now()
      const fromISO = vnISO(data?.fromMs ?? now - 6 * 86_400_000)
      const toISO = vnISO(Math.min(data?.toMs ?? now, now) - 1)
      const id = toast.loading(
        `Đang đồng bộ ${fromISO} → ${toISO} từ Pancake… (quét hội thoại, có thể vài phút)`
      )
      try {
        const result = await syncPancakeRange(fromISO, toISO, {
          onProgress: (done, total) =>
            toast.loading(`Đồng bộ Pancake — ${done}/${total} ngày…`, { id }),
        })
        const crawled = result.days.reduce((s, d) => s + d.convsCrawled, 0)
        if (result.incomplete.length > 0) {
          toast.warning(
            `Đồng bộ xong phần lớn (${crawled} hội thoại) nhưng ${result.incomplete.length} ngày còn dữ liệu chưa lấy hết (giai đoạn quá xa/quá nhiều hội thoại) — bấm "Đồng bộ ngay" lại để lấy tiếp.`,
            { id }
          )
        } else {
          toast.success(
            `Đồng bộ xong ${result.days.length} ngày · ${crawled} hội thoại`,
            { id }
          )
        }
        load()
      } catch (cause) {
        toast.error(`Đồng bộ lỗi: ${(cause as Error).message}`, { id })
      } finally {
        setSyncing(false)
      }
    },
    [data, load]
  )

  // auto-sync today once on open (5-min cooldown shared with the scorecard view)
  const autoSyncTried = React.useRef(false)
  React.useEffect(() => {
    if (!user || autoSyncTried.current) return
    autoSyncTried.current = true
    if (!autoSyncedRecently()) {
      markAutoSynced()
      void runSync(true)
    }
  }, [user, runSync])

  const pageOptions = React.useMemo(
    () => [
      { value: "all", label: "Cả 2 page" },
      ...(data?.pages.map((p) => ({ value: p.id, label: p.name })) ?? []),
    ],
    [data]
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Chi tiết thang đo</h1>
          <p className="text-sm text-muted-foreground">
            AI quét toàn bộ hội thoại mỗi ngày qua API Pancake. Chọn nhân viên để
            tra soát từng ngày. Rep chậm = 3–15′ · Bỏ sót = &gt; 15′ hoặc không
            trả lời · một hội thoại chỉ tính 1 lỗi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={staff}
            onChange={setStaff}
            options={STAFF_OPTIONS}
            width="w-28"
          />
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

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading && !data ? (
        <Skeleton className="h-96 w-full" />
      ) : null}

      {data ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {data.staffName} ·{" "}
              <span className="font-normal text-muted-foreground">
                {rangeText(data)} ·{" "}
                {SHIFT_OPTIONS.find((o) => o.value === shift)?.label} ·{" "}
                {pageOptions.find((o) => o.value === page)?.label}
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {data.lastSyncedAtMs
                ? `Đồng bộ lúc ${formatDateTime(data.lastSyncedAtMs)}`
                : "Chưa có dữ liệu đồng bộ"}
              {data.missingDays.length
                ? ` · ${data.missingDays.length} ngày chưa đồng bộ (mờ)`
                : ""}
            </p>
          </CardHeader>
          <CardContent>
            <LogTable data={data} drill={drill} onDrill={setDrill} />
            <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
              <p>
                <strong>Tổng hội thoại</strong> = số khách có nhắn tin mà nhân
                viên này đã trả lời (1 khách = 1 hội thoại).{" "}
                <strong>Rep đúng hạn</strong> = trả lời tin khách trong ≤ 3 phút.
              </p>
              <p>
                Hội thoại có tag <em>Demo</em> (mọi biến thể: HDemo, DDemo,
                demo trl…), <em>Thông điệp</em>, <em>Hẹn</em>, <em>Khách rác</em>{" "}
                hoặc <em>Đã chốt</em> (khách chỉ nhắn một câu cảm ơn cuối) và
                tin khách nhắn trong khung <strong>0h–8h sáng</strong> (ngoài
                giờ trực) <strong>vẫn tính vào Tổng hội thoại</strong>, nhưng{" "}
                <strong>không tính</strong> vào Rep đúng hạn / Rep chậm / Bỏ
                sót. Tin được Botcake trả lời trong 20 phút cũng không tính là
                nhân viên bỏ sót.
              </p>
              <p>
                <strong>Ca</strong> &amp; <strong>Số giờ làm</strong> = suy từ
                hoạt động Pancake trong ngày (tin nhắn + tạo đơn): từ lần sớm
                nhất đến muộn nhất.
              </p>
              <p>
                <strong>Tag đúng / sai</strong> = xét hội thoại có đơn chốt hoặc
                có tag <em>Đã chốt</em>: phải có tag <em>Đã chốt</em>, và{" "}
                <em>Đã chốt</em> phải đi kèm <em>Tiềm năng</em> — trừ khi có{" "}
                <em>Demo</em> bên cạnh thì không cần Tiềm năng.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
