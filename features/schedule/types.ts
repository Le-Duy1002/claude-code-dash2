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

export const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

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

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

/** [startMs, endMs) epoch ms of a shift on a given Vietnam calendar day. */
export function vnShiftWindowMs(
  dateIso: string,
  shift: ShiftId
): { startMs: number; endMs: number } {
  const [y, m, d] = dateIso.split("-").map(Number)
  const def = SHIFT_DEFS[shift]
  return {
    startMs: Date.UTC(y, m - 1, d, def.startHour) - VN_OFFSET_MS,
    endMs: Date.UTC(y, m - 1, d, def.endHour) - VN_OFFSET_MS,
  }
}

/** Distinct week ids (Mondays) covering a list of `yyyy-mm-dd` dates. */
export function weekIdsForDates(dates: string[]): string[] {
  return [...new Set(dates.map((date) => mondayOf(date)))]
}

// ------------------------------------------------------------ the grid

/** Someone working part of a shift in place of the registered staff ("trực hộ"). */
export type CoverSlot = {
  staff: string
  /** covered 1-hour slots, each by its start hour (13 = 13:00–14:00), ascending */
  hours: number[]
}

/** One cell of the grid: who works it, plus an optional note. */
export type ScheduleCell = {
  staff: string | null
  /** free note on the cell */
  note?: string
  /**
   * The shift was swapped / covered by someone else — exclude it from
   * criteria 1 (Đủ giờ ca) & 2 (Vào ca). The manager reviews it by hand.
   */
  excludeFromScore?: boolean
  /** who covered which hours; only meaningful with `excludeFromScore` */
  cover?: CoverSlot[]
}

/** Start hours of each 1-hour slot in a shift (Chiều → 13…18). */
export function shiftHourSlots(shift: ShiftId): number[] {
  const { startHour, endHour } = SHIFT_DEFS[shift]
  return Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
}

/** `[13, 14, 15, 17]` → `"13–16h, 17–18h"`. */
export function formatHourRanges(hours: number[]): string {
  const sorted = [...hours].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  for (let i = 0; i < sorted.length; i += 1) {
    const h = sorted[i]
    if (sorted[i + 1] !== h + 1) {
      parts.push(`${start}–${h + 1}h`)
      start = sorted[i + 1]
    }
  }
  return parts.join(", ")
}

/** `CoverSlot[]` → `{ hour: staffKey }`. */
export function coverByHour(cover: CoverSlot[] | undefined): Record<number, string> {
  const out: Record<number, string> = {}
  for (const c of cover ?? []) for (const h of c.hours) out[h] = c.staff
  return out
}

/** `{ hour: staffKey }` → `CoverSlot[]`, ordered by each person's first hour. */
export function coverFromHours(byHour: Record<number, string>): CoverSlot[] {
  const map = new Map<string, number[]>()
  const hours = Object.keys(byHour)
    .map(Number)
    .sort((a, b) => a - b)
  for (const h of hours) {
    const staff = byHour[h]
    if (!map.has(staff)) map.set(staff, [])
    map.get(staff)!.push(h)
  }
  return [...map].map(([staff, hrs]) => ({ staff, hours: hrs }))
}

function normalizeCover(value: unknown): CoverSlot[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: CoverSlot[] = []
  for (const c of value as Partial<CoverSlot>[]) {
    if (!c || typeof c.staff !== "string" || !Array.isArray(c.hours)) continue
    const hours = c.hours.filter(Number.isInteger).sort((a, b) => a - b)
    if (hours.length) out.push({ staff: c.staff, hours })
  }
  return out.length ? out : undefined
}

/** shiftId → cell. A bare string is the legacy shape (staff key only). */
export type ShiftAssignment = Partial<Record<ShiftId, ScheduleCell | string | null>>

/** weekday index 0–6 → shift assignments. */
export type WeekGrid = Partial<Record<number, ShiftAssignment>>

