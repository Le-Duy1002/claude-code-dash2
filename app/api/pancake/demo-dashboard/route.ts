import { NextResponse } from "next/server"

import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { STAFF } from "@/features/pancake/staff"
import {
  resolveReportRange,
  vnDatesInRange,
  type AgentDayDoc,
  type RangeKey,
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
  "90d",
  "custom",
]
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

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : null
}

/**
 * Demo funnel: nhắn đến (tag "demo") -> cá nhân xem (tag "{X}Demo") -> cá
 * nhân chốt (tag "{X} Chốt"), summed across both pages (the funnel is about
 * a staff member's own performance, not split by shop). Same fast
 * already-synced-aggregate pattern as `/api/pancake/dashboard` and
 * `/api/pancake/work-tracking`.
 */
export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const range = (
    RANGE_KEYS.includes(url.searchParams.get("range") as RangeKey)
      ? url.searchParams.get("range")
      : "thisMonth"
  ) as RangeKey
  const rawFrom = url.searchParams.get("from")
  const rawTo = url.searchParams.get("to")
  const from = rawFrom && ISO_DATE.test(rawFrom) ? rawFrom : null
  const to = rawTo && ISO_DATE.test(rawTo) ? rawTo : null

  const { fromMs, toMs } = resolveReportRange(range, from, to)
  const dates = vnDatesInRange(fromMs, toMs)

  const collection = adminDb().collection("pancakeAgentDaily")
  const snaps = dates.length
    ? await adminDb()
        .getAll(...dates.map((date) => collection.doc(date)))
        .catch(() => [])
    : []
  const docByDate = new Map<string, AgentDayDoc>()
  for (const snap of snaps) {
    if (snap.exists) docByDate.set(snap.id, snap.data() as AgentDayDoc)
  }
  const missingDays = dates.filter((d) => !docByDate.has(d))

  let sent = 0
  const byStaff = new Map(STAFF.map((s) => [s.key, { viewed: 0, closed: 0 }]))
  const daily: {
    date: string
    sent: number
    byStaff: Record<string, { viewed: number; closed: number }>
  }[] = []

  for (const date of dates) {
    const doc = docByDate.get(date)
    let daySent = 0
    const dayByStaff: Record<string, { viewed: number; closed: number }> = {}
    for (const funnel of Object.values(doc?.demoFunnel ?? {})) {
      daySent += funnel.sent
      for (const [key, acc] of byStaff) {
        const s = funnel.byStaff[key]
        if (!s) continue
        const row = (dayByStaff[key] ??= { viewed: 0, closed: 0 })
        row.viewed += s.viewed
        row.closed += s.closed
        acc.viewed += s.viewed
        acc.closed += s.closed
      }
    }
    sent += daySent
    daily.push({ date, sent: daySent, byStaff: dayByStaff })
  }

  const staff = STAFF.map((s) => {
    const t = byStaff.get(s.key)!
    return { key: s.key, name: s.name, ...t, closeRate: pct(t.closed, t.viewed) }
  })
  const totalViewed = staff.reduce((n, s) => n + s.viewed, 0)
  const totalClosed = staff.reduce((n, s) => n + s.closed, 0)

  const warnings: string[] = []
  if (missingDays.length) {
    warnings.push(
      `Chưa đồng bộ ${missingDays.length} ngày: ${missingDays
        .slice(0, 6)
        .join(", ")}${missingDays.length > 6 ? "…" : ""}. Bấm "Đồng bộ ngay".`
    )
  }
  const hasOldData = dates.some((d) => {
    const doc = docByDate.get(d)
    return doc && !doc.demoFunnel
  })
  if (hasOldData) {
    warnings.push(
      "Một số ngày đã đồng bộ từ trước khi có thống kê demo — bấm \"Đồng bộ ngay\" để cập nhật."
    )
  }

  return NextResponse.json({
    fromMs,
    toMs,
    range,
    sent,
    staff,
    team: {
      sent,
      viewed: totalViewed,
      closed: totalClosed,
      teamCloseRate: pct(totalClosed, totalViewed),
      sentCloseRate: pct(totalClosed, sent),
      responseRate: pct(totalViewed, sent),
    },
    daily,
    missingDays,
    warnings,
  })
}
