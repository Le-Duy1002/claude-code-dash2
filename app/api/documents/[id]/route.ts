import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { adminDb, getRequestUser } from "@/lib/firebase-admin"
import { deleteDriveFile, renameDriveFile } from "@/lib/google-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** Rename (and update the description of) a web-uploaded document. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const name = String(body.name ?? "").trim()
  const description = String(body.description ?? "").trim()
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const ref = adminDb().collection("documents").doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  // Files added straight to Drive aren't owned by our OAuth app — only the
  // description (Firestore-only) can change for those.
  if (snapshot.get("source") === "web" && name !== snapshot.get("name")) {
    try {
      await renameDriveFile(id, name)
    } catch (error) {
      return NextResponse.json(
        { error: "drive_rename_failed", detail: (error as Error).message },
        { status: 502 }
      )
    }
  }

  await ref.set(
    { name, description, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
  return NextResponse.json({ ok: true })
}

/** Delete a web-uploaded document from Drive and the mirror. */
export async function DELETE(request: Request, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const ref = adminDb().collection("documents").doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    return NextResponse.json({ ok: true })
  }

  if (snapshot.get("source") === "web") {
    try {
      await deleteDriveFile(id)
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
