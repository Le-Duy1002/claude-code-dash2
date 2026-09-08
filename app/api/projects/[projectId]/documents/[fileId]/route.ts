import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { adminDb, getRequestUser } from "@/lib/firebase-admin"
import { deleteProjectFile, renameProjectFile } from "@/lib/google-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ projectId: string; fileId: string }> }

function docRef(projectId: string, fileId: string) {
  return adminDb()
    .collection("projects")
    .doc(projectId)
    .collection("documents")
    .doc(fileId)
}

/** Rename a project document (Drive + mirror for web-uploaded files). */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { projectId, fileId } = await params
  const body = await request.json().catch(() => ({}))
  const name = String(body.name ?? "").trim()
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const ref = docRef(projectId, fileId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  if (snap.get("source") === "web" && name !== snap.get("name")) {
    try {
      await renameProjectFile(fileId, name)
    } catch (error) {
      return NextResponse.json(
        { error: "drive_rename_failed", detail: (error as Error).message },
        { status: 502 }
      )
    }
  }

  await ref.set(
    { name, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
  return NextResponse.json({ ok: true })
}

/** Delete a project document (Drive + mirror for web-uploaded files). */
export async function DELETE(request: Request, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { projectId, fileId } = await params

  const ref = docRef(projectId, fileId)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ ok: true })

  if (snap.get("source") === "web") {
    try {
      await deleteProjectFile(fileId)
    } catch (error) {
      const message = (error as Error).message
      if (!message.includes("404") && !message.includes("File not found")) {
        return NextResponse.json(
          { error: "drive_delete_failed", detail: message },
          { status: 502 }
        )
      }
    }
  }

  await ref.delete()
  return NextResponse.json({ ok: true })
}
