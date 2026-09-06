import { NextResponse } from "next/server"

import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { pancakePages } from "@/lib/pancake"
import { STAFF } from "@/features/pancake/staff"
import {
  SHIFT_BUCKET_KEYS,
  SHIFT_BUCKET_LABEL,
  addBucket,
  bucketsForShift,
  emptyBucket,
  mergeDayDoc,
  resolveReportRange,
  vnDatesInRange,
  type AgentDayDoc,
  type DailyLogResponse,
  type DailyLogRow,
  type PageKey,
  type RangeKey,
  type ShiftKey,
} from "@/features/pancake/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const RANGE_KEYS: RangeKey[] = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "7d",
  "thisMonth",
  "lastMonth",
  "30d",
  "60d",
  "custom",
]
const SHIFT_KEYS: ShiftKey[] = ["all", "sang", "chieu", "toi"]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

async function authorize(request: Request): Promise<boolean> {
  const token = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  )
  if (!token) return false
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true
  try {
    await adminAuth().verifyIdToken(token)
    return true
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const allPages = pancakePages()
  const url = new URL(request.url)
  const staffKey = url.searchParams.get("staff") ?? STAFF[0].key
  const member = STAFF.find((s) => s.key === staffKey) ?? STAFF[0]
  const range = (
    RANGE_KEYS.includes(url.searchParams.get("range") as RangeKey)
      ? url.searchParams.get("range")
      : "thisMonth"
  ) as RangeKey
  const shift = (
    SHIFT_KEYS.includes(url.searchParams.get("shift") as ShiftKey)
      ? url.searchParams.get("shift")
      : "all"
  ) as ShiftKey
  const page = (url.searchParams.get("page") ?? "all") as PageKey
  const rawFrom = url.searchParams.get("from")
  const rawTo = url.searchParams.get("to")
  const from = rawFrom && ISO_DATE.test(rawFrom) ? rawFrom : null
  const to = rawTo && ISO_DATE.test(rawTo) ? rawTo : null

  const { fromMs, toMs } = resolveReportRange(range, from, to)
  const dates = vnDatesInRange(fromMs, toMs)
  const wantBuckets = bucketsForShift(shift)
  const wantShops = page === "all" ? null : new Set([page])

  const collection = adminDb().collection("pancakeAgentDaily")
  const snaps = await adminDb()
    .getAll(...dates.map((date) => collection.doc(date)))
    .catch(() => [])
  const byDate = new Map<string, AgentDayDoc>()
  for (const snap of snaps) {
    if (snap.exists) byDate.set(snap.id, snap.data() as AgentDayDoc)
  }

  const rows: DailyLogRow[] = dates.map((date) => {
    const doc = byDate.get(date)
    const partial = doc?.partial ?? false
    // one accumulator per shift bucket, so we can read the worked shifts
    const perBucket = Object.fromEntries(
      SHIFT_BUCKET_KEYS.map((sb) => [sb, emptyBucket()])
    )
    if (doc) {
      for (const [shopId, byStaff] of Object.entries(mergeDayDoc(doc))) {
        if (wantShops && !wantShops.has(shopId)) continue
        const byShift = byStaff[member.key]
        if (!byShift) continue
        for (const sb of wantBuckets) {
          const cell = byShift[sb]
          if (cell) addBucket(perBucket[sb], cell)
        }
      }
    }
    const acc = emptyBucket()
    for (const sb of wantBuckets) addBucket(acc, perBucket[sb])

    const workedShifts = wantBuckets.filter(
      (sb) => sb !== "ngoai" && perBucket[sb].activityHits > 0
    )
    const worked = acc.firstActivityMs > 0
    const hoursWorked = worked
      ? Math.round(
          ((acc.lastActivityMs - acc.firstActivityMs) / 3_600_000) * 10
        ) / 10
      : null

    const notes: string[] = []
    if (!doc) notes.push("chưa đồng bộ")
    else if (partial) notes.push("đang quét dần — đồng bộ lại để bổ sung")
    else if (!worked) notes.push("không thấy hoạt động")
    if (acc.missed > 0) notes.push(`${acc.missed} hội thoại bỏ sót`)
    if (acc.tagWrong > 0) notes.push(`${acc.tagWrong} hội thoại tag sai/thiếu`)

    return {
      date,
      shift: workedShifts.length
        ? workedShifts.map((sb) => SHIFT_BUCKET_LABEL[sb]).join(", ")
        : "—",
      hoursWorked,
      totalConversations: acc.convHandled,
      replyOnTime: acc.onTime,
      replySlow: acc.slow,
      missed: acc.missed,
      tagCorrect: acc.tagCorrect,
      tagWrong: acc.tagWrong,
      demoCustomers: acc.demoConversations,
      demoClosed: acc.demoClosed,
      ordersClosed: acc.ordersClosed,
      note: notes.join(" · "),
      synced: Boolean(doc),
      partial,
    }
  })

  const sum = (pick: (r: DailyLogRow) => number) =>
    rows.reduce((s, r) => s + pick(r), 0)

  const totals = {
    daysWorked: rows.filter((r) => r.hoursWorked != null).length,
    hoursWorked:
      Math.round(
        rows.reduce((s, r) => s + (r.hoursWorked ?? 0), 0) * 10
      ) / 10,
    totalConversations: sum((r) => r.totalConversations),
    replyOnTime: sum((r) => r.replyOnTime),
    replySlow: sum((r) => r.replySlow),
    missed: sum((r) => r.missed),
    tagCorrect: sum((r) => r.tagCorrect),
    tagWrong: sum((r) => r.tagWrong),
    demoCustomers: sum((r) => r.demoCustomers),
    demoClosed: sum((r) => r.demoClosed),
    ordersClosed: sum((r) => r.ordersClosed),
  }

  const missingDays = rows.filter((r) => !r.synced).map((r) => r.date)
  const syncedTimes = [...byDate.values()].map((d) => d.syncedAtMs ?? 0)

  const payload: DailyLogResponse = {
    staffKey: member.key,
    staffName: member.name,
    range,
    fromMs,
    toMs,
    shift,
    page,
    pages: allPages.map((p) => ({ id: p.fbPageId, name: p.name })),
    rows,
    totals,
    missingDays,
    lastSyncedAtMs: syncedTimes.length ? Math.max(...syncedTimes) : null,
  }
  return NextResponse.json(payload)
}
