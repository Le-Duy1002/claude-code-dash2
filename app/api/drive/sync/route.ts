import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { DRIVE_FOLDER_ID, listFolderFiles } from "@/lib/google-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Accepts either the cron bearer secret (`CRON_SECRET`) or a valid Firebase ID
 * token from a signed-in user (the "Đồng bộ ngay" button).
 */
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
 * Mirrors the shared Google Drive folder into the Firestore `documents`
 * collection: new Drive files are inserted, changed files updated, and files no
 * longer in the folder removed. The Drive file id is used as the Firestore doc
 * id so the mirror is idempotent. User-set `description` is preserved.
 */
export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!DRIVE_FOLDER_ID) {
    return NextResponse.json(
      { error: "GOOGLE_DRIVE_FOLDER_ID is not configured" },
      { status: 500 }
    )
  }

  let driveFiles
  try {
    driveFiles = await listFolderFiles(DRIVE_FOLDER_ID)
  } catch (error) {
    return NextResponse.json(
      { error: "drive_list_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }

  const db = adminDb()
  const collection = db.collection("documents")
  const snapshot = await collection.get()
  const existing = new Map(snapshot.docs.map((doc) => [doc.id, doc]))

  const writer = db.bulkWriter()
  const seen = new Set<string>()
  let created = 0
  let updated = 0
  let deleted = 0

  for (const file of driveFiles) {
    seen.add(file.id)
    const prev = existing.get(file.id)

    const data = {
      name: file.name,
      description: prev?.get("description") ?? "",
      fileName: file.name,
      size: file.size,
      contentType: file.mimeType,
      driveFileId: file.id,
      webViewLink: file.webViewLink,
      driveModifiedTime: file.modifiedTime,
      uploadedByName: file.lastModifyingUser ?? "Google Drive",
      source: "drive",
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (!prev) {
      void writer.set(collection.doc(file.id), {
        ...data,
        createdAt: FieldValue.serverTimestamp(),
      })
      created += 1
    } else if (
      prev.get("driveModifiedTime") !== file.modifiedTime ||
      prev.get("name") !== file.name
    ) {
      void writer.set(collection.doc(file.id), data, { merge: true })
      updated += 1
    }
  }

  for (const [id, doc] of existing) {
    if (!seen.has(id)) {
      void writer.delete(doc.ref)
      deleted += 1
    }
  }

  await writer.close()

  return NextResponse.json({
    ok: true,
    total: driveFiles.length,
    created,
    updated,
    deleted,
  })
}
