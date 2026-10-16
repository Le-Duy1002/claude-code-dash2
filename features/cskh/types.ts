/**
 * "Chăm sóc khách hàng" — the Hẻm Trong Đường - Xem riêng page. Domain types +
 * pure helpers. No React, no Firebase.
 *
 * Definitions (user, 15/10/2026):
 *  - Khách xem (per staff) = Pancake's own daily count of that staff's name
 *    tag ("Duy" / "Kỳ" / "Thắng" / "Thương"): net gắn − gỡ, the same number
 *    Pancake's "Thẻ hội thoại" screen shows, so one day can be negative.
 *  - Khách chốt = a conversation carrying both "Chốt sale" and a staff name
 *    tag, counted for that staff. Pancake keeps no per-conversation tag
 *    history and old customers get re-touched constantly, so the sync first
 *    records every conversation that ALREADY has "Chốt sale" (the baseline,
 *    one walk of the whole page), and from then on dates each newly tagged
 *    one when it first sees it. Before `closedTrackedFrom` only Tổng has a
 *    khách chốt figure — Pancake's own daily "Chốt sale" count (Pancake
 *    can't attribute it, so the staff split / giá / AOV show "—").
 *  - Giá bản luận and the payments are entered by hand per closed customer;
 *    each payment carries its own date and "Đã trả" sums payments by it.
 *  - AOV = tổng giá bản luận / số khách chốt; tỉ lệ chốt = khách chốt / khách xem.
 */

export const CSKH_PAGE_ID = "107787658355222"
export const CSKH_PAGE_NAME = "Hẻm Trong Đường - Xem riêng"

/** Tag (normalised, see `normTag`) that marks a closed customer. */
export const CSKH_CLOSED_TAG = "chốt sale"

/** Staff columns, in display order; `tag` is their name tag, normalised. */
export const CSKH_STAFF: { key: string; name: string; tag: string }[] = [
  { key: "duy", name: "Duy", tag: "duy" },
  { key: "ky", name: "Kỳ", tag: "kỳ" },
  { key: "thang", name: "Thắng", tag: "thắng" },
  { key: "thuong", name: "Thương", tag: "thương" },
]

const STAFF_NAME = new Map(CSKH_STAFF.map((s) => [s.key, s.name]))

export function cskhStaffName(key: string | null | undefined): string {
  return (key && STAFF_NAME.get(key)) || "Chưa gán"
}

/** Tag text as compared: NFC, trimmed, lowercased. */
export function normTag(text: string): string {
  return text.normalize("NFC").trim().toLowerCase()
}

/** The first staff whose name tag is among `tags` (normalised), or null. */
export function staffKeyFromTags(tags: string[]): string | null {
  const set = new Set(tags.map(normTag))
  return CSKH_STAFF.find((s) => set.has(s.tag))?.key ?? null
}

// ------------------------------------------------------------ records

/**
 * What a received payment is, for Thống kê doanh thu: paid as part of the
 * close ("chot"), or paying off an earlier month's debt ("no"). Revenue is
 * always counted on the day the money came in (`date`); a debt payment also
 * says which month the debt is from (`debtMonth`).
 */
export type CskhPaymentKind = "chot" | "no"

export const PAYMENT_KIND_LABELS: Record<CskhPaymentKind, string> = {
  chot: "Khách chốt trả",
  no: "Trả nợ",
}

export type CskhPayment = {
  id: string
  amount: number
  /** `YYYY-MM-DD`, the day the money was received */
  date: string
  kind: CskhPaymentKind
  /** `YYYY-MM` the debt is from — only for `kind === "no"` */
  debtMonth: string | null
}

/**
 * One customer — `cskhCustomers/{id}`. Normally a conversation the sync saw
 * get "Chốt sale" (id = Pancake conversation id). A `legacy` one was added by
 * hand to record debt payments from a customer closed before tracking started
 * (id = the conversation id when a link was given, else generated); it never
 * counts as khách chốt.
 */
