import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import { PayrollError, isPayrollAdmin, setPayrollLock } from "@/lib/payroll"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
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
    locked?: boolean
    reason?: string
  }
  const actorName = user.name || user.email || "Quản lý"
  try {
    await setPayrollLock(periodId, Boolean(body.locked), actorName, body.reason)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: (error as Error).message || "Lỗi" },
      { status: 500 }
    )
  }
}
