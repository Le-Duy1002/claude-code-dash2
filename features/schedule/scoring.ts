/**
 * Turns the registered schedule + real Pancake activity into the inputs for
 * criteria 1 (Đủ giờ ca) and 2 (Vào ca) of the work-review scoring.
 *
 * Rules (user, 07/09/2026):
 *  - "Đi muộn" = first activity of a shift starts later than the shift's start
 *    hour (Sáng 8h / Chiều 13h / Tối 19h), beyond a small grace.
 *  - "Thiếu giờ" = a registered shift worked for fewer hours than the shift
 *    length (Sáng 5h / Chiều 6h / Tối 5h).
 *  - Cells flagged "đổi ca" (`excludeFromScore`) are skipped entirely.
 * Pure — no React, no Firebase.
 */

import {
  SHIFT_DEFS,
  SHIFT_IDS,
  WEEKDAY_LABELS,
  getCell,
  vnShiftWindowMs,
  weekDates,
  type ScheduleWeek,
  type ShiftId,
} from "./types"

/** First activity later than this many minutes after start = đi muộn. */
export const LATE_GRACE_MIN = 10
/** Worked-hours shortfall under this many hours is ignored (rounding noise). */
export const SHORT_TOLERANCE_HOURS = 0.25

export type ShiftActivity = { firstMs: number; lastMs: number; hits: number }

/** staffKey → `yyyy-mm-dd` → shiftId → activity inside that shift window. */
export type ActivityMap = Record<
  string,
  Record<string, Partial<Record<ShiftId, ShiftActivity>>>
>

export type ScheduleOffender = {
  atMs: number
  /** e.g. "Sáng · Thứ 4 · 06/09" */
  label: string
  /** e.g. "thiếu 2.5h (làm 2.5/5h)" · "muộn 22′" · "bỏ ca" */
  detail: string
}

export type StaffScheduleEval = {
  hasSchedule: boolean
  registeredShifts: number
  countedShifts: number
  excludedShifts: number
  expectedHours: number
  workedHours: number
  /** criterion 1 value — total hours short over the range */
  hoursShort: number
  lateCount: number
  noShowCount: number
  /** criterion 2 value — weighted violations (mỗi lần bỏ ca = 3, muộn = 1) */
  attendanceValue: number
  shortOffenders: ScheduleOffender[]
  attendanceOffenders: ScheduleOffender[]
}

export function emptyScheduleEval(): StaffScheduleEval {
  return {
    hasSchedule: false,
    registeredShifts: 0,
    countedShifts: 0,
    excludedShifts: 0,
    expectedHours: 0,
    workedHours: 0,
    hoursShort: 0,
    lateCount: 0,
    noShowCount: 0,
    attendanceValue: 0,
    shortOffenders: [],
    attendanceOffenders: [],
  }
}