/** Coerce a stored cell (object, legacy string, or null) to {@link ScheduleCell}. */
export function normalizeCell(value: ScheduleCell | string | null | undefined): ScheduleCell {
  if (!value) return { staff: null }
  if (typeof value === "string") return { staff: value }
  return {
    staff: value.staff ?? null,
    note: value.note || undefined,
    excludeFromScore: value.excludeFromScore || undefined,
    cover: normalizeCover(value.cover),
  }
}

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

/** Read `.toMillis()` off a Firestore Timestamp (admin or client), else 0. */
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

/**
 * Map a raw `workSchedules/{weekId}` document to {@link ScheduleWeek}. SDK-
 * agnostic (works with both the client and Admin Firestore SDKs).
 */
export function mapScheduleWeek(
  weekId: string,
  data: Record<string, unknown> | undefined | null
): ScheduleWeek {
  const base = emptyWeek(weekId)
  if (!data) return base
  const rawGrid = (data.grid ?? {}) as Record<string, Record<string, unknown>>
  const grid: WeekGrid = {}
  for (const [day, shifts] of Object.entries(rawGrid)) {
    const assignment: ShiftAssignment = {}
    for (const [shift, cell] of Object.entries(shifts ?? {})) {
      assignment[shift as ShiftId] = normalizeCell(
        cell as ScheduleCell | string | null
      )
    }
    grid[Number(day)] = assignment
  }
  return {
    ...base,
    startDate: (data.startDate as string) || base.startDate,
    endDate: (data.endDate as string) || base.endDate,
    status: data.status === "locked" ? "locked" : "draft",
    grid,
    overtime: Array.isArray(data.overtime)
      ? (data.overtime as OvertimeEntry[])
      : [],
    freeNote: (data.freeNote as string) ?? "",
    lockedAtMs: tsToMs(data.lockedAt) || null,
    lockedByName: (data.lockedByName as string) ?? null,
    updatedAtMs: tsToMs(data.updatedAt),
    updatedByName: (data.updatedByName as string) ?? null,
  }
}

export function getCell(
  week: ScheduleWeek,
  dayIndex: number,
  shift: ShiftId
): ScheduleCell {
  return normalizeCell(week.grid[dayIndex]?.[shift])
}

export function cellOf(
  week: ScheduleWeek,
  dayIndex: number,
  shift: ShiftId
): string | null {
  return getCell(week, dayIndex, shift).staff
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
  /** the cell changed, for a cell change logged since 28/10/2026; else null */
  dayIndex: number | null
  shift: ShiftId | null
  /** human-readable Vietnamese description */
  summary: string
  reason: string | null
}

/**
 * `overtime` with `rows` applied for one staff: each row replaces that
 * staff's entry for its day, `hours <= 0` removes it.
 */
export function mergeOvertimeRows(
  overtime: OvertimeEntry[],
  staffKey: string,
  rows: { dayIndex: number; hours: number }[]
): OvertimeEntry[] {
  const touched = new Set(rows.map((r) => r.dayIndex))
  const next = overtime.filter(
    (e) => !(e.staffKey === staffKey && touched.has(e.dayIndex))
  )
  for (const r of rows) {
    if (r.hours > 0) {
      next.push({
        id: `${staffKey}-${r.dayIndex}`,
        staffKey,
        dayIndex: r.dayIndex,
        hours: r.hours,
        note: "",
      })
    }
  }
  return next.sort((a, b) =>
    a.staffKey === b.staffKey
      ? a.dayIndex - b.dayIndex
      : a.staffKey.localeCompare(b.staffKey)
  )
}

// ------------------------------------------------------------ live presence
// Who has the Lịch làm page open and what they're doing on it, so people
// registering at the same time see each other (user, 28/10/2026).

/** What someone has open: a cell's staff picker or note, or a week's extras. */
export type PresenceAction = "staff" | "note" | "overtime" | "freeNote"

export const PRESENCE_ACTION_LABELS: Record<PresenceAction, string> = {
  staff: "đang chọn người",
  note: "đang sửa ghi chú / đổi ca",
  overtime: "đang nhập giờ làm thêm",
  freeNote: "đang sửa ghi chú tuần",
}

