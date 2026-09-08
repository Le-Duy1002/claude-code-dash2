import { NextResponse } from "next/server"

import { adminAuth } from "@/lib/firebase-admin"
import { registerDriveWatch } from "@/lib/project-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

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
 * Registers / renews the Drive change-feed webhook (UC-DOC-03). Run on a cron
 * every ~12h; renews only when the channel is within a day of expiry.
 * `?force=1` re-registers unconditionally.
 */
export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const force = new URL(request.url).searchParams.get("force") === "1"
  try {
    const result = await registerDriveWatch(force)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: "register_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }
}
