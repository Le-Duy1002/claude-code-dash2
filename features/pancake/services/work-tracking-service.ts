import { auth } from "@/lib/firebase"

import { vnDatesInRange } from "../types"
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

export type RangeParams = {
  range: RangeKey
  shift: ShiftKey
  page: PageKey
  /** `YYYY-MM-DD` (Vietnam), required when `range === "custom"` */
  from?: string | null
  to?: string | null
}

function rangeQuery(params: {
  range: RangeKey
  shift: ShiftKey
  page: PageKey
  from?: string | null
  to?: string | null
  staff?: string
}): URLSearchParams {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, String(v))
  }
  return q
}

const AUTO_SYNC_KEY = "pancake:autoSyncAt"
const AUTO_SYNC_COOLDOWN_MS = 5 * 60_000

/** True if an auto-sync ran (from any Pancake view) within the cooldown. */
export function autoSyncedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(AUTO_SYNC_KEY) ?? 0)
    return Number.isFinite(at) && Date.now() - at < AUTO_SYNC_COOLDOWN_MS
  } catch {
    return false
  }
}

export function markAutoSynced(): void {
  try {
    localStorage.setItem(AUTO_SYNC_KEY, String(Date.now()))
  } catch {
    /* private mode / disabled storage — auto-sync just won't be throttled */
  }
}

/**
 * Reads the evaluated work-tracking report. The server folds the synced daily
 * aggregates (`pancakeAgentDaily/*`) over the selected range / shift / page and
 * scores each staff member. Fast — no live Pancake calls.
 */
export async function fetchWorkTracking(
  params: RangeParams,
  signal?: AbortSignal
): Promise<WorkReport> {
  const query = rangeQuery(params)
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
 * Reads the "Chi tiết thang đo" table for one staff member — one row per
 * day over the selected range, from the same synced aggregates.
 */
export async function fetchDailyLog(
  params: RangeParams & { staff: string },
  signal?: AbortSignal
): Promise<DailyLogResponse> {
  const query = rangeQuery(params)
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

type SyncedDay = {
  date: string
  convsCrawled: number
  partial: boolean
  warnings: string[]
}

/** Re-request a chunk at most this many times before giving up on it and
 * moving on — a genuinely enormous single day (or a page truly stuck deep in
 * history) shouldn't hang the caller forever. */
const MAX_ATTEMPTS_PER_CHUNK = 25
/** ...or this long, whichever comes first. */
const MAX_MS_PER_CHUNK = 10 * 60_000

async function postSyncChunk(
  chunk: string[],
  fresh: boolean | undefined,
  signal: AbortSignal | undefined
): Promise<SyncedDay[]> {
  const q = new URLSearchParams({ from: chunk[0], to: chunk[chunk.length - 1] })
  if (fresh) q.set("fresh", "1")
  const response = await fetch(`/api/pancake/sync?${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await idToken()}` },
    signal,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
  return (body.days ?? []) as SyncedDay[]
}

/**
 * Sync a `YYYY-MM-DD` … `YYYY-MM-DD` span in bounded chunks so a full month
 * never times out. Page data is fetched once per chunk on the server, and
 * each chunk is re-requested (not "fresh" — later calls reuse what earlier
 * ones already crawled) until every one of its dates comes back present and
 * un-`partial`, or the attempt/time budget below runs out. This is what
 * makes a single "Đồng bộ ngay" click actually finish the job: a server call
 * only ever crawls part of a busy day or reaches part of a deep historical
 * range (bounded by the route's own time budget), so without this loop the
 * caller would need to click the button again and again to converge.
 */
export async function syncPancakeRange(
  fromISO: string,
  toISO: string,
  opts: {
    chunkDays?: number
    fresh?: boolean
    signal?: AbortSignal
    onProgress?: (done: number, total: number) => void
  } = {}
): Promise<{ days: SyncedDay[]; incomplete: string[] }> {
  const { chunkDays = 12, fresh, signal, onProgress } = opts
  const [lo, hi] = fromISO <= toISO ? [fromISO, toISO] : [toISO, fromISO]
  const dates = vnDatesInRange(
    Date.parse(`${lo}T00:00:00+07:00`),
    Date.parse(`${hi}T00:00:00+07:00`) + 86_400_000
  )

  const out: SyncedDay[] = []
  const incomplete: string[] = []
  for (let i = 0; i < dates.length; i += chunkDays) {
    const chunk = dates.slice(i, i + chunkDays)
    const byDate = new Map<string, SyncedDay>()
    const chunkStartedAt = Date.now()
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_CHUNK; attempt += 1) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
      for (const day of await postSyncChunk(chunk, fresh, signal)) {
        byDate.set(day.date, day)
      }
      const done = chunk.filter((d) => {
        const day = byDate.get(d)
        return day && !day.partial
      }).length
      onProgress?.(Math.min(i, dates.length) + done, dates.length)
      if (done === chunk.length) break
      if (Date.now() - chunkStartedAt >= MAX_MS_PER_CHUNK) break
    }
    for (const date of chunk) {
      const day = byDate.get(date)
      if (day) out.push(day)
      if (!day || day.partial) incomplete.push(date)
    }
  }
  return { days: out, incomplete }
}
