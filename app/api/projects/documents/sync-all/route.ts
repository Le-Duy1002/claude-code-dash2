import { NextResponse } from "next/server"

import { adminAuth } from "@/lib/firebase-admin"
import { reconcileAllProjectDocuments } from "@/lib/project-drive"

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
 * Fallback scan (UC-DOC-04): reconciles every project's document mirror with
 * its Drive folder — the safety net behind the near-realtime webhook.
 */
export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const result = await reconcileAllProjectDocuments()
  return NextResponse.json({ ok: true, ...result })
}
