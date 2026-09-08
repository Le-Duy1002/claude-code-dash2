import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { adminDb, getRequestUser } from "@/lib/firebase-admin"
import { uploadFileToProjectFolder } from "@/lib/google-drive"
import { ensureProjectDriveFolder } from "@/lib/project-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Vercel caps a serverless request body at ~4.5 MB; keep headroom.
const MAX_BYTES = 4 * 1024 * 1024

/** Uploads a file into the project's Drive folder and records it in the mirror. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { projectId } = await params

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 })
  }

  let folder
  try {
    folder = await ensureProjectDriveFolder(projectId)
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    return NextResponse.json({ error: (error as Error).message }, { status })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let drive
  try {
    drive = await uploadFileToProjectFolder({
      folderId: folder.id,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "drive_upload_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }

  await adminDb()
    .collection("projects")
    .doc(projectId)
    .collection("documents")
    .doc(drive.id)
    .set({
      name: drive.name,
      fileName: drive.name,
      size: drive.size,
      contentType: drive.mimeType,
      driveFileId: drive.id,
      webViewLink: drive.webViewLink,
      driveModifiedTime: drive.modifiedTime,
      uploadedByName: user.name || user.email || "Người dùng",
      source: "web",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

  return NextResponse.json({ ok: true, id: drive.id })
}
