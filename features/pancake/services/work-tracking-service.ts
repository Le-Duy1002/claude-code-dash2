import { auth } from "@/lib/firebase"

import type {
  DailyLogResponse,
  PageKey,
  RangeKey,
  ShiftKey,
  WorkReport,
} from "../types"

async function idToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")
  return token
}

/**
 * Reads the evaluated work-tracking report. The server folds the synced daily
 * aggregates (`pancakeAgentDaily/*`) over the selected range / shift / page and
 * scores each staff member. Fast — no live Pancake calls.
 */
export async function fetchWorkTracking(
  params: { range: RangeKey; shift: ShiftKey; page: PageKey },
  signal?: AbortSignal
): Promise<WorkReport> {
  const query = new URLSearchParams({
    range: params.range,
    shift: params.shift,
    page: params.page,
  })
  const response = await fetch(`/api/pancake/work-tracking?${query}`, {
    headers: { Authorization: `Bearer ${await idToken()}` },
    signal,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
  return body as WorkReport
}

/**
 * Reads the "Nhật ký AI theo ngày" table for one staff member — one row per
 * day over the selected range, from the same synced aggregates.
 */
export async function fetchDailyLog(
  params: { staff: string; range: RangeKey; shift: ShiftKey; page: PageKey },
  signal?: AbortSignal
): Promise<DailyLogResponse> {
  const query = new URLSearchParams(params)
  const response = await fetch(`/api/pancake/daily-log?${query}`, {
    headers: { Authorization: `Bearer ${await idToken()}` },
    signal,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
  return body as DailyLogResponse
}

/**
 * Kicks off a crawl of Pancake for the last `days` days and writes the daily
 * aggregates. Slow (crawls every conversation) — the button shows a spinner.
 */
export async function triggerPancakeSync(
  days: number,
  signal?: AbortSignal
): Promise<{ days: { date: string; convsCrawled: number; partial: boolean }[] }> {
  const response = await fetch(`/api/pancake/sync?days=${days}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await idToken()}` },
    signal,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
  return body
}
