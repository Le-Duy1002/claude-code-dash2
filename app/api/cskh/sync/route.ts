import { NextResponse } from "next/server"

import { syncCskhCustomers } from "@/lib/cskh"
import { adminAuth } from "@/lib/firebase-admin"

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

/** Deepest look-back one call will walk. */
const MAX_DAYS = 120

/**
 * Refreshes the Hẻm Trong Đường closed-customer list from Pancake.
 *
 *   POST /api/cskh/sync?days=30   -> conversations touched in the last 30 days
 *
 * The "Đồng bộ ngay" button on the Chăm sóc khách hàng tab calls this for the
 * selected range; the 30-min cron covers the last few days through
 * `/api/pancake/sync`.
 */
export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  const days = Math.min(
    Math.max(1, Number(url.searchParams.get("days") ?? "3") || 3),
    MAX_DAYS
  )
  try {
    const result = await syncCskhCustomers({
      sinceDays: days,
      deadlineMs: Date.now() + 240_000,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: "sync_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }
}
