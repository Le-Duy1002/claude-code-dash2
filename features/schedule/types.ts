/**
 * Work-schedule domain types + pure helpers. No React, no Firebase.
 *
 * A schedule is a grid per ISO week (Monday–Sunday): rows = shift
 * (Sáng / Chiều / Tối), columns = weekday, each cell holds one staff key.
 * Weeks are grouped under the month of their Thursday (ISO-8601), so a week
 * spanning two months ("29/06–05/07") shows under July as "Tuần 1".
 *
 * This data feeds criteria 1 (Đủ giờ ca) & 2 (Vào ca) of the work-review
 * scoring and the payroll calculation.
 */

import { STAFF } from "@/features/pancake/staff"

// ------------------------------------------------------------ staff roster

/** The staff who register shifts — same roster as the work-review scoring. */
export const SCHEDULE_STAFF: { key: string; name: string }[] = STAFF.map((s) => ({
  key: s.key,
  name: s.name,
}))

const STAFF_NAME = new Map(SCHEDULE_STAFF.map((s) => [s.key, s.name]))

export function staffName(key: string | null | undefined): string {
  return (key && STAFF_NAME.get(key)) || "—"
}

// ------------------------------------------------------------ shifts

export type ShiftId = "sang" | "chieu" | "toi"

export const SHIFT_IDS: ShiftId[] = ["sang", "chieu", "toi"]

export const SHIFT_DEFS: Record<
  ShiftId,
  { label: string; range: string; startHour: number; endHour: number; hours: number }
> = {
  sang: { label: "Sáng", range: "8–13h", startHour: 8, endHour: 13, hours: 5 },
  chieu: { label: "Chiều", range: "13–19h", startHour: 13, endHour: 19, hours: 6 },
  toi: { label: "Tối", range: "19–24h", startHour: 19, endHour: 24, hours: 5 },
}

// ------------------------------------------------------------ week / date math
// Calendar dates are plain `yyyy-mm-dd` strings; arithmetic goes through UTC so
// there is no timezone drift. Weekday index is Monday-first (Mon = 0 … Sun = 6).

export const WEEKDAY_LABELS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
]

export const MONTH_LABELS = Array.from(
  { length: 12 },
  (_, i) => `Tháng ${i + 1}`
)

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function isoFromDate(dt: Date): string {
  return isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function addDays(iso: string, n: number): string {
  const dt = parseIso(iso)
  dt.setUTCDate(dt.getUTCDate() + n)
  return isoFromDate(dt)
}

/** Monday-first weekday index (Mon = 0 … Sun = 6). */
export function weekdayMon0(iso: string): number {
  return (parseIso(iso).getUTCDay() + 6) % 7
}

/** The Monday `yyyy-mm-dd` of the week containing `iso` — also the week id. */
export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayMon0(iso))
}

/** The 7 dates Mon…Sun of a week. */
export function weekDates(weekId: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekId, i))
}

export function weekEndDate(weekId: string): string {
  return addDays(weekId, 6)
}

/** The month a week belongs to = the month of its Thursday (ISO-8601). */
export function weekMonth(weekId: string): { year: number; month: number } {
  const thu = parseIso(addDays(weekId, 3))
  return { year: thu.getUTCFullYear(), month: thu.getUTCMonth() + 1 }
}

/** Every week id (Monday) whose Thursday falls in `year`/`month` (month 1–12). */
export function weeksOfMonth(year: number, month: number): string[] {
  let wk = addDays(mondayOf(isoOf(year, month, 1)), -7)
  const target = year * 12 + (month - 1)
  const out: string[] = []
  for (let i = 0; i < 9; i += 1) {
    const thu = parseIso(addDays(wk, 3))
    const key = thu.getUTCFullYear() * 12 + thu.getUTCMonth()
    if (key === target) out.push(wk)
    else if (key > target) break
    wk = addDays(wk, 7)
  }
  return out
}

export function weekIndexInMonth(weekId: string): number {
  const { year, month } = weekMonth(weekId)
  return Math.max(0, weeksOfMonth(year, month).indexOf(weekId))
}

