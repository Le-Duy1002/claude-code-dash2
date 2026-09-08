import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import {
  PayrollError,
  isPayrollAdmin,
  savePayrollManual,
} from "@/lib/payroll"
import type { PayrollManualPatch } from "@/features/payroll/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!isPayrollAdmin(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { periodId } = await params
  const body = (await request.json().catch(() => ({}))) as {
    staffKey?: string
    patch?: PayrollManualPatch
    reason?: string
  }
  if (!body.staffKey || !body.patch) {
    return NextResponse.json({ error: "thiếu staffKey / patch" }, { status: 400 })
  }

  const actorName = user.name || user.email || "Quản lý"
  try {
    await savePayrollManual(
      periodId,
      body.staffKey,
      body.patch,
      actorName,
      body.reason
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: (error as Error).message || "Lỗi lưu" },
      { status: 500 }
    )
  }
}
