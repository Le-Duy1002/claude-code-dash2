import { NextResponse } from "next/server"

import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { pancakePages } from "@/lib/pancake"
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
  resolveReportRange,
  vnDatesInRange,
  type AgentDayBucket,
  type AgentDayDoc,
  type PageKey,
  type RangeKey,
  type ShiftKey,
  type StaffEvaluation,
  type WorkReport,
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
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SHIFT_KEYS: ShiftKey[] = ["all", "sang", "chieu", "toi"]

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

  // ---- pull the synced day docs (doc id == the date)
  const collection = adminDb().collection("pancakeAgentDaily")
  const snaps = await adminDb()
    .getAll(...dates.map((date) => collection.doc(date)))
    .catch(() => [])

  const docs: AgentDayDoc[] = []
  for (const snap of snaps) {
    if (snap.exists) docs.push(snap.data() as AgentDayDoc)
  }
  const haveDates = new Set(docs.map((doc) => doc.date))
  const missingDays = dates.filter((date) => !haveDates.has(date))
  const lastSyncedAtMs = docs.length
    ? Math.max(...docs.map((doc) => doc.syncedAtMs ?? 0))
    : null

  // ---- fold day docs into one bucket per staff
  const totals = new Map<string, AgentDayBucket>()
  for (const member of STAFF) totals.set(member.key, emptyBucket())

  for (const doc of docs) {
    for (const [shopId, byStaff] of Object.entries(mergeDayDoc(doc))) {
      if (wantShops && !wantShops.has(shopId)) continue
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

  // ---- evaluate
  const staff: StaffEvaluation[] = STAFF.map((member) => {
    const b = totals.get(member.key)!
    const onTimeRate = b.replied > 0 ? (b.onTime / b.replied) * 100 : null
    const closeRate =
      b.convHandled > 0 ? (b.ordersClosed / b.convHandled) * 100 : null
    const demoRate =
      b.demoConversations > 0
        ? (b.demoClosed / b.demoConversations) * 100
        : null

    const byTime = (events: ScoreEvent[]) =>
      events.slice().sort((a, c) => a.atMs - c.atMs)
    const tagRate =
      b.tagChecked > 0 ? (b.tagCorrect / b.tagChecked) * 100 : null

    const criteria = [
      evaluateCriterion("hours", null),
      evaluateCriterion("attendance", null),
      evaluateCriterion("report", null),
      evaluateCriterion("replyOnTime", onTimeRate, byTime(b.slowEvents)),
      evaluateCriterion(
        "missed",
        b.replied > 0 ? b.missed : null,
        byTime(b.missedEvents)
      ),
      evaluateCriterion("tagging", tagRate, byTime(b.tagWrongEvents)),
      evaluateCriterion("closeRate", closeRate),
      evaluateCriterion("demoCloseRate", demoRate),
    ]
    const { total, outOf, rating } = totalScore(criteria)

    return {
      key: member.key,
      name: member.name,
      unconfirmed: Boolean(member.unconfirmed),
      criteria,
      total,
      outOf,
      rating,
      detail: {
        ordersTotal: b.ordersTotal,
        ordersClosed: b.ordersClosed,
        revenue: b.revenue,
        convHandled: b.convHandled,
        replies: b.replied,
        onTime: b.onTime,
        slow: b.slow,
        missed: b.missed,
        sampled: b.replied,
        demoConversations: b.demoConversations,
        demoClosed: b.demoClosed,
      },
    }
  })

  const warnings: string[] = []
  if (missingDays.length) {
    warnings.push(
      `Chưa đồng bộ ${missingDays.length} ngày: ${missingDays
        .slice(0, 6)
        .join(", ")}${missingDays.length > 6 ? "…" : ""}. Bấm “Đồng bộ ngay”.`
    )
  }
  if (docs.some((doc) => doc.partial)) {
    warnings.push(
      "Có ngày lượng hội thoại vượt giới hạn crawl — số phản hồi chỉ tính phần gần nhất."
    )
  }
  for (const doc of docs) {
    for (const w of doc.warnings ?? []) {
      if (!warnings.includes(`${doc.date}: ${w}`)) warnings.push(`${doc.date}: ${w}`)
    }
  }

  const payload: WorkReport = {
    fromMs,
    toMs,
    generatedAtMs: Date.now(),
    range,
    shift,
    page,
    pages: allPages.map((p) => ({ id: p.fbPageId, name: p.name })),
    staff,
    responseSampleSize: staff.reduce((sum, s) => sum + s.detail.replies, 0),
    lastSyncedAtMs,
    missingDays,
    warnings,
  }
  return NextResponse.json(payload)
}
