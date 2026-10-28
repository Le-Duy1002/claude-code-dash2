import {
  collection,
  doc,
  documentId,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"

import {
  SHIFT_DEFS,
  SHIFT_IDS,
  WEEKDAY_LABELS,
  formatHourRanges,
  getCell,
  mapScheduleWeek,
  mergeOvertimeRows,
  staffName,
  weekEndDate,
  type CoverSlot,
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

const mapWeek = mapScheduleWeek

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
    dayIndex: Number.isInteger(data.dayIndex) ? (data.dayIndex as number) : null,
    shift: SHIFT_IDS.includes(data.shift as ShiftId)
      ? (data.shift as ShiftId)
      : null,
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
        // "estimate": a change this tab just made shows at once, not at 0
        .map((d) => mapChange(d.id, d.data({ serverTimestamps: "estimate" })))
        .sort((a, b) => b.atMs - a.atMs)
      onData(rows)
    },
    (error) => onError?.(error)
  )
}

// ------------------------------------------------------------ mutations
// Every mutation writes the week doc AND a change-log entry in one batch —
// or one transaction where two people editing at once could clobber each
// other (a cell, the overtime list).

/**
 * The cell changed under the user — someone else saved it first. `current`
 * is what it holds now.
 */
export class ScheduleConflictError extends Error {
  constructor(
    public current: string | null,
    public byName: string | null
  ) {
    super("Ô này vừa được người khác sửa")
  }
}

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
  /** the cell changed, so the grid can show who just touched it */
  cell?: { dayIndex: number; shift: ShiftId }
}

/** A change-log entry, to `.set()` in the mutation's batch or transaction. */
function changeEntry(
  week: ScheduleWeek,
  actor: Actor,
  change: ChangeDraft
): [DocumentReference, DocumentData] {
  return [
    doc(collection(db, CHANGES)),
    {
      weekId: week.weekId,
      createdAt: serverTimestamp(),
      byUid: actor.uid,
      byName: actor.name,
      kind: change.kind,
      afterLock: week.status === "locked",
      staffKey: change.staffKey,
      dayIndex: change.cell?.dayIndex ?? null,
      shift: change.cell?.shift ?? null,
      summary: change.summary,
      reason: change.reason ?? null,
    },
  ]
}

function slot(dayIndex: number, shift: ShiftId): string {
  return `${WEEKDAY_LABELS[dayIndex]} · ${SHIFT_DEFS[shift].label}`
}

/**
 * Assign / clear / change the staff in one cell. Re-reads the cell in a
 * transaction and throws {@link ScheduleConflictError} when it no longer
 * holds what the user saw — two people picking the same cell at once must
 * not silently overwrite each other.
 */
export async function setCell(
  week: ScheduleWeek,
  dayIndex: number,
  shift: ShiftId,
  staffKey: string | null,
  actor: Actor,
  reason?: string | null
): Promise<void> {
  const seen = getCell(week, dayIndex, shift).staff
  if (seen === staffKey) return

  const weekRef = doc(db, WEEKS, week.weekId)
  await runTransaction(db, async (tx) => {
    const fresh = mapScheduleWeek(week.weekId, (await tx.get(weekRef)).data())
    const before = getCell(fresh, dayIndex, shift).staff
    if (before !== seen) {
      throw new ScheduleConflictError(before, fresh.updatedByName)
    }

    tx.set(
      weekRef,
      {
        ...weekBase(fresh, actor),
        status: fresh.status,
        grid: {
          [dayIndex]: {
            // clearing a cell also wipes its note / swap flag / cover
            [shift]: staffKey
              ? { staff: staffKey }
              : { staff: null, note: null, excludeFromScore: null, cover: null },
          },
        },
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

    tx.set(
      ...changeEntry(fresh, actor, {
        kind,
        staffKey: staffKey ?? before,
        summary,
        reason,
        cell: { dayIndex, shift },
      })
    )
  })
}

/**
 * Set the note / "đổi ca" flag / cover hours on one cell. `cover` is dropped
 * unless the cell is flagged "đổi ca".
 */
export async function setCellNote(
  week: ScheduleWeek,
  dayIndex: number,
  shift: ShiftId,
  note: string,
  excludeFromScore: boolean,
  cover: CoverSlot[],
  actor: Actor,
  reason?: string | null
): Promise<void> {
  const current = getCell(week, dayIndex, shift)
  const nextCover = excludeFromScore ? cover : []
  if (
    (current.note ?? "") === note &&
    Boolean(current.excludeFromScore) === excludeFromScore &&
    JSON.stringify(current.cover ?? []) === JSON.stringify(nextCover)
  ) {
    return
  }

  const coverText = nextCover
    .map((c) => `${staffName(c.staff)} ${formatHourRanges(c.hours)}`)
    .join(", ")
  const parts = [
    excludeFromScore
      ? `đổi ca${coverText ? ` — ${coverText} trực hộ` : ""}`
      : null,
    note ? `ghi chú "${note.slice(0, 60)}"` : null,
  ].filter(Boolean)

  const batch = writeBatch(db)
  batch.set(
    doc(db, WEEKS, week.weekId),
    {
      ...weekBase(week, actor),
      status: week.status,
      grid: {
        [dayIndex]: {
          [shift]: {
            note: note || null,
            excludeFromScore: excludeFromScore || null,
            // an array replaces wholesale under merge, unlike a nested map
            cover: nextCover.length ? nextCover : null,
          },
        },
      },
    },
    { merge: true }
  )
  batch.set(
    ...changeEntry(week, actor, {
      kind: "note",
      staffKey: current.staff,
      summary: `${slot(dayIndex, shift)}: ${
        parts.join("; ") || "xoá ghi chú / đổi ca"
      }`,
      reason,
      cell: { dayIndex, shift },
    })
  )
  await batch.commit()
}

/**
 * Set or remove one staff's overtime on some days (`hours <= 0` removes).
 * Applied in a transaction to the overtime list as stored NOW, so two people
 * adding overtime at once don't wipe each other's entries.
 */
export async function applyOvertimeRows(
  week: ScheduleWeek,
  staffKey: string,
  rows: { dayIndex: number; hours: number }[],
  actor: Actor,
  summary: string,
  reason?: string | null
): Promise<void> {
  if (rows.length === 0) return
  const weekRef = doc(db, WEEKS, week.weekId)
  await runTransaction(db, async (tx) => {
    const fresh = mapScheduleWeek(week.weekId, (await tx.get(weekRef)).data())
    tx.set(
      weekRef,
      {
        ...weekBase(fresh, actor),
        status: fresh.status,
        overtime: mergeOvertimeRows(fresh.overtime, staffKey, rows),
      },
      { merge: true }
    )
    tx.set(
      ...changeEntry(fresh, actor, {
        kind: "overtime",
        staffKey,
        summary,
        reason,
      })
    )
  })
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
  batch.set(
    ...changeEntry(week, actor, {
      kind: "note",
      staffKey: null,
      summary: freeNote.trim()
        ? `Sửa ghi chú tuần: "${freeNote.trim().slice(0, 80)}"`
        : "Xoá ghi chú tuần",
      reason,
    })
  )
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
  batch.set(
    ...changeEntry(week, actor, {
      kind: "lock",
      staffKey: null,
      summary: `Chốt lịch tuần`,
    })
  )
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
  batch.set(
    ...changeEntry(week, actor, {
      kind: "unlock",
      staffKey: null,
      summary: "Bỏ chốt để điều chỉnh",
      reason,
    })
  )
  await batch.commit()
}
