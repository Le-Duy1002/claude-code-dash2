import { NextResponse } from "next/server"

import { readCskhReport } from "@/lib/cskh"
import { getRequestUser } from "@/lib/firebase-admin"
import { ISO_DATE, type CskhReport } from "@/features/cskh/types"
import {
  resolveReportRange,
  vnDatesInRange,
  type RangeKey,
} from "@/features/pancake/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const RANGE_KEYS: RangeKey[] = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "7d",
  "thisMonth",
  "lastMonth",
  "30d",
  "60d",
  "90d",
  "custom",
]

/**
 * "Chăm sóc khách hàng" › Thống kê chi tiết for a date range: khách xem per
 * day per staff (live from Pancake's tag statistics) and the closed-customer
 * records relevant to the range. The month/week/day sums are done client-side
 * from these (see `dailyMetrics` / `buildPeriodTree`).
 */
export async function GET(request: Request) {
  if (!(await getRequestUser(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const range = (
    RANGE_KEYS.includes(url.searchParams.get("range") as RangeKey)
      ? url.searchParams.get("range")
      : "thisMonth"
  ) as RangeKey
  const rawFrom = url.searchParams.get("from")
  const rawTo = url.searchParams.get("to")
  const from = rawFrom && ISO_DATE.test(rawFrom) ? rawFrom : null
  const to = rawTo && ISO_DATE.test(rawTo) ? rawTo : null

  const { fromMs, toMs } = resolveReportRange(range, from, to)
  const dates = vnDatesInRange(fromMs, Math.min(toMs, Date.now()))

  try {
    const data = await readCskhReport(dates)
    const report: CskhReport = { fromMs, toMs, dates, ...data }
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      { error: "report_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }
}