export type CskhCustomer = {
  id: string
  pageId: string
  customerName: string
  staffKey: string | null
  /** staff was picked by hand — the sync no longer follows the name tag */
  staffManual: boolean
  /** `YYYY-MM-DD` the customer counts as closed on; "" for `legacy` */
  closedDate: string
  /** added by hand for an old customer's debt (see type doc) */
  legacy: boolean
  /** `YYYY-MM` an old customer's debt is from — `legacy` only */
  debtMonth: string | null
  /** giá bản luận, null until entered */
  price: number | null
  payments: CskhPayment[]
  /** the conversation's current tags, as Pancake shows them */
  tags: string[]
  /** "Chốt sale" was taken off the conversation after it was recorded */
  tagRemoved: boolean
  updatedAtMs: number
  updatedByName: string | null
}

/** Fields a person may edit on a record. */
export type CskhCustomerPatch = Partial<{
  staffKey: string | null
  closedDate: string
  price: number | null
  payments: CskhPayment[]
}>

export type CskhReport = {
  fromMs: number
  toMs: number
  /** every Vietnam day in the range, oldest first */
  dates: string[]
  /** date -> staff key -> khách xem (Pancake's net name-tag count) */
  views: Record<string, Record<string, number>>
  /** closed in range, paid in range, or still owing */
  customers: CskhCustomer[]
  /** first day khách chốt is tracked (`YYYY-MM-DD`), null until the baseline is done */
  closedTrackedFrom: string | null
  /** date -> Pancake's own net "Chốt sale" count — Tổng khách chốt before tracking */
  pancakeClosed: Record<string, number>
  lastSyncedAtMs: number | null
  warnings: string[]
}

export type CskhSyncResult = {
  /** "baseline" while still recording the already-closed conversations */
  phase: "baseline" | "sync"
  scanned: number
  created: number
  updated: number
  /** baseline: the whole page has been walked (tracking starts now) */
  baselineDone: boolean
  /** the walk stopped before reaching the start of the window */
  truncated: boolean
}

/** Input for "Thêm khách trả nợ" — an old customer paying off a debt. */
export type CskhDebtorInput = {
  customerName: string
  /** Pancake conversation link or id, optional */
  conversation?: string | null
  staffKey: string | null
  /** `YYYY-MM` the debt is from */
  debtMonth: string
  price?: number | null
  /** the first debt payment */
  amount: number
  date: string
}

/**
 * A "Tìm khách" result: a customer already in the app, or a Pancake
 * conversation that isn't (an old customer — paying a debt adds them).
 */
export type CskhSearchHit =
  | { kind: "record"; customer: CskhCustomer }
  | {
      kind: "pancake"
      conversationId: string
      customerName: string
      /** from the conversation's staff name tag, if any */
      staffKey: string | null
      tags: string[]
      updatedAtMs: number
    }

/** Name as compared in search: no accents, đ→d, lowercase, single spaces. */
export function foldName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const ISO_MONTH = /^\d{4}-\d{2}$/

