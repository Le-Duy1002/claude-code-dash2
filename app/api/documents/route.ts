import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { adminDb, getRequestUser } from "@/lib/firebase-admin"
import { DRIVE_FOLDER_ID, uploadFileToDrive } from "@/lib/google-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Vercel caps a serverless request body at ~4.5 MB; keep a little headroom.
const MAX_BYTES = 4 * 1024 * 1024

/** Uploads a file to the shared Drive folder and records it in `documents`. */
export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!DRIVE_FOLDER_ID) {
    return NextResponse.json(
      { error: "GOOGLE_DRIVE_FOLDER_ID is not configured" },
      { status: 500 }
    )
  }

  const form = await request.formData()
  const file = form.get("file")
  const description = String(form.get("description") ?? "").trim()

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let drive
  try {
    drive = await uploadFileToDrive({
      folderId: DRIVE_FOLDER_ID,
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
    .collection("documents")
    .doc(drive.id)
    .set({
      name: drive.name,
      description,
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
