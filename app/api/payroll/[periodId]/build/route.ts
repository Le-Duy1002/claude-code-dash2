import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import {
  PayrollError,
  buildPayrollPeriod,
  isPayrollAdmin,
} from "@/lib/payroll"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

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
  const actorName = user.name || user.email || "Quản lý"
  try {
    const period = await buildPayrollPeriod(periodId, actorName)
    return NextResponse.json(period)
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: (error as Error).message || "Lỗi dựng bảng lương" },
      { status: 500 }
    )
  }
}
