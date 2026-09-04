/**
 * Work-tracking domain types + pure helpers. No React, no Firebase, no
 * server-only imports — shared by the API route and the client.
 *
 * The shapes here are what `/api/pancake/work-tracking` returns: one evaluated
 * row per tracked staff member, already aggregated across the selected pages.
 */

import type { CriterionResult, Rating } from "./scoring"

export type { CriterionResult, Rating, Score, ScoreEvent } from "./scoring"
export {
  CRITERIA,
  GROUP_LABEL,
  RATING_ORDER,
  SCORE_LABEL,
  ratingFor,
} from "./scoring"

// ---------------------------------------------------------------- filters

export type RangeKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "thisMonth"
  | "7d"
  | "30d"

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Hôm nay",
  yesterday: "Hôm qua",
  thisWeek: "Tuần này",
  thisMonth: "Tháng này",
  "7d": "7 ngày qua",
  "30d": "30 ngày qua",
}

export const RANGE_OPTIONS = (Object.keys(RANGE_LABELS) as RangeKey[]).map(
  (value) => ({ value, label: RANGE_LABELS[value] })
)

export type ShiftKey = "all" | "sang" | "chieu" | "toi"

/** Shift windows in Vietnam local hours: [startHour, endHour). */
export const SHIFTS: Record<
  Exclude<ShiftKey, "all">,
  { label: string; start: number; end: number }
> = {
  sang: { label: "Sáng (8–13h)", start: 8, end: 13 },
  chieu: { label: "Chiều (13–19h)", start: 13, end: 19 },
  toi: { label: "Tối (19–24h)", start: 19, end: 24 },
}

export const SHIFT_OPTIONS: { value: ShiftKey; label: string }[] = [
  { value: "all", label: "Cả ngày" },
  { value: "sang", label: SHIFTS.sang.label },
  { value: "chieu", label: SHIFTS.chieu.label },
  { value: "toi", label: SHIFTS.toi.label },
]

export type PageKey = "all" | string // "all" or a shop id

// ---------------------------------------------------------------- report

export type StaffEvaluation = {
  key: string
  name: string
  unconfirmed: boolean
  criteria: CriterionResult[]
  total: number | null
  outOf: number
  rating: Rating
  /** raw numbers behind the criteria, for the detail tabs */
  detail: {
    ordersTotal: number
    ordersClosed: number
    revenue: number
    convHandled: number
    replies: number
    onTime: number
    slow: number
    missed: number
    sampled: number
    demoConversations: number
    demoClosed: number
  }
}

export type WorkReport = {
  fromMs: number
  toMs: number
  generatedAtMs: number
  range: RangeKey
  shift: ShiftKey
  page: PageKey
  pages: { id: string; name: string }[]
  staff: StaffEvaluation[]
  /** how many conversations were message-crawled for response times */
  responseSampleSize: number
  /** epoch ms of the most recent day-sync feeding this report, or null */
  lastSyncedAtMs: number | null
  /** ISO dates in the range with no synced data yet */
  missingDays: string[]
  warnings: string[]
}

// ------------------------------------------------ daily sync aggregate (Firestore)

export type ShiftBucketKey = "sang" | "chieu" | "toi" | "ngoai"

export const SHIFT_BUCKET_KEYS: ShiftBucketKey[] = [
  "sang",
  "chieu",
  "toi",
  "ngoai",
]

/** Which shift bucket a Vietnam-local hour falls in. */
export function shiftBucketOf(ms: number): ShiftBucketKey {
  const h = vnHour(ms)
  if (h >= 8 && h < 13) return "sang"
  if (h >= 13 && h < 19) return "chieu"
  if (h >= 19 && h < 24) return "toi"
  return "ngoai"
}

/** Which buckets a ShiftKey filter selects. */
export function bucketsForShift(shift: ShiftKey): ShiftBucketKey[] {
  return shift === "all" ? SHIFT_BUCKET_KEYS : [shift]
}

export type ScoreEventLite = { atMs: number; label: string; detail?: string }

