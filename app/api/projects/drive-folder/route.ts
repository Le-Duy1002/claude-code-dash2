import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import { findLinkableFolder } from "@/lib/project-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Checks a pasted link to an existing Drive folder before a new project is
 * created with it, and returns the folder. Writes nothing.
 */
export async function POST(request: Request) {
  if (!(await getRequestUser(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = (await request.json().catch(() => ({}))) as { link?: unknown }
  try {
    const folder = await findLinkableFolder(String(body.link ?? ""))
    return NextResponse.json(folder)
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
