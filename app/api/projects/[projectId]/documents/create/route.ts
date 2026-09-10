import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import { createProjectItem } from "@/lib/project-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

/** Creates a subfolder or an empty named file inside a project's Drive tree. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { projectId } = await params

  const body = (await request.json().catch(() => ({}))) as {
    parentId?: string
    name?: string
    isFolder?: boolean
  }
  const name = String(body.name ?? "").trim()
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  const parentId = typeof body.parentId === "string" ? body.parentId : ""
  const isFolder = Boolean(body.isFolder)

  try {
    const actorName = user.name || user.email || "Người dùng"
    const result = await createProjectItem(
      projectId,
      { parentId, name, isFolder },
      actorName
    )
    return NextResponse.json({ ok: true, id: result.id })
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