function shiftLabel(shift: ShiftId, dayIndex: number, dateIso: string): string {
  return `${SHIFT_DEFS[shift].label} · ${WEEKDAY_LABELS[dayIndex]} · ${dateIso.slice(
    8
  )}/${dateIso.slice(5, 7)}`
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Evaluate every staff's registered shifts in `[fromIso, toIso]` against their
 * actual activity. Only shifts whose window has already ended (`endMs <= nowMs`)
 * are judged.
 */
export function evaluateSchedule(
  weeks: ScheduleWeek[],
  activity: ActivityMap,
  fromIso: string,
  toIso: string,
  nowMs: number = Date.now()
): Record<string, StaffScheduleEval> {
  const out: Record<string, StaffScheduleEval> = {}
  const get = (key: string) => (out[key] ??= emptyScheduleEval())

  for (const week of weeks) {
    const dates = weekDates(week.weekId)
    dates.forEach((date, dayIndex) => {
      if (date < fromIso || date > toIso) return
      for (const shift of SHIFT_IDS) {
        const cell = getCell(week, dayIndex, shift)
        if (!cell.staff) continue
        const row = get(cell.staff)
        row.hasSchedule = true
        row.registeredShifts += 1
        if (cell.excludeFromScore) {
          row.excludedShifts += 1
          continue
        }

        const win = vnShiftWindowMs(date, shift)
        if (win.endMs > nowMs) continue // shift not finished yet

        const expected = SHIFT_DEFS[shift].hours
        row.countedShifts += 1
        row.expectedHours += expected

        const act = activity[cell.staff]?.[date]?.[shift]
        if (!act || act.hits === 0 || !act.firstMs) {
          row.noShowCount += 1
          row.hoursShort += expected
          row.attendanceValue += 3
          row.shortOffenders.push({
            atMs: win.startMs,
            label: shiftLabel(shift, dayIndex, date),
            detail: `bỏ ca — thiếu ${expected}h`,
          })
          row.attendanceOffenders.push({
            atMs: win.startMs,
            label: shiftLabel(shift, dayIndex, date),
            detail: "bỏ ca",
          })
          continue
        }

        const worked = Math.max(
          0,
          Math.min(
            expected,
            (Math.min(act.lastMs, win.endMs) -
              Math.max(act.firstMs, win.startMs)) /
              3_600_000
          )
        )
        row.workedHours += worked
        const short = expected - worked
        if (short > SHORT_TOLERANCE_HOURS) {
          row.hoursShort += short
          row.shortOffenders.push({
            atMs: win.startMs,
            label: shiftLabel(shift, dayIndex, date),
            detail: `thiếu ${round1(short)}h (làm ${round1(worked)}/${expected}h)`,
          })
        }

        const lateBy = (act.firstMs - win.startMs) / 60_000
        if (lateBy > LATE_GRACE_MIN) {
          row.lateCount += 1
          row.attendanceValue += 1
          row.attendanceOffenders.push({
            atMs: act.firstMs,
            label: shiftLabel(shift, dayIndex, date),
            detail: `vào ca muộn ${Math.round(lateBy)}′`,
          })
        }
      }
    })
  }

  for (const row of Object.values(out)) {
    row.hoursShort = round1(row.hoursShort)
    row.workedHours = round1(row.workedHours)
    row.shortOffenders.sort((a, b) => a.atMs - b.atMs)
    row.attendanceOffenders.sort((a, b) => a.atMs - b.atMs)
  }
  return out
}

// ---------------------------------------------------------------- payroll input
// Feeds the salary calculation (feature #4). Same window math as
// `evaluateSchedule`, but classifies each finished shift into the payroll
// discipline buckets and splits worked hours into normal vs "giờ cuối ca"
// (the final hour of the shift window, paid double).
//
// Rules (user, 08/09/2026):
//  - Đến muộn        = vào ca trễ 10..<60′, tổng vắng mặt < 60′.
//  - Bỏ ca 1–1,5h    = tổng vắng mặt 60..<90′.
//  - Bỏ ca ≥ 1,5h    = tổng vắng mặt ≥ 90′ (gồm ca bỏ hẳn).
// "Vắng mặt" = phần khung ca ngoài đoạn [firstMs, lastMs] (vào muộn + về sớm).

/** Absence threshold (minutes) splitting the two "bỏ ca" tiers. Tunable. */
export const LONG_ABSENCE_MIN = 90
/** Absence at/above this (minutes) is a "bỏ ca", below it is at most "đến muộn". */
export const SHIFT_ABSENCE_MIN = 60

export type PayrollShiftAgg = {
  countedShifts: number
  excludedShifts: number
  /** worked hours inside the shift window (sum, clamped) */
  paidHours: number
  /** of `paidHours`, the part inside the final hour of the shift window */
  paidLastHourHours: number
  /** registered shift-length hours for finished, non-excluded shifts */
  expectedHours: number
  lateCount: number
  shortAbsenceCount: number
  longAbsenceCount: number
  noShowCount: number
  offenders: ScheduleOffender[]
}

function emptyPayrollAgg(): PayrollShiftAgg {
  return {
    countedShifts: 0,
    excludedShifts: 0,
    paidHours: 0,
    paidLastHourHours: 0,
    expectedHours: 0,
    lateCount: 0,
    shortAbsenceCount: 0,
    longAbsenceCount: 0,
    noShowCount: 0,
    offenders: [],
  }
}

const overlapMs = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/**
 * Per-staff shift aggregates for payroll over `[fromIso, toIso]`. Only shifts
 * whose window has ended (`endMs <= nowMs`) and that are not flagged "đổi ca"
 * count.
 */
export function evaluatePayrollShifts(
  weeks: ScheduleWeek[],
  activity: ActivityMap,
  fromIso: string,
  toIso: string,
  nowMs: number = Date.now()
): Record<string, PayrollShiftAgg> {
  const out: Record<string, PayrollShiftAgg> = {}
  const get = (key: string) => (out[key] ??= emptyPayrollAgg())

  for (const week of weeks) {
    const dates = weekDates(week.weekId)
    dates.forEach((date, dayIndex) => {
      if (date < fromIso || date > toIso) return
      for (const shift of SHIFT_IDS) {
        const cell = getCell(week, dayIndex, shift)
        if (!cell.staff) continue
        const row = get(cell.staff)
        if (cell.excludeFromScore) {
          row.excludedShifts += 1
          continue
        }
        const win = vnShiftWindowMs(date, shift)
        if (win.endMs > nowMs) continue

        const expected = SHIFT_DEFS[shift].hours
        row.countedShifts += 1
        row.expectedHours += expected
        const label = shiftLabel(shift, dayIndex, date)

        const act = activity[cell.staff]?.[date]?.[shift]
        if (!act || act.hits === 0 || !act.firstMs) {
          row.noShowCount += 1
          row.longAbsenceCount += 1
          row.offenders.push({ atMs: win.startMs, label, detail: "bỏ ca (không có hoạt động)" })
          continue
        }

        const first = Math.max(act.firstMs, win.startMs)
        const last = Math.min(Math.max(act.lastMs, act.firstMs), win.endMs)
        const workedMs = Math.max(0, last - first)
        row.paidHours += workedMs / 3_600_000
        row.paidLastHourHours +=
          overlapMs(first, last, win.endMs - 3_600_000, win.endMs) / 3_600_000

        const windowMin = (win.endMs - win.startMs) / 60_000
        const lateMin = Math.max(0, (act.firstMs - win.startMs) / 60_000)
        const earlyMin = Math.max(0, (win.endMs - Math.min(act.lastMs, win.endMs)) / 60_000)
        const absenceMin = Math.min(windowMin, lateMin + earlyMin)

        if (absenceMin >= LONG_ABSENCE_MIN) {
          row.longAbsenceCount += 1
          row.offenders.push({
            atMs: win.startMs,
            label,
            detail: `bỏ ca ~${Math.round(absenceMin)}′ (vào muộn ${Math.round(lateMin)}′, về sớm ${Math.round(earlyMin)}′)`,
          })
        } else if (absenceMin >= SHIFT_ABSENCE_MIN) {
          row.shortAbsenceCount += 1
          row.offenders.push({
            atMs: win.startMs,
            label,
            detail: `bỏ ca ~${Math.round(absenceMin)}′ (vào muộn ${Math.round(lateMin)}′, về sớm ${Math.round(earlyMin)}′)`,
          })
        } else if (lateMin >= LATE_GRACE_MIN) {
          row.lateCount += 1
          row.offenders.push({
            atMs: act.firstMs,
            label,
            detail: `vào ca muộn ${Math.round(lateMin)}′`,
          })
        }
      }
    })
  }

  for (const row of Object.values(out)) {
    row.paidHours = round1(row.paidHours)
    row.paidLastHourHours = round1(row.paidLastHourHours)
    row.offenders.sort((a, b) => a.atMs - b.atMs)
  }
  return out
}