/** One (shop × staff × shift) cell for one day. */
export type AgentDayBucket = {
  ordersTotal: number
  ordersClosed: number
  revenue: number
  demoClosed: number
  convHandled: number
  demoConversations: number
  replied: number
  onTime: number
  slow: number
  missed: number
  slowEvents: ScoreEventLite[]
  missedEvents: ScoreEventLite[]
  /** activity signals (staff messages + "seen") in this shift */
  activityHits: number
  /** earliest / latest activity ms in this shift (0 = none) */
  firstActivityMs: number
  lastActivityMs: number
  /** tag rule check (criterion 6) */
  tagChecked: number
  tagCorrect: number
  tagWrong: number
  tagWrongEvents: ScoreEventLite[]
}

export function emptyBucket(): AgentDayBucket {
  return {
    ordersTotal: 0,
    ordersClosed: 0,
    revenue: 0,
    demoClosed: 0,
    convHandled: 0,
    demoConversations: 0,
    replied: 0,
    onTime: 0,
    slow: 0,
    missed: 0,
    slowEvents: [],
    missedEvents: [],
    activityHits: 0,
    firstActivityMs: 0,
    lastActivityMs: 0,
    tagChecked: 0,
    tagCorrect: 0,
    tagWrong: 0,
    tagWrongEvents: [],
  }
}

function mergeFirst(a: number, b: number) {
  if (!a) return b
  if (!b) return a
  return Math.min(a, b)
}

export function addBucket(into: AgentDayBucket, from: AgentDayBucket) {
  into.ordersTotal += from.ordersTotal
  into.ordersClosed += from.ordersClosed
  into.revenue += from.revenue
  into.demoClosed += from.demoClosed
  into.convHandled += from.convHandled
  into.demoConversations += from.demoConversations
  into.replied += from.replied
  into.onTime += from.onTime
  into.slow += from.slow
  into.missed += from.missed
  into.slowEvents.push(...from.slowEvents)
  into.missedEvents.push(...from.missedEvents)
  into.activityHits += from.activityHits
  into.firstActivityMs = mergeFirst(into.firstActivityMs, from.firstActivityMs)
  into.lastActivityMs = Math.max(into.lastActivityMs, from.lastActivityMs)
  into.tagChecked += from.tagChecked
  into.tagCorrect += from.tagCorrect
  into.tagWrong += from.tagWrong
  into.tagWrongEvents.push(...from.tagWrongEvents)
}

/** Register an activity instant into a bucket. */
export function markActivity(bucket: AgentDayBucket, atMs: number) {
  if (!atMs) return
  bucket.activityHits += 1
  bucket.firstActivityMs = mergeFirst(bucket.firstActivityMs, atMs)
  bucket.lastActivityMs = Math.max(bucket.lastActivityMs, atMs)
}

/**
 * Standard tags for criterion 6. Match Pancake tag text case-insensitively.
 * (User rules, 04/09/2026.)
 */
export const TAG_NAMES = {
  tiemNang: "tiềm năng",
  daChot: "đã chốt",
  demo: "demo",
} as const

export const SHIFT_BUCKET_LABEL: Record<ShiftBucketKey, string> = {
  sang: "Sáng",
  chieu: "Chiều",
  toi: "Tối",
  ngoai: "Ngoài ca",
}

/** shopId -> staffKey -> shiftBucket -> metrics */
export type BucketTree = Record<
  string,
  Record<string, Partial<Record<ShiftBucketKey, AgentDayBucket>>>
>

/**
 * Firestore doc at `pancakeAgentDaily/{date}` (date = `YYYY-MM-DD`, VN).
 *
 * `orderData` is recomputed from scratch on every sync (orders are cheap and
 * their status changes). `inboxData` is ACCUMULATED — each sync only crawls
 * conversations not already in `processedConvIds` and merges them in — so
 * re-syncing a busy day never drops what an earlier run captured.
 * Read code merges the two trees per cell.
 */
export type AgentDayDoc = {
  date: string
  syncedAtMs: number
  convsCrawled: number
  partial: boolean
  shops: { id: string; name: string }[]
  orderData: BucketTree
  inboxData: BucketTree
  processedConvIds: string[]
  warnings: string[]
}

/** Merge every cell of `orderData` + `inboxData` into one bucket tree. */
export function mergeDayDoc(doc: AgentDayDoc): BucketTree {
  const out: BucketTree = {}
  for (const tree of [doc.orderData, doc.inboxData]) {
    for (const [shopId, byStaff] of Object.entries(tree ?? {})) {
      const outShop = (out[shopId] ??= {})
      for (const [staffKey, byShift] of Object.entries(byStaff)) {
        const outStaff = (outShop[staffKey] ??= {})
        for (const [sb, cell] of Object.entries(byShift) as [
          ShiftBucketKey,
          AgentDayBucket,
        ][]) {
          const target = (outStaff[sb] ??= emptyBucket())
          addBucket(target, { ...emptyBucket(), ...cell })
        }
      }
    }
  }
  return out
}

