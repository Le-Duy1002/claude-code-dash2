import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import { checkProjectDrive } from "@/lib/project-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * "Kiểm tra Drive" for a project: verifies the app can write into its Drive
 * folder. `{ repair: true }` also recreates a deleted folder and shares the
 * folder with the mirror's service account when needed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  if (!(await getRequestUser(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { projectId } = await params
  const body = (await request.json().catch(() => ({}))) as { repair?: boolean }
  try {
    const result = await checkProjectDrive(projectId, {
      repair: body.repair === true,
    })
    return NextResponse.json(result)
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
