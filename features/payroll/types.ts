/**
 * Payroll domain types + pure calculation. No React, no Firebase, no server
 * imports — shared by the API routes and the client.
 *
 * Model (from docs/hrm/Salary): a payroll period = one calendar month. Each
 * tracked sale staff gets one row. The row's *inputs* (auto-pulled numbers +
 * a few manual entries) are what Firestore stores; everything downstream is
 * derived here via `computeRow` so a locked period stays reproducible from its
 * snapshotted params.
 *
 * Sections mirror the old spreadsheet:
 *   A  lương giờ            — worked hours × rate, final hour of each shift ×2
 *   B  thưởng               — demo bonus (revenue × band %) + fixed bonus
 *   C  trừ hệ số (tần suất)  — reply-on-time %, tag % → deduction %
 *   D  trừ hệ số + phạt tiền — discrete violations, by count
 *   E  thực lĩnh            — (A+B) × hệ số − tiền phạt
 */

import { STAFF } from "@/features/pancake/staff"

export const PAYROLL_STAFF: { key: string; name: string }[] = STAFF.map((s) => ({
  key: s.key,
  name: s.name,
}))

const STAFF_NAME = new Map(PAYROLL_STAFF.map((s) => [s.key, s.name]))

export function payrollStaffName(key: string): string {
  return STAFF_NAME.get(key) || key
}

// ---------------------------------------------------------------- params

/** rate ≥ `minRate` → deduct `pct`. Ordered high→low; last has minRate 0. */
export type RateBand = { minRate: number; pct: number }
/** rate ≤ `maxRate` (null = open top) → bonus `pct`. Ordered low→high. */
export type DemoBand = { maxRate: number | null; pct: number; label: string }
/** [1 lần, 2 lần, 3+ lần] deduction %, plus VND penalty per occurrence. */
export type ViolationRule = { each: number; ladder: [number, number, number] }

export type PayrollParams = {
  hourlyRate: number
  lastHourRate: number
  deductionCapPct: number
  coefficientFloorPct: number
  fixedBonus: number
  demoBands: DemoBand[]
  replyBands: RateBand[]
  tagBands: RateBand[]
  missedInbox: ViolationRule
  lateReport: ViolationRule
  lateShift: ViolationRule
  shortAbsence: ViolationRule
  longAbsence: ViolationRule
}

export const PAYROLL_DEFAULT_PARAMS: PayrollParams = {
  hourlyRate: 25_000,
  lastHourRate: 50_000,
  deductionCapPct: 15,
  coefficientFloorPct: 85,
  fixedBonus: 500_000,
  demoBands: [
    { maxRate: 10, pct: 5, label: "Cơ bản" },
    { maxRate: 20, pct: 10, label: "Trung bình" },
    { maxRate: 30, pct: 18, label: "Khá" },
    { maxRate: 40, pct: 25, label: "Tốt" },
    { maxRate: null, pct: 30, label: "Xuất sắc" },
  ],
  replyBands: [
    { minRate: 95, pct: 0 },
    { minRate: 90, pct: 1 },
    { minRate: 80, pct: 3 },
    { minRate: 0, pct: 5 },
  ],
  tagBands: [
    { minRate: 95, pct: 0 },
    { minRate: 85, pct: 1 },
    { minRate: 70, pct: 3 },
    { minRate: 0, pct: 5 },
  ],
  missedInbox: { each: 50_000, ladder: [1, 3, 5] },
  lateReport: { each: 100_000, ladder: [1, 2, 3] },
  lateShift: { each: 50_000, ladder: [1, 2, 4] },
  shortAbsence: { each: 300_000, ladder: [3, 6, 10] },
  longAbsence: { each: 500_000, ladder: [7, 12, 15] },
}

// ---------------------------------------------------------------- row shapes

export type PayrollStatus = "draft" | "locked"

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: "Nháp",
  locked: "Đã chốt",
}

