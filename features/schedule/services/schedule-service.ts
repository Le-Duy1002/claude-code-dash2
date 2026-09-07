import {
  collection,
  doc,
  documentId,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"

import {
  SHIFT_DEFS,
  WEEKDAY_LABELS,
  cellOf,
  emptyWeek,
  staffName,
  weekEndDate,
  type OvertimeEntry,
  type ScheduleChange,
  type ScheduleChangeKind,
  type ScheduleWeek,
  type ShiftId,
} from "../types"

const WEEKS = "workSchedules"
const CHANGES = "workScheduleChanges"

export type Actor = { uid: string; name: string }

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

function mapWeek(id: string, data: Record<string, unknown>): ScheduleWeek {
  const base = emptyWeek(id)
  return {
    ...base,
    startDate: (data.startDate as string) || base.startDate,
    endDate: (data.endDate as string) || base.endDate,
    status: data.status === "locked" ? "locked" : "draft",
    grid: (data.grid as ScheduleWeek["grid"]) ?? {},
    overtime: Array.isArray(data.overtime)
      ? (data.overtime as OvertimeEntry[])
      : [],
    freeNote: (data.freeNote as string) ?? "",
    lockedAtMs: toMillis(data.lockedAt) || null,
    lockedByName: (data.lockedByName as string) ?? null,
    updatedAtMs: toMillis(data.updatedAt),
    updatedByName: (data.updatedByName as string) ?? null,
  }
}

function mapChange(id: string, data: Record<string, unknown>): ScheduleChange {
  return {
    id,
    weekId: (data.weekId as string) ?? "",
    atMs: toMillis(data.createdAt),
    byUid: (data.byUid as string) ?? "",
    byName: (data.byName as string) ?? "—",
    kind: (data.kind as ScheduleChangeKind) ?? "assign",
    afterLock: Boolean(data.afterLock),
    staffKey: (data.staffKey as string) ?? null,
    summary: (data.summary as string) ?? "",
    reason: (data.reason as string) ?? null,
  }
}

/** Subscribe to a set of week docs (≤ 30). Missing docs are simply absent. */
export function subscribeToWeeks(
  weekIds: string[],
  onData: (weeks: Record<string, ScheduleWeek>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (weekIds.length === 0) {
    onData({})
    return () => {}
  }
  const q = query(
    collection(db, WEEKS),
    where(documentId(), "in", weekIds.slice(0, 30))
  )
  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, ScheduleWeek> = {}
      for (const d of snap.docs) map[d.id] = mapWeek(d.id, d.data())
      onData(map)
    },
    (error) => onError?.(error)
  )
}

/** Subscribe to the change log for a set of weeks, newest first. */
export function subscribeToChanges(
  weekIds: string[],
  onData: (changes: ScheduleChange[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (weekIds.length === 0) {
    onData([])
    return () => {}
  }
  const q = query(
    collection(db, CHANGES),
    where("weekId", "in", weekIds.slice(0, 30))
  )
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapChange(d.id, d.data()))
        .sort((a, b) => b.atMs - a.atMs)
      onData(rows)
    },
    (error) => onError?.(error)
  )
}

// ------------------------------------------------------------ mutations
// Every mutation writes the week doc AND a change-log entry in one batch.

function weekBase(week: ScheduleWeek, actor: Actor) {
  return {
    weekId: week.weekId,
    startDate: week.weekId,
    endDate: weekEndDate(week.weekId),
    updatedAt: serverTimestamp(),
    updatedByName: actor.name,
  }
}

type ChangeDraft = {
  kind: ScheduleChangeKind
  staffKey: string | null
  summary: string
  reason?: string | null
}

function pushChange(
  batch: ReturnType<typeof writeBatch>,
  week: ScheduleWeek,
  actor: Actor,
  change: ChangeDraft
) {
  batch.set(doc(collection(db, CHANGES)), {
    weekId: week.weekId,
    createdAt: serverTimestamp(),
    byUid: actor.uid,
    byName: actor.name,
    kind: change.kind,
    afterLock: week.status === "locked",
    staffKey: change.staffKey,
    summary: change.summary,
    reason: change.reason ?? null,
  })
}