/** `YYYY-MM-DD` for each Vietnam calendar day overlapping [fromMs, toMs). */
export function vnDatesInRange(fromMs: number, toMs: number): string[] {
  const out: string[] = []
  let cursor = Math.floor((fromMs + VN_OFFSET_MS) / DAY) * DAY - VN_OFFSET_MS
  while (cursor < toMs) {
    const d = new Date(cursor + VN_OFFSET_MS)
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`
    )
    cursor += DAY
  }
  return out
}

/** [fromMs, toMs) for a `YYYY-MM-DD` Vietnam calendar day. */
export function vnDayRange(dateISO: string): { fromMs: number; toMs: number } {
  const [y, m, d] = dateISO.split("-").map(Number)
  const fromMs = Date.UTC(y, m - 1, d) - VN_OFFSET_MS
  return { fromMs, toMs: fromMs + DAY }
}

// ---------------------------------------------- daily log (view 2, sheet style)

/** One row of the "Nhật ký AI rà soát theo ngày" table, for one staff member. */
export type DailyLogRow = {
  date: string
  /** shifts the person had activity in that day, e.g. "Sáng, Chiều" or "—" */
  shift: string
  /** hours from first to last activity that day, or null if no activity */
  hoursWorked: number | null
  totalConversations: number
  replyOnTime: number
  replySlow: number
  missed: number
  tagCorrect: number
  tagWrong: number
  demoCustomers: number
  demoClosed: number
  ordersClosed: number
  note: string
  synced: boolean
  partial: boolean
}

export type DailyLogTotals = {
  daysWorked: number
  hoursWorked: number
  totalConversations: number
  replyOnTime: number
  replySlow: number
  missed: number
  tagCorrect: number
  tagWrong: number
  demoCustomers: number
  demoClosed: number
  ordersClosed: number
}

export type DailyLogResponse = {
  staffKey: string
  staffName: string
  range: RangeKey
  shift: ShiftKey
  page: PageKey
  pages: { id: string; name: string }[]
  rows: DailyLogRow[]
  totals: DailyLogTotals
  missingDays: string[]
  lastSyncedAtMs: number | null
}

// ---------------------------------------------------------------- date ranges

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY = 86_400_000

function vnParts(ms: number) {
  const d = new Date(ms + VN_OFFSET_MS)
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(), // 0 = Sun
    hour: d.getUTCHours(),
  }
}

/** Vietnam-local hour (0–23) of an instant. */
export function vnHour(ms: number): number {
  return vnParts(ms).hour
}

/** epoch ms of Vietnam-local midnight `daysAgo` days back. */
function vnMidnight(daysAgo: number): number {
  const today = Math.floor((Date.now() + VN_OFFSET_MS) / DAY) * DAY - VN_OFFSET_MS
  return today - daysAgo * DAY
}

export function resolveRange(key: RangeKey): { fromMs: number; toMs: number } {
  const now = Date.now()
  switch (key) {
    case "today":
      return { fromMs: vnMidnight(0), toMs: now }
    case "yesterday":
      return { fromMs: vnMidnight(1), toMs: vnMidnight(0) }
    case "7d":
      return { fromMs: vnMidnight(6), toMs: now }
    case "30d":
      return { fromMs: vnMidnight(29), toMs: now }
    case "thisWeek": {
      const wd = (vnParts(now).weekday + 6) % 7 // Mon = 0
      return { fromMs: vnMidnight(wd), toMs: now }
    }
    case "thisMonth":
      return { fromMs: vnMidnight(vnParts(now).day - 1), toMs: now }
  }
}

/** Is this instant inside the selected shift (Vietnam local)? */
export function inShift(ms: number, shift: ShiftKey): boolean {
  if (shift === "all") return true
  const { start, end } = SHIFTS[shift]
  const h = vnHour(ms)
  return h >= start && h < end
}

// ---------------------------------------------------------------- formatting

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

export function formatDateTime(ms: number): string {
  if (!ms) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(ms))
}

export function formatPercent(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`
}
