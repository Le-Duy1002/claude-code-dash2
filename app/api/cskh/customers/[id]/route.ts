import { NextResponse } from "next/server"

import { CskhError, updateCskhCustomer } from "@/lib/cskh"
import { getRequestUser } from "@/lib/firebase-admin"
import type { CskhCustomerPatch } from "@/features/cskh/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Saves giá bản luận / payments / staff / ngày chốt of one closed customer. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const patch = (await request.json().catch(() => null)) as CskhCustomerPatch | null
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 })
  }

  try {
    const customer = await updateCskhCustomer(
      decodeURIComponent(id),
      patch,
      user.name || user.email || "Người dùng"
    )
    return NextResponse.json({ ok: true, customer })
  } catch (error) {
    if (error instanceof CskhError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: (error as Error).message || "Lỗi lưu" },
      { status: 500 }
    )
  }
}
