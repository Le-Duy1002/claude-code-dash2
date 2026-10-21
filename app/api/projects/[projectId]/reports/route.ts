import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import {
  buildPancakeWeeklyReport,
  pancakeWeeklyWorkbook,
} from "@/lib/pancake-weekly-report"
import { saveProjectReport } from "@/lib/project-drive"
import {
  isReportKind,
  reportFileName,
  reportRangeError,
  type ReportExportResult,
} from "@/features/reports/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Xuất báo cáo: builds one report template for `[from, to]` from live
 * Pancake data and saves it into the project's Drive folder as a Google
 * Sheet.
 *
 *   POST /api/projects/<id>/reports  { kind: "pancake-weekly", from, to }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { projectId } = await params
  const body = (await request.json().catch(() => ({}))) as {
    kind?: unknown
    from?: unknown
    to?: unknown
  }
  if (!isReportKind(body.kind)) {
    return NextResponse.json({ error: "Loại báo cáo không hợp lệ" }, { status: 400 })
  }
  const from = String(body.from ?? "")
  const to = String(body.to ?? "")
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
  const rangeError = reportRangeError(from, to, today)
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 })
  }

  try {
    const report = await buildPancakeWeeklyReport(
      from,
      to,
      Date.now() + 200_000
    )
    const buffer = await pancakeWeeklyWorkbook(report)
    const file = await saveProjectReport(
      projectId,
      {
        name: reportFileName(body.kind, from, to),
        buffer,
        kind: body.kind,
        from,
        to,
      },
      user.name || user.email || "Người dùng"
    )
    const result: ReportExportResult = {
      projectId,
      fileId: file.id,
      name: file.name,
      webViewLink: file.webViewLink,
      warnings: report.warnings,
    }
    return NextResponse.json(result)
  } catch (error) {
    const status = (error as { status?: number }).status ?? 502
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