/** Everything Firestore stores for one staff row. */
export type PayrollRowInput = {
  // --- auto: schedule / giờ công
  hasSchedule: boolean
  countedShifts: number
  expectedHours: number
  paidHours: number
  paidLastHourHours: number
  lateShiftCount: number
  shortAbsenceCount: number
  longAbsenceCount: number
  // --- auto: pancake chấm điểm
  replyOnTimeRate: number | null
  tagRate: number | null
  missedCount: number | null
  demoCloseRate: number | null
  ratingLabel: string
  ratingIsExcellent: boolean
  // --- manual
  demoRevenue: number
  reportLateCount: number
  fixedBonusApproved: boolean
}

export function emptyRowInput(): PayrollRowInput {
  return {
    hasSchedule: false,
    countedShifts: 0,
    expectedHours: 0,
    paidHours: 0,
    paidLastHourHours: 0,
    lateShiftCount: 0,
    shortAbsenceCount: 0,
    longAbsenceCount: 0,
    replyOnTimeRate: null,
    tagRate: null,
    missedCount: null,
    demoCloseRate: null,
    ratingLabel: "Chưa đủ dữ liệu",
    ratingIsExcellent: false,
    demoRevenue: 0,
    reportLateCount: 0,
    fixedBonusApproved: false,
  }
}

/** Fields the manager may edit while a period is a draft. */
export type PayrollManualPatch = Partial<
  Pick<PayrollRowInput, "demoRevenue" | "reportLateCount" | "fixedBonusApproved">
>

export type PayrollPeriod = {
  periodId: string
  year: number
  month: number
  status: PayrollStatus
  /** built mid-month — future days/shifts not counted yet */
  partial: boolean
  builtAtMs: number
  builtByName: string
  lockedAtMs: number | null
  lockedByName: string | null
  /** params in force when built (frozen on lock) */
  paramsUsed: PayrollParams
  rows: Record<string, PayrollRowInput>
  updatedAtMs: number
  warnings: string[]
}

// ---------------------------------------------------------------- calculation

const ONE = <T>(v: T | null | undefined, fallback: T): T =>
  v == null ? fallback : v

export function demoBonusBand(
  rate: number,
  bands: DemoBand[]
): { pct: number; label: string } {
  for (const band of bands) {
    if (band.maxRate == null || rate <= band.maxRate) {
      return { pct: band.pct, label: band.label }
    }
  }
  const last = bands[bands.length - 1]
  return { pct: last?.pct ?? 0, label: last?.label ?? "—" }
}

/** rate% → deduction% from a high→low band list. */
export function rateDeduction(rate: number, bands: RateBand[]): number {
  for (const band of bands) if (rate >= band.minRate) return band.pct
  return 0
}

/** occurrence count → deduction% (or VND when `ladder` holds money). */
export function countStep(count: number, ladder: [number, number, number]): number {
  if (count <= 0) return 0
  if (count === 1) return ladder[0]
  if (count === 2) return ladder[1]
  return ladder[2]
}

export function hourPay(
  paidHours: number,
  paidLastHourHours: number,
  p: PayrollParams
): number {
  const normal = Math.max(0, paidHours - paidLastHourHours)
  return Math.round(normal * p.hourlyRate + paidLastHourHours * p.lastHourRate)
}

export type PayrollComputed = {
  hourPay: number
  demoBonusPct: number
  demoBonusLabel: string
  demoBonus: number
  fixedBonus: number
  grossBeforeDeduction: number
  deductReplyPct: number
  deductTagPct: number
  deductCPct: number
  deductD: {
    missed: number
    report: number
    lateShift: number
    shortAbsence: number
    longAbsence: number
  }
  deductDPct: number
  totalDeductPctRaw: number
  totalDeductPct: number
  coefficientPct: number
  penalty: {
    missed: number
    report: number
    lateShift: number
    shortAbsence: number
    longAbsence: number
    total: number
  }
  netPay: number
  pending: string[]
}

