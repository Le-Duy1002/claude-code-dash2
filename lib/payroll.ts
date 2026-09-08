import "server-only"

import { adminDb } from "@/lib/firebase-admin"
import { STAFF } from "@/features/pancake/staff"
import {
  evaluateCriterion,
  totalScore,
  type ScoreEvent,
} from "@/features/pancake/scoring"
import {
  addBucket,
  bucketsForShift,
  emptyBucket,
  mergeDayDoc,
  vnDatesInRange,
  vnDayRange,
  type AgentDayBucket,
  type AgentDayDoc,
} from "@/features/pancake/types"
import {
  SHIFT_IDS,
  mapScheduleWeek,
  weekIdsForDates,
} from "@/features/schedule/types"
import {
  evaluatePayrollShifts,
  evaluateSchedule,
  type ActivityMap,
} from "@/features/schedule/scoring"
import {
  PAYROLL_DEFAULT_PARAMS,
  emptyRowInput,
  isOngoingMonth,
  parsePeriodId,
  type PayrollManualPatch,
  type PayrollParams,
  type PayrollPeriod,
  type PayrollRowInput,
} from "@/features/payroll/types"

export class PayrollError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// ---------------------------------------------------------------- admin gate

const ADMIN_EMAILS = (
  process.env.PAYROLL_ADMIN_EMAILS || "hoangthang0m@gmail.com"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export function isPayrollAdmin(
  token: { email?: string | null } | null | undefined
): boolean {
  const email = token?.email?.toLowerCase()
  return Boolean(email && ADMIN_EMAILS.includes(email))
}

// ---------------------------------------------------------------- params

function periodDoc(id: string) {
  return adminDb().collection("payrollPeriods").doc(id)
}

export async function getPayrollParams(): Promise<PayrollParams> {
  try {
    const snap = await adminDb().collection("payrollConfig").doc("current").get()
    if (!snap.exists) return PAYROLL_DEFAULT_PARAMS
    return { ...PAYROLL_DEFAULT_PARAMS, ...(snap.data() as Partial<PayrollParams>) }
  } catch {
    return PAYROLL_DEFAULT_PARAMS
  }
}

// ---------------------------------------------------------------- build

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * (Re)build the payroll period from Lịch làm việc + Chấm điểm Pancake, keeping
 * any manual entries already on the period. Refuses when the period is locked.
 */
export async function buildPayrollPeriod(
  id: string,
  actorName: string
): Promise<PayrollPeriod> {
  const parsed = parsePeriodId(id)
  if (!parsed) throw new PayrollError("Kỳ lương không hợp lệ", 400)
  const { year, month } = parsed

  const ref = periodDoc(id)
  const existingSnap = await ref.get()
  const existing = existingSnap.exists
    ? (existingSnap.data() as PayrollPeriod)
    : null
  if (existing?.status === "locked") {
    throw new PayrollError(
      "Bảng lương kỳ này đã chốt — dùng “Điều chỉnh” nếu cần sửa.",
      409
    )
  }

  const firstIso = `${year}-${pad(month)}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const lastIso = `${year}-${pad(month)}-${pad(lastDay)}`
  const partial = isOngoingMonth(year, month)
  const fromMs = vnDayRange(firstIso).fromMs
  const monthEndMs = vnDayRange(lastIso).toMs
  const toMs = partial ? Math.min(Date.now(), monthEndMs) : monthEndMs
  const dates = vnDatesInRange(fromMs, toMs)
  const nowCap = Math.min(toMs, Date.now())

  // ---- synced Pancake day docs
  const dailyColl = adminDb().collection("pancakeAgentDaily")
  const snaps = dates.length
    ? await adminDb()
        .getAll(...dates.map((d) => dailyColl.doc(d)))
        .catch(() => [])
    : []
  const docs: AgentDayDoc[] = []
  for (const snap of snaps) if (snap.exists) docs.push(snap.data() as AgentDayDoc)
  const haveDates = new Set(docs.map((d) => d.date))
  const missingDays = dates.filter((d) => !haveDates.has(d))

  // ---- schedule weeks
  const schedColl = adminDb().collection("workSchedules")
  const weekIds = weekIdsForDates(dates)
  const weekSnaps = weekIds.length
    ? await adminDb()
        .getAll(...weekIds.map((wk) => schedColl.doc(wk)))
        .catch(() => [])
    : []
  const weeks = weekSnaps.map((snap) =>
    mapScheduleWeek(snap.id, snap.exists ? snap.data() : undefined)
  )

  // ---- activity map (per staff → date → shift)
  const activity: ActivityMap = {}
  for (const doc of docs) {
    for (const byStaff of Object.values(mergeDayDoc(doc))) {
      for (const [staffKey, byShift] of Object.entries(byStaff)) {
        for (const sid of SHIFT_IDS) {
          const cell = byShift[sid]
          if (!cell || !cell.activityHits || !cell.firstActivityMs) continue
          const perStaff = (activity[staffKey] ??= {})
          const perDate = (perStaff[doc.date] ??= {})
          const prev = perDate[sid]
          perDate[sid] = {
            firstMs: prev
              ? Math.min(prev.firstMs, cell.firstActivityMs)
              : cell.firstActivityMs,
            lastMs: Math.max(prev?.lastMs ?? 0, cell.lastActivityMs),
            hits: (prev?.hits ?? 0) + cell.activityHits,
          }
        }
      }
    }
  }

  const from = dates[0] ?? firstIso
  const to = dates[dates.length - 1] ?? lastIso
  const schedEval = evaluateSchedule(weeks, activity, from, to, nowCap)
  const shiftEval = evaluatePayrollShifts(weeks, activity, from, to, nowCap)

  // ---- fold buckets per staff
  const wantBuckets = bucketsForShift("all")
  const totals = new Map<string, AgentDayBucket>()
  for (const member of STAFF) totals.set(member.key, emptyBucket())
  for (const doc of docs) {
    for (const byStaff of Object.values(mergeDayDoc(doc))) {
      for (const [staffKey, byShift] of Object.entries(byStaff)) {
        const acc = totals.get(staffKey)
        if (!acc) continue
        for (const sb of wantBuckets) {
          const cell = byShift[sb]
          if (cell) addBucket(acc, cell)
        }
      }
    }
  }

  const params = await getPayrollParams()
  const noEvents: ScoreEvent[] = []

  const rows: Record<string, PayrollRowInput> = {}
  for (const member of STAFF) {
    const b = totals.get(member.key)!
    const onTimeRate = b.replied > 0 ? (b.onTime / b.replied) * 100 : null
    const tagRate = b.tagChecked > 0 ? (b.tagCorrect / b.tagChecked) * 100 : null
    const demoRate =
      b.demoConversations > 0 ? (b.demoClosed / b.demoConversations) * 100 : null
    const closeRate =
      b.convHandled > 0 ? (b.ordersClosed / b.convHandled) * 100 : null
    const missedCount = b.replied > 0 ? b.missed : null

    const sched = schedEval[member.key]
    const pshift = shiftEval[member.key]
    const hasSchedule = Boolean(pshift && pshift.countedShifts > 0)

    const criteria = [
      evaluateCriterion("hours", sched?.hasSchedule ? sched.hoursShort : null),
      evaluateCriterion(
        "attendance",
        sched?.hasSchedule ? sched.attendanceValue : null
      ),
      evaluateCriterion("report", null),
      evaluateCriterion("replyOnTime", onTimeRate, noEvents),
      evaluateCriterion("missed", missedCount, noEvents),
      evaluateCriterion("tagging", tagRate, noEvents),
      evaluateCriterion("closeRate", closeRate),
      evaluateCriterion("demoCloseRate", demoRate),
    ]
    const { rating } = totalScore(criteria)

    const prev = existing?.rows?.[member.key]
    const row = emptyRowInput()
    row.hasSchedule = hasSchedule
    row.countedShifts = pshift?.countedShifts ?? 0
    row.expectedHours = pshift?.expectedHours ?? 0
    row.paidHours = pshift?.paidHours ?? 0
    row.paidLastHourHours = pshift?.paidLastHourHours ?? 0
    row.lateShiftCount = pshift?.lateCount ?? 0
    row.shortAbsenceCount = pshift?.shortAbsenceCount ?? 0
    row.longAbsenceCount = pshift?.longAbsenceCount ?? 0
    row.replyOnTimeRate = onTimeRate == null ? null : round1(onTimeRate)
    row.tagRate = tagRate == null ? null : round1(tagRate)
    row.missedCount = missedCount
    row.demoCloseRate = demoRate == null ? null : round1(demoRate)
    row.ratingLabel = rating
    row.ratingIsExcellent = rating === "Xuất sắc"
    row.demoRevenue = prev?.demoRevenue ?? 0
    row.reportLateCount = prev?.reportLateCount ?? 0
    row.fixedBonusApproved = prev?.fixedBonusApproved ?? false
    rows[member.key] = row
  }

  const warnings: string[] = []
  if (missingDays.length) {
    warnings.push(
      `Chưa đồng bộ ${missingDays.length} ngày trong kỳ (${missingDays
        .slice(0, 5)
        .join(", ")}${missingDays.length > 5 ? "…" : ""}). Vào “Theo dõi công việc” bấm “Đồng bộ ngay”.`
    )
  }
  if (partial) {
    warnings.push(
      "Bản dựng thử — tháng chưa kết thúc, ngày/ca chưa diễn ra không được tính."
    )
  }

  const period: PayrollPeriod = {
    periodId: id,
    year,
    month,
    status: "draft",
    partial,
    builtAtMs: Date.now(),
    builtByName: actorName,
    lockedAtMs: null,
    lockedByName: null,
    paramsUsed: params,
    rows,
    updatedAtMs: Date.now(),
    warnings,
  }
  await ref.set(period)
  await logPayrollChange(id, {
    kind: "build",
    byName: actorName,
    summary: partial ? "Dựng thử bảng lương" : "Dựng bảng lương",
    afterLock: false,
  })
  return period
}

const round1 = (n: number) => Math.round(n * 10) / 10

// ---------------------------------------------------------------- manual edits

export async function savePayrollManual(
  id: string,
  staffKey: string,
  patch: PayrollManualPatch,
  actorName: string,
  reason?: string | null
): Promise<void> {
  const ref = periodDoc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new PayrollError("Chưa dựng bảng lương kỳ này", 404)
  const period = snap.data() as PayrollPeriod
  if (!period.rows?.[staffKey]) {
    throw new PayrollError("Không có dòng lương cho nhân viên này", 404)
  }
  const afterLock = period.status === "locked"
  if (afterLock && !reason?.trim()) {
    throw new PayrollError("Bảng đã chốt — cần nhập lý do điều chỉnh", 409)
  }

  const updates: Record<string, unknown> = { updatedAtMs: Date.now() }
  const parts: string[] = []
  if (typeof patch.demoRevenue === "number") {
    if (patch.demoRevenue < 0) throw new PayrollError("Doanh thu không hợp lệ")
    updates[`rows.${staffKey}.demoRevenue`] = Math.round(patch.demoRevenue)
    parts.push(`doanh thu demo = ${Math.round(patch.demoRevenue).toLocaleString("vi-VN")}`)
  }
  if (typeof patch.reportLateCount === "number") {
    if (patch.reportLateCount < 0 || !Number.isInteger(patch.reportLateCount)) {
      throw new PayrollError("Số lần không hợp lệ")
    }
    updates[`rows.${staffKey}.reportLateCount`] = patch.reportLateCount
    parts.push(`nộp báo cáo trễ = ${patch.reportLateCount} lần`)
  }
  if (typeof patch.fixedBonusApproved === "boolean") {
    updates[`rows.${staffKey}.fixedBonusApproved`] = patch.fixedBonusApproved
    parts.push(patch.fixedBonusApproved ? "duyệt thưởng cố định" : "gỡ thưởng cố định")
  }
  if (parts.length === 0) return

  await ref.update(updates)
  await logPayrollChange(id, {
    kind: "manual",
    byName: actorName,
    staffKey,
    summary: `${staffKey}: ${parts.join(", ")}`,
    afterLock,
    reason: reason ?? null,
  })
}

// ---------------------------------------------------------------- lock / unlock

export async function setPayrollLock(
  id: string,
  locked: boolean,
  actorName: string,
  reason?: string | null
): Promise<void> {
  const ref = periodDoc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new PayrollError("Chưa dựng bảng lương kỳ này", 404)
  const period = snap.data() as PayrollPeriod

  if (locked && period.status === "locked") return
  if (!locked && period.status !== "locked") return
  if (!locked && !reason?.trim()) {
    throw new PayrollError("Cần nhập lý do bỏ chốt", 400)
  }

  await ref.update({
    status: locked ? "locked" : "draft",
    lockedAtMs: locked ? Date.now() : null,
    lockedByName: locked ? actorName : null,
    updatedAtMs: Date.now(),
  })
  await logPayrollChange(id, {
    kind: locked ? "lock" : "unlock",
    byName: actorName,
    summary: locked ? "Chốt bảng lương" : "Bỏ chốt bảng lương",
    afterLock: !locked,
    reason: reason ?? null,
  })
}

// ---------------------------------------------------------------- change log

type ChangeDraft = {
  kind: "build" | "manual" | "lock" | "unlock"
  byName: string
  summary: string
  afterLock: boolean
  staffKey?: string | null
  reason?: string | null
}

async function logPayrollChange(id: string, draft: ChangeDraft): Promise<void> {
  await adminDb()
    .collection("payrollChanges")
    .add({
      periodId: id,
      createdAtMs: Date.now(),
      kind: draft.kind,
      byName: draft.byName,
      staffKey: draft.staffKey ?? null,
      summary: draft.summary,
      afterLock: draft.afterLock,
      reason: draft.reason ?? null,
    })
    .catch(() => {})
}