export type PresenceFocus = {
  weekId: string
  action: PresenceAction
  /** the cell — null for the week-level actions */
  dayIndex: number | null
  shift: ShiftId | null
}

/** One open tab — `schedulePresence/{tabId}`. */
export type SchedulePresence = {
  id: string
  uid: string
  name: string
  /** `yyyy-mm` of the month being looked at */
  month: string
  focus: PresenceFocus | null
  /** last heartbeat */
  seenAtMs: number
  /** this client's own write, not yet confirmed — `seenAtMs` is an estimate */
  pending: boolean
}

/** A tab writes at least this often while open. */
export const PRESENCE_HEARTBEAT_MS = 20_000
/**
 * A tab silent this long is gone — closed without saying so. Background tabs
 * get their timers throttled to about once a minute, hence the margin.
 */
export const PRESENCE_STALE_MS = 80_000

export function samePresenceFocus(
  a: PresenceFocus | null,
  b: PresenceFocus | null
): boolean {
  if (!a || !b) return a === b
  return (
    a.weekId === b.weekId &&
    a.action === b.action &&
    a.dayIndex === b.dayIndex &&
    a.shift === b.shift
  )
}

/** `"Ca chiều T3 07/10"`, or the week label for a week-level action. */
export function describeFocus(focus: PresenceFocus): string {
  if (focus.dayIndex == null || !focus.shift) return weekLabel(focus.weekId)
  return `Ca ${SHIFT_DEFS[focus.shift].label.toLowerCase()} ${
    WEEKDAY_SHORT[focus.dayIndex]
  } ${formatDm(addDays(focus.weekId, focus.dayIndex))}`
}

const SHIFT_ID_SET = new Set<string>(SHIFT_IDS)

function mapFocus(value: unknown): PresenceFocus | null {
  if (!value || typeof value !== "object") return null
  const f = value as Record<string, unknown>
  if (
    typeof f.weekId !== "string" ||
    typeof f.action !== "string" ||
    !(f.action in PRESENCE_ACTION_LABELS)
  ) {
    return null
  }
  const dayIndex = Number.isInteger(f.dayIndex) ? (f.dayIndex as number) : null
  const shift =
    typeof f.shift === "string" && SHIFT_ID_SET.has(f.shift)
      ? (f.shift as ShiftId)
      : null
  return { weekId: f.weekId, action: f.action as PresenceAction, dayIndex, shift }
}

/** Map a raw `schedulePresence/{tabId}` document. SDK-agnostic. */
export function mapPresence(
  id: string,
  data: Record<string, unknown>
): SchedulePresence {
  return {
    id,
    uid: String(data.uid ?? ""),
    name: String(data.name ?? "Người dùng"),
    month: String(data.month ?? ""),
    focus: mapFocus(data.focus),
    seenAtMs: tsToMs(data.seenAt),
    pending: false,
  }
}

/** `"vừa xong"`, `"3 phút trước"`, `"14:05"` (today) or a full date-time. */
export function formatAgo(atMs: number, nowMs: number): string {
  if (!atMs) return "—"
  const diff = Math.max(0, nowMs - atMs)
  if (diff < 45_000) return "vừa xong"
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} phút trước`
  const vnDay = (ms: number) => new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10)
  if (vnDay(atMs) === vnDay(nowMs)) {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(atMs))
  }
  return formatDateTime(atMs)
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
        const cell = getCell(week, dayIndex, shift)
        if (cell.excludeFromScore && cell.cover?.length) {
          // "đổi ca" with "trực hộ" hours ticked: each covering person gets
          // their hours, the registered person the rest (user, 29/09/2026)
          const byHour = coverByHour(cell.cover)
          for (const h of shiftHourSlots(shift)) {
            const who = byHour[h] ?? cell.staff
            if (!who) continue
            const row = bump(who)
            row.shiftHours += 1
            row.dates.add(date)
          }
          if (cell.staff) bump(cell.staff).shifts += 1
          continue
        }
        if (!cell.staff) continue
        const row = bump(cell.staff)
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