/** A conversation id from a Pancake link (`…?c_id=<id>`) or a bare id. */
export function parseConversationRef(text: string | null | undefined): string | null {
  const value = (text ?? "").trim()
  if (!value) return null
  const fromLink = /[?&]c_id=([^&#\s]+)/.exec(value)
  const id = fromLink ? decodeURIComponent(fromLink[1]) : value
  return /^\d+_\d+$/.test(id) ? id : null
}

/** Default kind for a payment received on `date` from `customer`. */
export function suggestPaymentKind(
  customer: Pick<CskhCustomer, "legacy" | "closedDate">,
  date: string
): CskhPaymentKind {
  return !customer.legacy && date === customer.closedDate ? "chot" : "no"
}

/** Default debt month for a customer's debt payment. */
export function defaultDebtMonth(
  customer: Pick<CskhCustomer, "legacy" | "closedDate" | "debtMonth">
): string | null {
  if (customer.legacy) return customer.debtMonth
  return customer.closedDate ? customer.closedDate.slice(0, 7) : null
}

function tsToMs(value: unknown): number {
  if (typeof value === "number") return value
  if (
    value &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis()
  }
  return 0
}

/** Map a raw `cskhCustomers/{id}` document. SDK-agnostic. */
export function mapCskhCustomer(
  id: string,
  data: Record<string, unknown>
): CskhCustomer {
  const base = {
    legacy: Boolean(data.legacy),
    closedDate: String(data.closedDate ?? ""),
    debtMonth:
      typeof data.debtMonth === "string" && ISO_MONTH.test(data.debtMonth)
        ? data.debtMonth
        : null,
  }
  const payments = Array.isArray(data.payments)
    ? (data.payments as Partial<CskhPayment>[])
        .filter(
          (p) =>
            p &&
            typeof p.id === "string" &&
            Number.isFinite(Number(p.amount)) &&
            typeof p.date === "string" &&
            ISO_DATE.test(p.date)
        )
        .map((p) => {
          const kind: CskhPaymentKind =
            p.kind === "chot" || p.kind === "no"
              ? p.kind
              : suggestPaymentKind(base, p.date!)
          return {
            id: p.id!,
            amount: Number(p.amount),
            date: p.date!,
            kind,
            debtMonth:
              kind === "no"
                ? typeof p.debtMonth === "string" && ISO_MONTH.test(p.debtMonth)
                  ? p.debtMonth
                  : defaultDebtMonth(base)
                : null,
          }
        })
    : []
  return {
    id,
    pageId: String(data.pageId ?? CSKH_PAGE_ID),
    customerName: String(data.customerName ?? "Khách"),
    staffKey: (data.staffKey as string) ?? null,
    staffManual: Boolean(data.staffManual),
    ...base,
    price:
      data.price == null || !Number.isFinite(Number(data.price))
        ? null
        : Number(data.price),
    payments,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    tagRemoved: Boolean(data.tagRemoved),
    updatedAtMs: tsToMs(data.updatedAt),
    updatedByName: (data.updatedByName as string) ?? null,
  }
}

export function paidTotal(customer: CskhCustomer): number {
  return customer.payments.reduce((sum, p) => sum + p.amount, 0)
}

/** Còn nợ — price minus payments, never below 0; null without a price. */
export function outstanding(customer: CskhCustomer): number | null {
  if (customer.price == null) return null
  return Math.max(0, customer.price - paidTotal(customer))
}

/**
 * Should this record show for `[fromDate, toDate]`? Closed in it, paid in it,
 * or still owing — and an old customer with no price yet stays until paid.
 */
export function isRelevant(
  customer: CskhCustomer,
  fromDate: string,
  toDate: string
): boolean {
  const inRange = (d: string) => d >= fromDate && d <= toDate
  if (inRange(customer.closedDate)) return true
  if (customer.payments.some((p) => inRange(p.date))) return true
  if (customer.legacy && customer.price == null) {
    return customer.payments.length === 0
  }
  return (outstanding(customer) ?? 0) > 0
}

// ------------------------------------------------------------ metrics

export type CskhMetrics = {
  viewed: number
  /** khách xem on the days whose khách chốt is known — what tỉ lệ chốt divides by */
  viewedForRate: number
  /**
   * khách chốt: from tracked records — or, for Tổng on a day before
   * tracking, Pancake's own daily "Chốt sale" count
   */
  closed: number
  /** khách chốt from tracked records only — what AOV divides by */
  closedTracked: number
  /** tổng giá bản luận */
  price: number
  /** đã trả */
  paid: number
  /** some summed day has a khách chốt figure for this group */
  closedKnown: boolean
  /** some summed day is on/after `closedTrackedFrom` — giá bản luận / AOV exist */
  tracked: boolean
}

/** Column group key: the total, or a staff key. */
export const CSKH_TOTAL = "total"

export const CSKH_GROUPS: { key: string; name: string }[] = [
  { key: CSKH_TOTAL, name: "Tổng" },
  ...CSKH_STAFF.map((s) => ({ key: s.key, name: s.name })),
]

export function emptyMetrics(): CskhMetrics {
  return {
    viewed: 0,
    viewedForRate: 0,
    closed: 0,
    closedTracked: 0,
    price: 0,
    paid: 0,
    closedKnown: false,
    tracked: false,
  }
}

export function aov(m: CskhMetrics): number | null {
  return m.tracked && m.closedTracked > 0 ? m.price / m.closedTracked : null
}

/** Percent, or null with no khách xem / no khách chốt figure. */
export function closeRate(m: CskhMetrics): number | null {
  return m.closedKnown && m.viewedForRate > 0
    ? (m.closed / m.viewedForRate) * 100
    : null
}

/** date -> group -> metrics */
export type CskhDaily = Map<string, Record<string, CskhMetrics>>

/**
 * Per-day metrics for every group over `report.dates`. On a day before
 * tracking only Tổng has a khách chốt figure (Pancake's "Chốt sale" count);
 * the staff split, giá bản luận and AOV start with tracking.
 */
export function dailyMetrics(report: CskhReport): CskhDaily {
  const out: CskhDaily = new Map()
  const from = report.closedTrackedFrom
  for (const date of report.dates) {
    const tracked = from != null && date >= from
    const row: Record<string, CskhMetrics> = {}
    for (const g of CSKH_GROUPS) {
      row[g.key] = { ...emptyMetrics(), tracked, closedKnown: tracked }
    }
    for (const s of CSKH_STAFF) {
      const v = report.views[date]?.[s.key] ?? 0
      row[s.key].viewed += v
      row[CSKH_TOTAL].viewed += v
    }
    const pancakeClosed = report.pancakeClosed[date]
    if (!tracked && pancakeClosed != null) {
      row[CSKH_TOTAL].closed = pancakeClosed
      row[CSKH_TOTAL].closedKnown = true
    }
    for (const g of CSKH_GROUPS) {
      if (row[g.key].closedKnown) row[g.key].viewedForRate = row[g.key].viewed
    }
    out.set(date, row)
  }
  // a customer with no staff (no name tag, none picked) counts nowhere — from
  // tracking on, the total is exactly the sum of the staff columns
  const groupsOf = (c: CskhCustomer) =>
    c.staffKey && STAFF_NAME.has(c.staffKey) ? [CSKH_TOTAL, c.staffKey] : []
  for (const c of report.customers) {
    const closedRow = out.get(c.closedDate)
    if (closedRow && !c.tagRemoved && closedRow[CSKH_TOTAL].tracked) {
      for (const g of groupsOf(c)) {
        closedRow[g].closed += 1
        closedRow[g].closedTracked += 1
        closedRow[g].price += c.price ?? 0
      }
    }
    for (const p of c.payments) {
      const paidRow = out.get(p.date)
      if (!paidRow) continue
      for (const g of groupsOf(c)) paidRow[g].paid += p.amount
    }
  }
  return out
}

/** Sum of `daily` over `dates`, per group. */
export function sumMetrics(
  daily: CskhDaily,
  dates: string[]
): Record<string, CskhMetrics> {
  const out: Record<string, CskhMetrics> = {}
  for (const g of CSKH_GROUPS) out[g.key] = emptyMetrics()
  for (const date of dates) {
    const row = daily.get(date)
    if (!row) continue
    for (const g of CSKH_GROUPS) {
      const m = out[g.key]
      const r = row[g.key]
      m.viewed += r.viewed
      m.viewedForRate += r.viewedForRate
      m.closed += r.closed
      m.closedTracked += r.closedTracked
      m.price += r.price
      m.paid += r.paid
      m.closedKnown ||= r.closedKnown
      m.tracked ||= r.tracked
    }
  }
  return out
}

/** Payments falling on `dates` for a group, newest first. */
export function paymentsIn(
  customers: CskhCustomer[],
  dates: string[],
  group: string
): (CskhPayment & { customerName: string; staffKey: string | null })[] {
  const set = new Set(dates)
  const out: (CskhPayment & { customerName: string; staffKey: string | null })[] =
    []
  for (const c of customers) {
    if (!c.staffKey || !STAFF_NAME.has(c.staffKey)) continue
    if (group !== CSKH_TOTAL && c.staffKey !== group) continue
    for (const p of c.payments) {
      if (set.has(p.date)) {
        out.push({ ...p, customerName: c.customerName, staffKey: c.staffKey })
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

// ------------------------------------------------------------ revenue

/** One received payment and whose it is — a line of Thống kê doanh thu. */
export type CskhReceipt = CskhPayment & {
  customerId: string
  customerName: string
  staffKey: string | null
}

/**
 * Every payment received on one of `dates`, all staff (a customer with no
 * staff still brought the money in), newest first.
 */
export function receiptsIn(
  customers: CskhCustomer[],
  dates: string[]
): CskhReceipt[] {
  const set = new Set(dates)
  const out: CskhReceipt[] = []
  for (const c of customers) {
    for (const p of c.payments) {
      if (!set.has(p.date)) continue
      out.push({
        ...p,
        customerId: c.id,
        customerName: c.customerName,
        staffKey: c.staffKey,
      })
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Money received, by kind. */
export type CskhRevenue = { chot: number; no: number }

/** date -> money received that day, over `dates`. */
export function dailyRevenue(
  customers: CskhCustomer[],
  dates: string[]
): Map<string, CskhRevenue> {
  const out = new Map<string, CskhRevenue>()
  for (const date of dates) out.set(date, { chot: 0, no: 0 })
  for (const c of customers) {
    for (const p of c.payments) {
      const row = out.get(p.date)
      if (row) row[p.kind] += p.amount
    }
  }
  return out
}

export function sumRevenue(
  daily: Map<string, CskhRevenue>,
  dates: string[]
): CskhRevenue {
  const out: CskhRevenue = { chot: 0, no: 0 }
  for (const date of dates) {
    const row = daily.get(date)
    if (!row) continue
    out.chot += row.chot
    out.no += row.no
  }
  return out
}

/** Debt payments grouped by the month the debt is from, oldest month first. */
export function debtByMonth(
  receipts: CskhReceipt[]
): { month: string | null; amount: number; count: number }[] {
  const map = new Map<string, { amount: number; count: number }>()
  for (const r of receipts) {
    if (r.kind !== "no") continue
    const key = r.debtMonth ?? ""
    const row = map.get(key) ?? { amount: 0, count: 0 }
    row.amount += r.amount
    row.count += 1
    map.set(key, row)
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({ month: month || null, ...row }))
}

// ------------------------------------------------------------ time tree

export type CskhPeriod = {
  id: string
  level: "month" | "week" | "day"
  label: string
  /** the days this row sums, oldest first */
  dates: string[]
  children: CskhPeriod[]
}

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number)
  return { y, m, d }
}

/** Monday-first weekday (Mon = 0 … Sun = 6). */
function weekdayMon0(iso: string): number {
  const { y, m, d } = parts(iso)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** `"2026-10-05"` → `"05/10"`. */
export function formatDm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** `"2026-09"` → `"T9/2026"`; null → "—". */
export function formatMonth(month: string | null): string {
  if (!month) return "—"
  return `T${Number(month.slice(5, 7))}/${month.slice(0, 4)}`
}

/** `"2026-10-05"` → `"05/10/2026"`. */
export function formatDmy(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/**
 * Month → week → day rows over `dates`. Weeks run Monday–Sunday but are cut
 * at month boundaries, so a month is exactly the sum of its weeks and a week
 * the sum of its days. Week numbers count from the 1st of the month.
 */
export function buildPeriodTree(dates: string[]): CskhPeriod[] {
  const months = new Map<string, string[]>()
  for (const date of dates) {
    const key = date.slice(0, 7)
    months.set(key, [...(months.get(key) ?? []), date])
  }
  return [...months].map(([monthKey, monthDates]) => {
    const { y, m } = parts(`${monthKey}-01`)
    const firstOffset = weekdayMon0(`${monthKey}-01`)
    const weeks = new Map<number, string[]>()
    for (const date of monthDates) {
      const n = Math.floor((parts(date).d - 1 + firstOffset) / 7) + 1
      weeks.set(n, [...(weeks.get(n) ?? []), date])
    }
    return {
      id: monthKey,
      level: "month" as const,
      label: `Tháng ${m}/${y}`,
      dates: monthDates,
      children: [...weeks].map(([n, weekDates]) => ({
        id: `${monthKey}-w${n}`,
        level: "week" as const,
        label: `Tuần ${n} (${formatDm(weekDates[0])}–${formatDm(
          weekDates[weekDates.length - 1]
        )})`,
        dates: weekDates,
        children: weekDates.map((date) => ({
          id: date,
          level: "day" as const,
          label: `${WEEKDAY_SHORT[weekdayMon0(date)]} ${formatDm(date)}`,
          dates: [date],
          children: [],
        })),
      })),
    }
  })
}

// ------------------------------------------------------------ formatting

/** `1250000` → `"1.250.000"`. */
export function formatMoney(value: number | null): string {
  if (value == null) return "—"
  return Math.round(value).toLocaleString("vi-VN")
}

export function formatPct(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1)}%`
}

/** Vietnam calendar day of an instant. */
export function vnDateOf(ms: number): string {
  return new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10)
}

export function formatDateTime(ms: number): string {
  if (!ms) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(ms))
}
