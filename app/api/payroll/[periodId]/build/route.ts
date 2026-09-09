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
  // Dựng bảng lương chỉ đọc dữ liệu + ghi doc nháp — cho phép tài khoản quản
  // trị (token) hoặc job định kỳ (CRON_SECRET), giống các route sync khác.
  const bearer = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  )
  const isCron = Boolean(
    process.env.CRON_SECRET && bearer === process.env.CRON_SECRET
  )

  let actorName = "Hệ thống (tự động)"
  if (!isCron) {
    const user = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
    if (!isPayrollAdmin(user)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
    actorName = user.name || user.email || "Quản lý"
  }

  const { periodId } = await params
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