export function computeRow(
  input: PayrollRowInput,
  p: PayrollParams
): PayrollComputed {
  const pending: string[] = []

  const pay = input.hasSchedule
    ? hourPay(input.paidHours, input.paidLastHourHours, p)
    : 0
  if (!input.hasSchedule) pending.push("Giờ công — chưa có lịch chốt cho kỳ")

  const demo = demoBonusBand(ONE(input.demoCloseRate, 0), p.demoBands)
  if (input.demoCloseRate == null) pending.push("Tỷ lệ chốt qua demo")
  const demoBonus = Math.round((input.demoRevenue || 0) * (demo.pct / 100))
  const fixedBonus = input.fixedBonusApproved ? p.fixedBonus : 0
  const grossBeforeDeduction = pay + demoBonus + fixedBonus

  const deductReplyPct =
    input.replyOnTimeRate == null
      ? 0
      : rateDeduction(input.replyOnTimeRate, p.replyBands)
  if (input.replyOnTimeRate == null) pending.push("Tỷ lệ phản hồi đúng hạn")
  const deductTagPct =
    input.tagRate == null ? 0 : rateDeduction(input.tagRate, p.tagBands)
  if (input.tagRate == null) pending.push("Tỷ lệ gán tag")
  const deductCPct = deductReplyPct + deductTagPct

  const missedCount = ONE(input.missedCount, 0)
  if (input.missedCount == null) pending.push("Số hội thoại bỏ sót")

  const deductD = {
    missed: countStep(missedCount, p.missedInbox.ladder),
    report: countStep(input.reportLateCount, p.lateReport.ladder),
    lateShift: countStep(input.lateShiftCount, p.lateShift.ladder),
    shortAbsence: countStep(input.shortAbsenceCount, p.shortAbsence.ladder),
    longAbsence: countStep(input.longAbsenceCount, p.longAbsence.ladder),
  }
  const deductDPct =
    deductD.missed +
    deductD.report +
    deductD.lateShift +
    deductD.shortAbsence +
    deductD.longAbsence

  const totalDeductPctRaw = deductCPct + deductDPct
  const totalDeductPct = Math.min(p.deductionCapPct, totalDeductPctRaw)
  const coefficientPct = Math.max(
    p.coefficientFloorPct,
    100 - totalDeductPct
  )

  const penalty = {
    missed: missedCount * p.missedInbox.each,
    report: input.reportLateCount * p.lateReport.each,
    lateShift: input.lateShiftCount * p.lateShift.each,
    shortAbsence: input.shortAbsenceCount * p.shortAbsence.each,
    longAbsence: input.longAbsenceCount * p.longAbsence.each,
    total: 0,
  }
  penalty.total =
    penalty.missed +
    penalty.report +
    penalty.lateShift +
    penalty.shortAbsence +
    penalty.longAbsence

  const netPay =
    Math.round((grossBeforeDeduction * coefficientPct) / 100) - penalty.total

  return {
    hourPay: pay,
    demoBonusPct: demo.pct,
    demoBonusLabel: demo.label,
    demoBonus,
    fixedBonus,
    grossBeforeDeduction,
    deductReplyPct,
    deductTagPct,
    deductCPct,
    deductD,
    deductDPct,
    totalDeductPctRaw,
    totalDeductPct,
    coefficientPct,
    penalty,
    netPay,
    pending,
  }
}

// ---------------------------------------------------------------- period id / month

export const MONTH_LABELS = Array.from(
  { length: 12 },
  (_, i) => `Tháng ${i + 1}`
)

export function periodId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

export function parsePeriodId(
  id: string
): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(id)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

/** `true` when the month is the current VN month or later (build = partial). */
export function isOngoingMonth(year: number, month: number): boolean {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const cur = now.getUTCFullYear() * 12 + now.getUTCMonth()
  return year * 12 + (month - 1) >= cur
}

// ---------------------------------------------------------------- formatting

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount || 0)) + " đ"
}

export function formatHours(hours: number): string {
  const h = Math.round((hours || 0) * 10) / 10
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`
}

export function formatPct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`
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