/** `"2026-06-29"` → `"29/06"`. */
export function formatDm(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

/** `"2026-06-29"` → `"29/06/2026"`. */
export function formatDmy(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

/** `"Tuần 1 (29/06–05/07)"`. */
export function weekLabel(weekId: string): string {
  return `Tuần ${weekIndexInMonth(weekId) + 1} (${formatDm(weekId)}–${formatDm(
    weekEndDate(weekId)
  )})`
}

export function todayIso(): string {
  // Vietnam calendar day
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return isoOf(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
}

// ------------------------------------------------------------ the grid

/** shiftId → staff key (or null / missing = trống). */
export type ShiftAssignment = Partial<Record<ShiftId, string | null>>

/** weekday index 0–6 → shift assignments. */
export type WeekGrid = Partial<Record<number, ShiftAssignment>>

export type OvertimeEntry = {
  id: string
  staffKey: string
  /** weekday index 0–6 */
  dayIndex: number
  hours: number
  note: string
}

export type WeekStatus = "draft" | "locked"

export const WEEK_STATUS_LABELS: Record<WeekStatus, string> = {
  draft: "Nháp",
  locked: "Đã chốt",
}

export type ScheduleWeek = {
  weekId: string
  startDate: string
  endDate: string
  status: WeekStatus
  grid: WeekGrid
  overtime: OvertimeEntry[]
  freeNote: string
  lockedAtMs: number | null
  lockedByName: string | null
  updatedAtMs: number
  updatedByName: string | null
}

export function emptyWeek(weekId: string): ScheduleWeek {
  return {
    weekId,
    startDate: weekId,
    endDate: weekEndDate(weekId),
    status: "draft",
    grid: {},
    overtime: [],
    freeNote: "",
    lockedAtMs: null,
    lockedByName: null,
    updatedAtMs: 0,
    updatedByName: null,
  }
}

export function cellOf(
  week: ScheduleWeek,
  dayIndex: number,
  shift: ShiftId
): string | null {
  return week.grid[dayIndex]?.[shift] ?? null
}

// ------------------------------------------------------------ change log

export type ScheduleChangeKind =
  | "assign"
  | "unassign"
  | "reassign"
  | "overtime"
  | "note"
  | "lock"
  | "unlock"

export const SCHEDULE_CHANGE_LABELS: Record<ScheduleChangeKind, string> = {
  assign: "Đăng ký ca",
  unassign: "Bỏ ca",
  reassign: "Đổi người",
  overtime: "Giờ làm thêm",
  note: "Ghi chú",
  lock: "Chốt tuần",
  unlock: "Bỏ chốt",
}

export type ScheduleChange = {
  id: string
  weekId: string
  atMs: number
  byUid: string
  byName: string
  kind: ScheduleChangeKind
  /** the change happened while the week was already locked */
  afterLock: boolean
  /** staff affected, for filtering (null for lock/unlock/note) */
  staffKey: string | null
  /** human-readable Vietnamese description */
  summary: string
  reason: string | null
}

// ------------------------------------------------------------ hours for scoring

export type StaffHours = {
  shiftHours: number
  overtimeHours: number
  shifts: number
  days: number
}

/**
 * Registered shift-hours + overtime per staff over the inclusive date range
 * `[fromIso, toIso]`. Feeds criterion 1 (Đủ giờ ca) and payroll.
 */
export function registeredHours(
  weeks: ScheduleWeek[],
  fromIso: string,
  toIso: string
): Record<string, StaffHours> {
  const acc: Record<
    string,
    { shiftHours: number; overtimeHours: number; shifts: number; dates: Set<string> }
  > = {}
  const bump = (key: string) =>
    (acc[key] ??= {
      shiftHours: 0,
      overtimeHours: 0,
      shifts: 0,
      dates: new Set<string>(),
    })

  for (const week of weeks) {
    const dates = weekDates(week.weekId)
    dates.forEach((date, dayIndex) => {
      if (date < fromIso || date > toIso) return
      for (const shift of SHIFT_IDS) {
        const staffKey = week.grid[dayIndex]?.[shift]
        if (!staffKey) continue
        const row = bump(staffKey)
        row.shiftHours += SHIFT_DEFS[shift].hours
        row.shifts += 1
        row.dates.add(date)
      }
    })
    for (const ot of week.overtime) {
      const date = dates[ot.dayIndex]
      if (!date || date < fromIso || date > toIso) continue
      bump(ot.staffKey).overtimeHours += Number(ot.hours) || 0
    }
  }

  const out: Record<string, StaffHours> = {}
  for (const [key, row] of Object.entries(acc)) {
    out[key] = {
      shiftHours: row.shiftHours,
      overtimeHours: row.overtimeHours,
      shifts: row.shifts,
      days: row.dates.size,
    }
  }
  return out
}

// ------------------------------------------------------------ formatting

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

export function formatHours(hours: number): string {
  if (!hours) return "0h"
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}
