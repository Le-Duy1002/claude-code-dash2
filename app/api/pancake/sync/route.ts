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

/**
 * Crawls Pancake for one or more Vietnam calendar days and writes the
 * per-staff daily aggregate to `pancakeAgentDaily/{date}`.
 *
 *   POST /api/pancake/sync              -> today
 *   POST /api/pancake/sync?days=7       -> the last 7 days (today back)
 *   POST /api/pancake/sync?date=2026-09-01
 *
 * Triggered by the client "Đồng bộ ngay" button and by
 * `.github/workflows/pancake-sync.yml` on a schedule.
 */
export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const dateParam = url.searchParams.get("date")
  const daysParam = Number(url.searchParams.get("days") ?? "1")

  let dates: string[]
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    dates = [dateParam]
  } else {
    const days = Math.min(Math.max(1, daysParam || 1), 31)
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
