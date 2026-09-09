import { NextResponse } from "next/server"

import { adminAuth } from "@/lib/firebase-admin"
import { syncDays } from "@/features/pancake/services/pancake-sync"
import { vnDatesInRange } from "@/features/pancake/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

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

const ISO = /^\d{4}-\d{2}-\d{2}$/
/** Max days one request will crawl — the client loops for longer spans. */
const MAX_SPAN = 16

/**
 * Crawls Pancake for one or more Vietnam calendar days and writes the
 * per-staff daily aggregate to `pancakeAgentDaily/{date}`.
 *
 *   POST /api/pancake/sync                       -> today
 *   POST /api/pancake/sync?days=7                -> the last 7 days (today back)
 *   POST /api/pancake/sync?date=2026-09-01
 *   POST /api/pancake/sync?from=2026-08-01&to=2026-08-16
 *
 * Page data (tags / conversations / orders) is fetched once for the whole
 * span, so a multi-day run is one conversation walk plus one crawl per day.
 * Triggered by the client "Đồng bộ ngay" / "Đồng bộ kỳ" buttons and by
 * `.github/workflows/pancake-sync.yml` on a schedule.
 */
export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const dateParam = url.searchParams.get("date")
  const fromParam = url.searchParams.get("from")
  const toParam = url.searchParams.get("to")
  const daysParam = Number(url.searchParams.get("days") ?? "1")

  let dates: string[]
  if (dateParam && ISO.test(dateParam)) {
    dates = [dateParam]
  } else if (fromParam && ISO.test(fromParam) && toParam && ISO.test(toParam)) {
    const [lo, hi] = fromParam <= toParam ? [fromParam, toParam] : [toParam, fromParam]
    const all = vnDatesInRange(
      Date.parse(`${lo}T00:00:00+07:00`),
      Date.parse(`${hi}T00:00:00+07:00`) + 86_400_000
    )
    dates = all.slice(0, MAX_SPAN)
  } else {
    const days = Math.min(Math.max(1, daysParam || 1), MAX_SPAN)
    const now = Date.now()
    dates = vnDatesInRange(now - (days - 1) * 86_400_000, now + 1)
  }

  const fresh = url.searchParams.get("fresh") === "1"

  try {
    const docs = await syncDays(dates, fresh)
    return NextResponse.json({
      ok: true,
      days: docs.map((doc) => ({
        date: doc.date,
        convsCrawled: doc.convsCrawled,
        partial: doc.partial,
        warnings: doc.warnings,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "sync_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }
}
