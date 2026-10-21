import { auth } from "@/lib/firebase"

import type { ReportExportResult, ReportKind } from "../types"

/**
 * Builds a report on the server from live data and saves it as a Google
 * Sheet into the project's Drive folder. Can take a minute or two.
 */
export async function exportReport(
  projectId: string,
  params: { kind: ReportKind; from: string; to: string }
): Promise<ReportExportResult> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")

  const response = await fetch(`/api/projects/${projectId}/reports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      body.error ||
        (response.status === 504
          ? "Quá thời gian chờ — thử khoảng ngày ngắn hơn."
          : `Lỗi ${response.status}`)
    )
  }
  return body as ReportExportResult
}
