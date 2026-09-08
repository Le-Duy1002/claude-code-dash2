import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { listFolderFiles } from "@/lib/google-drive"
import { ensureProjectDriveFolder } from "@/lib/project-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

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
 * Reconciles the project's `documents` mirror subcollection with the contents of
 * its Drive folder — the fallback path for the webhook (UC-DOC-04). Files
 * uploaded through the web keep their `source: "web"`; new files found only in
 * Drive get `source: "drive"`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { projectId } = await params

  let folder
  try {
    folder = await ensureProjectDriveFolder(projectId)
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    return NextResponse.json({ error: (error as Error).message }, { status })
  }

  let driveFiles
  try {
    driveFiles = await listFolderFiles(folder.id)
  } catch (error) {
    return NextResponse.json(
      { error: "drive_list_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }

  const db = adminDb()
  const collection = db
    .collection("projects")
    .doc(projectId)
    .collection("documents")
  const snapshot = await collection.get()
  const existing = new Map(snapshot.docs.map((d) => [d.id, d]))

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
      fileName: file.name,
      size: file.size,
      contentType: file.mimeType,
      driveFileId: file.id,
      webViewLink: file.webViewLink,
      driveModifiedTime: file.modifiedTime,
      uploadedByName:
        prev?.get("uploadedByName") ?? file.lastModifyingUser ?? "Google Drive",
      source: prev?.get("source") ?? "drive",
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
