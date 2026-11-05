import { NextResponse } from "next/server"

import { deleteCskhViewExtra } from "@/lib/cskh"
import { getRequestUser } from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Takes back one hand-added khách xem entry. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getRequestUser(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  try {
    await deleteCskhViewExtra(decodeURIComponent(id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Lỗi xoá" },
      { status: 500 }
    )
  }
}
