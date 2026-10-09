import { NextResponse } from "next/server"

import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { ORDER_COUNT_FLOOR, pancakePages } from "@/lib/pancake"
import {
  resolveReportRange,
  vnDatesInRange,
  type AgentDayDoc,
  type PageHourlyStats,
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

type PageTotal = {
  newConversations: number
  ordersTotal: number
  ordersClosed: number
}

const emptyTotal = (): PageTotal => ({
  newConversations: 0,
  ordersTotal: 0,
  ordersClosed: 0,
})

function closeRate(t: PageTotal): number | null {
  return t.newConversations > 0
    ? Math.round((t.ordersClosed / t.newConversations) * 1000) / 10
    : null
}

/**
 * Page-level dashboard: new conversations, orders, close rate — gộp chung or
 * per page, filterable by date range AND Vietnam hour-of-day. Reads the
 * already-synced `pancakeAgentDaily/{date}` (no live Pancake calls, same
 * fast pattern as `/api/pancake/work-tracking`). On a full-day (no hour
 * filter) request, "new conversations" and "đơn chốt" prefer Pancake's OWN
 * reported numbers (`.pancakeStats`, from `syncPancakeStatistics`) over our
 * own crawl-derived `.pageHourly` — see `estimatedDays` for which days
 * couldn't use it. Days not yet synced, or only partially crawled, are
 * flagged in `warnings` rather than silently shown as zero.
 */
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
  const rawFrom = url.searchParams.get("from")
  const rawTo = url.searchParams.get("to")
  const from = rawFrom && ISO_DATE.test(rawFrom) ? rawFrom : null
  const to = rawTo && ISO_DATE.test(rawTo) ? rawTo : null
  const clampHour = (v: string | null, fallback: number) => {
    if (v == null) return fallback
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(24, Math.round(n))) : fallback
  }
  const hourFrom = clampHour(url.searchParams.get("hourFrom"), 0)
  const hourTo = Math.max(
    hourFrom,
    clampHour(url.searchParams.get("hourTo"), 24)
  )

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
  const partialDays = [...docByDate.values()]
    .filter((d) => d.partial)
    .map((d) => d.date)
  const lastSyncedAtMs = docByDate.size
    ? Math.max(...[...docByDate.values()].map((d) => d.syncedAtMs ?? 0))
    : null

  const sumHours = (hours: number[]) => {
    let s = 0
    for (let h = hourFrom; h < hourTo; h += 1) s += hours[h] ?? 0
    return s
  }
  // Pancake's own daily figure (`pancakeStats`) has no hour breakdown, so it
  // can only stand in for "new conversations" when the full day is selected
  // — any hour filter falls back to our own hourly crawl, same as orders
  // (Pancake's `/statistics` has no order/close data at all).
  const fullDay = hourFrom === 0 && hourTo === 24

  const totalsByPage = new Map<string, PageTotal>(
    allPages.map((p) => [p.fbPageId, emptyTotal()])
  )
  const daily: { date: string; byPage: Record<string, PageTotal> }[] = []
  // Tracked separately — a day can have Pancake's real "Hội thoại mới" but
  // not yet "Đơn chốt" (or vice versa), e.g. anything before
  // `ORDER_COUNT_FLOOR`, so a combined flag would over- or under-warn.
  const estimatedConvDays = new Set<string>()
  const estimatedOrderDays = new Set<string>()

  for (const date of dates) {
    const doc = docByDate.get(date)
    const row: Record<string, PageTotal> = {}
    for (const p of allPages) {
      const stats: PageHourlyStats | undefined = doc?.pageHourly?.[p.fbPageId]
      const pancakeStat = doc?.pancakeStats?.[p.fbPageId]
      let newConversations: number
      if (fullDay && pancakeStat) {
        newConversations = pancakeStat.newInboxCount
      } else {
        newConversations = stats ? sumHours(stats.newConversations) : 0
        if (doc) estimatedConvDays.add(date)
      }
      let ordersClosed: number
      if (fullDay && pancakeStat?.orderCount != null) {
        ordersClosed = pancakeStat.orderCount
      } else {
        ordersClosed = stats ? sumHours(stats.ordersClosed) : 0
        if (doc) estimatedOrderDays.add(date)
      }
      const t: PageTotal = {
        newConversations,
        ordersTotal: stats ? sumHours(stats.ordersTotal) : 0,
        ordersClosed,
      }
      row[p.fbPageId] = t
      const acc = totalsByPage.get(p.fbPageId)!
      acc.newConversations += t.newConversations
      acc.ordersTotal += t.ordersTotal
      acc.ordersClosed += t.ordersClosed
    }
    daily.push({ date, byPage: row })
  }

  const pages = allPages.map((p) => {
    const t = totalsByPage.get(p.fbPageId)!
    return { id: p.fbPageId, name: p.name, ...t, closeRate: closeRate(t) }
  })
  const combinedTotal = pages.reduce<PageTotal>(
    (acc, p) => ({
      newConversations: acc.newConversations + p.newConversations,
      ordersTotal: acc.ordersTotal + p.ordersTotal,
      ordersClosed: acc.ordersClosed + p.ordersClosed,
    }),
    emptyTotal()
  )

  const warnings: string[] = []
  if (missingDays.length) {
    warnings.push(
      `Chưa đồng bộ ${missingDays.length} ngày: ${missingDays
        .slice(0, 6)
        .join(", ")}${missingDays.length > 6 ? "…" : ""}. Bấm "Đồng bộ ngay".`
    )
  }
  if (partialDays.length) {
    warnings.push(
      `${partialDays.length} ngày còn dữ liệu chưa quét hết: ${partialDays
        .slice(0, 6)
        .join(", ")}${
        partialDays.length > 6 ? "…" : ""
      } — số liệu các ngày này chưa đủ. Bấm "Đồng bộ ngay" để quét tiếp.`
    )
  }
  const hasOldData = dates.some((d) => {
    const doc = docByDate.get(d)
    return doc && !doc.pageHourly
  })
  if (hasOldData) {
    warnings.push(
      "Một số ngày đã đồng bộ từ trước khi có thống kê theo trang — bấm \"Đồng bộ ngay\" để cập nhật."
    )
  }
  const listDays = (ds: string[]) =>
    `${ds.slice(0, 6).join(", ")}${ds.length > 6 ? "…" : ""}`
  if (!fullDay && (estimatedConvDays.size > 0 || estimatedOrderDays.size > 0)) {
    warnings.push(`Lọc theo giờ dùng số tự quét (ước tính) — Pancake không chia theo giờ.`)
  } else {
    if (estimatedConvDays.size > 0) {
      warnings.push(
        `"Hội thoại mới" của ${estimatedConvDays.size} ngày chưa có số từ Pancake, đang dùng số tự quét (ước tính): ${listDays([...estimatedConvDays])}.`
      )
    }
    if (estimatedOrderDays.size > 0) {
      warnings.push(
        `"Đơn chốt" của ${estimatedOrderDays.size} ngày chưa có số từ Pancake (trước ${ORDER_COUNT_FLOOR} hoặc chưa đồng bộ), đang dùng số tự quét (ước tính): ${listDays([...estimatedOrderDays])}.`
      )
    }
  }

  return NextResponse.json({
    fromMs,
    toMs,
    range,
    hourFrom,
    hourTo,
    pages,
    combined: { ...combinedTotal, closeRate: closeRate(combinedTotal) },
    daily,
    estimatedDays: {
      newConversations: [...estimatedConvDays],
      ordersClosed: [...estimatedOrderDays],
    },
    lastSyncedAtMs,
    missingDays,
    warnings,
  })
}