function slot(dayIndex: number, shift: ShiftId): string {
  return `${WEEKDAY_LABELS[dayIndex]} · ${SHIFT_DEFS[shift].label}`
}

/** Assign / clear / change the staff in one cell. */
export async function setCell(
  week: ScheduleWeek,
  dayIndex: number,
  shift: ShiftId,
  staffKey: string | null,
  actor: Actor,
  reason?: string | null
): Promise<void> {
  const before = cellOf(week, dayIndex, shift)
  if (before === staffKey) return

  const batch = writeBatch(db)
  batch.set(
    doc(db, WEEKS, week.weekId),
    {
      ...weekBase(week, actor),
      status: week.status,
      grid: { [dayIndex]: { [shift]: staffKey } },
    },
    { merge: true }
  )

  const kind: ScheduleChangeKind = !before
    ? "assign"
    : !staffKey
      ? "unassign"
      : "reassign"
  const summary = !before
    ? `${staffName(staffKey)} đăng ký ${slot(dayIndex, shift)}`
    : !staffKey
      ? `Bỏ ${staffName(before)} khỏi ${slot(dayIndex, shift)}`
      : `${slot(dayIndex, shift)}: ${staffName(before)} → ${staffName(staffKey)}`

  pushChange(batch, week, actor, {
    kind,
    staffKey: staffKey ?? before,
    summary,
    reason,
  })
  await batch.commit()
}

/** Replace the whole overtime list for a week. */
export async function setOvertime(
  week: ScheduleWeek,
  overtime: OvertimeEntry[],
  actor: Actor,
  summary: string,
  affectedStaffKey: string | null,
  reason?: string | null
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(
    doc(db, WEEKS, week.weekId),
    { ...weekBase(week, actor), status: week.status, overtime },
    { merge: true }
  )
  pushChange(batch, week, actor, {
    kind: "overtime",
    staffKey: affectedStaffKey,
    summary,
    reason,
  })
  await batch.commit()
}

/** Set the free-text "note làm thêm giờ" for a week. */
export async function setFreeNote(
  week: ScheduleWeek,
  freeNote: string,
  actor: Actor,
  reason?: string | null
): Promise<void> {
  if (freeNote === week.freeNote) return
  const batch = writeBatch(db)
  batch.set(
    doc(db, WEEKS, week.weekId),
    { ...weekBase(week, actor), status: week.status, freeNote },
    { merge: true }
  )
  pushChange(batch, week, actor, {
    kind: "note",
    staffKey: null,
    summary: freeNote.trim()
      ? `Sửa ghi chú tuần: "${freeNote.trim().slice(0, 80)}"`
      : "Xoá ghi chú tuần",
    reason,
  })
  await batch.commit()
}

/** Lock ("chốt") a week — from here on edits are logged as after-lock. */
export async function lockWeek(
  week: ScheduleWeek,
  actor: Actor
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(
    doc(db, WEEKS, week.weekId),
    {
      ...weekBase(week, actor),
      status: "locked",
      lockedAt: serverTimestamp(),
      lockedByName: actor.name,
    },
    { merge: true }
  )
  pushChange(batch, week, actor, {
    kind: "lock",
    staffKey: null,
    summary: `Chốt lịch tuần`,
  })
  await batch.commit()
}

/** Unlock a week for editing (recorded as an after-lock change). */
export async function unlockWeek(
  week: ScheduleWeek,
  actor: Actor,
  reason: string
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(
    doc(db, WEEKS, week.weekId),
    { ...weekBase(week, actor), status: "draft" },
    { merge: true }
  )
  // record while still "locked" so it lands in the after-lock history
  pushChange(batch, week, actor, {
    kind: "unlock",
    staffKey: null,
    summary: "Bỏ chốt để điều chỉnh",
    reason,
  })
  await batch.commit()
}
