import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import {
  fetchWebUserOrderCounts,
  ORDER_COUNT_FLOOR,
  pancakePages,
} from "@/lib/pancake"
import { STAFF, staffByUid } from "@/features/pancake/staff"
import {
  RANGE_LABELS,
  resolveReportRange,
  vnDatesInRange,
  type RangeKey,
} from "@/features/pancake/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function hourParam(value: string | null, fallback: number): number {
  if (value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(24, Math.round(n))) : fallback
}

/**
 * Closed orders per tracked staff member and page, read live from Pancake's
 * own staff statistics. Unlike `/api/pancake/dashboard` this doesn't go
 * through a sync: the call is fast (under 0.3 s a page), and every past day
 * is available without a backfill.
 */
export async function GET(request: Request) {
  if (!(await getRequestUser(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const rawRange = params.get("range") ?? ""
  const range = (
    Object.keys(RANGE_LABELS).includes(rawRange) ? rawRange : "thisMonth"
  ) as RangeKey
  const dateParam = (key: string) => {
    const value = params.get(key)
    return value && ISO_DATE.test(value) ? value : null
  }
  const hourFrom = hourParam(params.get("hourFrom"), 0)
  const hourTo = Math.max(hourFrom, hourParam(params.get("hourTo"), 24))

  const { fromMs, toMs } = resolveReportRange(
    range,
    dateParam("from"),
    dateParam("to")
  )
  // a day that hasn't come yet has nothing to read
  const dates = vnDatesInRange(fromMs, Math.min(toMs, Date.now()))

  const orders: Record<string, Record<string, number>> = Object.fromEntries(
    STAFF.map((member) => [member.key, {}])
  )
  if (dates.length === 0) return NextResponse.json({ orders, warnings: [] })

  const fromISO = dates[0]
  const toISO = dates[dates.length - 1]
  try {
    await Promise.all(
      pancakePages()
        .filter((page) => page.fbPageId)
        .map(async (page) => {
          const byUid = await fetchWebUserOrderCounts(
            page.fbPageId,
            fromISO,
            toISO,
            hourFrom,
            hourTo
          )
          for (const [uid, count] of Object.entries(byUid)) {
            const member = staffByUid(uid)
            if (!member) continue
            const row = orders[member.key]
            row[page.fbPageId] = (row[page.fbPageId] ?? 0) + count
          }
        })
    )
  } catch (error) {
    return NextResponse.json(
      { error: "pancake_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }

  const floor = ORDER_COUNT_FLOOR.split("-").reverse().join("/")
  const warnings =
    fromISO < ORDER_COUNT_FLOOR
      ? [
          `Pancake chỉ có số đơn theo nhân viên từ ${floor}, các ngày trước đó chưa được tính.`,
        ]
      : []

  return NextResponse.json({ orders, warnings })
}
