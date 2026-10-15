import { NextResponse } from "next/server"

import { CskhError, createCskhDebtor } from "@/lib/cskh"
import { getRequestUser } from "@/lib/firebase-admin"
import type { CskhDebtorInput } from "@/features/cskh/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** "Thêm khách trả nợ" — an old customer's debt payment. */
export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const input = (await request.json().catch(() => null)) as CskhDebtorInput | null
  if (!input || typeof input !== "object") {
    return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 })
  }

  try {
    const customer = await createCskhDebtor(
      input,
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
