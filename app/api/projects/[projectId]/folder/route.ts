import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { createProjectFolder } from "@/lib/google-drive"

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

/** Creates (once) the Google Drive folder for a project. Idempotent. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { projectId } = await params
  const ref = adminDb().collection("projects").doc(projectId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
  }

  const data = snap.data() as Record<string, unknown>
  if (data.driveFolderId) {
    return NextResponse.json({
      driveFolderId: data.driveFolderId as string,
      driveFolderUrl: (data.driveFolderUrl as string) ?? null,
      already: true,
    })
  }

  const name = `${(data.code as string) ?? "PRJ"} ${(data.name as string) ?? ""}`
    .trim()
    .slice(0, 120)

  try {
    const folder = await createProjectFolder(name)
    await ref.update({
      driveFolderId: folder.id,
      driveFolderUrl: folder.webViewLink,
      driveFolderPending: false,
      updatedAt: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({
      driveFolderId: folder.id,
      driveFolderUrl: folder.webViewLink,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
