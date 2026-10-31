import { NextResponse } from "next/server"

import { getRequestUser } from "@/lib/firebase-admin"
import {
  buildPancakeCompareReport,
  buildPancakeWeeklyReport,
  pancakeCompareWorkbook,
  pancakeWeeklyWorkbook,
} from "@/lib/pancake-weekly-report"
import { saveProjectReport } from "@/lib/project-drive"
import {
  compareFileName,
  compareRangeError,
  isReportKind,
  reportFileName,
  reportRangeError,
  type DateRange,
  type ReportExportResult,
} from "@/features/reports/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function asRange(value: unknown): DateRange {
  const r = (value ?? {}) as { from?: unknown; to?: unknown }
  return { from: String(r.from ?? ""), to: String(r.to ?? "") }
}

/**
 * Xuất báo cáo: builds one report template from live Pancake data and saves
 * it into the project's Drive folder as a Google Sheet.
 *
 *   POST /api/projects/<id>/reports  { kind: "pancake-weekly", from, to }
 *   POST /api/projects/<id>/reports  { kind: "pancake-compare",
 *                                      first: { from, to }, second: { from, to } }
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
    first?: unknown
    second?: unknown
  }
  if (!isReportKind(body.kind)) {
    return NextResponse.json({ error: "Loại báo cáo không hợp lệ" }, { status: 400 })
  }
  const kind = body.kind
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
  const first = asRange(body.first)
  const second = asRange(body.second)
  const from = String(body.from ?? "")
  const to = String(body.to ?? "")
  const rangeError =
    kind === "pancake-compare"
      ? compareRangeError(first, second, today)
      : reportRangeError(from, to, today)
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 })
  }

  try {
    const deadlineMs = Date.now() + 200_000
    const report =
      kind === "pancake-compare"
        ? await buildPancakeCompareReport(first, second, deadlineMs)
        : await buildPancakeWeeklyReport(from, to, deadlineMs)
    const buffer =
      kind === "pancake-compare"
        ? await pancakeCompareWorkbook(report)
        : await pancakeWeeklyWorkbook(report)
    const file = await saveProjectReport(
      projectId,
      {
        name:
          kind === "pancake-compare"
            ? compareFileName(first, second)
            : reportFileName(kind, from, to),
        buffer,
        kind,
        // for a comparison, the whole stretch both ranges lie in
        from: report.from,
        to: report.to,
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
