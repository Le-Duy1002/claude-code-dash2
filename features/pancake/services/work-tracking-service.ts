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

/** A day a range sync couldn't finish, with why (Vietnamese, user-facing). */
export type SyncIssue = { date: string; reason: string }

/**
 * A chunk is re-requested for as long as each call makes progress (a day
 * finishes, conversations get crawled, or the walk moves further back).
 * Only this many calls IN A ROW with no progress at all end it — that's a day
 * genuinely stuck, not one that is merely slow.
 */
const MAX_IDLE_ATTEMPTS = 3
/** Runaway backstop per chunk (~5 min per call → several hours). */
const MAX_ATTEMPTS_PER_CHUNK = 80
/** Waits before retrying a failed call (network blip, 502/504). */
const RETRY_DELAYS_MS = [5_000, 20_000]

/** Server-issued point to continue from (opaque token, see the sync route). */
type WalkResume = { dates: string[]; token: string }

type ChunkResponse = {
  days: SyncedDay[]
  walkAdvanced: boolean
  resume: WalkResume | null
  errors: string[]
}

async function postSyncChunk(
  dates: string[],
  fresh: boolean | undefined,
  signal: AbortSignal | undefined,
  resume: WalkResume | null
): Promise<ChunkResponse> {
  const q = new URLSearchParams({ from: dates[0], to: dates[dates.length - 1] })
  if (fresh) q.set("fresh", "1")
  const response = await fetch(`/api/pancake/sync?${q}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await idToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resume ? { resume: resume.token } : {}),
    signal,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
  return {
    days: (body.days ?? []) as SyncedDay[],
    walkAdvanced: Boolean(body.walkAdvanced),
    resume: (body.resume ?? null) as WalkResume | null,
    errors: Array.isArray(body.errors) ? (body.errors as string[]) : [],
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    })
  })
}

async function postWithRetry(
  ...args: Parameters<typeof postSyncChunk>
): Promise<ChunkResponse> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await postSyncChunk(...args)
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error
      if (attempt >= RETRY_DELAYS_MS.length) throw error
      await wait(RETRY_DELAYS_MS[attempt], args[2])
    }
  }
}

/**
 * Sync a `YYYY-MM-DD` … `YYYY-MM-DD` span — a week, a month, 2–3 months — in
 * chunks of `chunkDays`. Each chunk is re-requested until every one of its
 * days comes back finished (present and not `partial`): when a call runs out
 * of time it returns a resume point, and the next call carries on from there
 * rather than starting over, so even the oldest day of a long range is
 * reached and fully crawled. A chunk only stops early when calls stop making
 * progress (see `MAX_IDLE_ATTEMPTS`) or keep failing; those days come back in
 * `issues` with the reason, and a later sync picks up where this one left.
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
): Promise<{ days: SyncedDay[]; incomplete: string[]; issues: SyncIssue[] }> {
  const { chunkDays = 12, fresh, signal, onProgress } = opts
  const [lo, hi] = fromISO <= toISO ? [fromISO, toISO] : [toISO, fromISO]
  const dates = vnDatesInRange(
    Date.parse(`${lo}T00:00:00+07:00`),
    Date.parse(`${hi}T00:00:00+07:00`) + 86_400_000
  )

  const out: SyncedDay[] = []
  const issues: SyncIssue[] = []
  let finishedBefore = 0
  for (let i = 0; i < dates.length; i += chunkDays) {
    const chunk = dates.slice(i, i + chunkDays)
    const byDate = new Map<string, SyncedDay>()
    const isDone = (d: string) => byDate.get(d)?.partial === false
    const doneCount = () => chunk.filter(isDone).length
    const apiErrors = new Set<string>()
    let failure: string | null = null
    let idle = 0
    let resume: WalkResume | null = null
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_CHUNK; attempt += 1) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
      const before = doneCount()
      // with a resume, ask for exactly its days so the call carries on from
      // where the last one stopped; otherwise the span still unfinished (the
      // route takes a from–to range, so finished days in between are redone)
      const todo = resume?.dates ?? chunk.filter((d) => !isDone(d))
      let res: ChunkResponse
      try {
        res = await postWithRetry(todo, fresh, signal, resume)
      } catch (error) {
        if ((error as Error).name === "AbortError") throw error
        failure = (error as Error).message
        break
      }
      resume = res.resume
      for (const e of res.errors) apiErrors.add(e)
      let crawled = 0
      for (const day of res.days) {
        // progress = crawling toward an unfinished day (a finished day redone
        // in between only picks up brand-new conversations)
        if (todo.includes(day.date)) crawled += day.convsCrawled
        // keep a running total of conversations crawled across attempts
        const prev = byDate.get(day.date)
        byDate.set(day.date, {
          ...day,
          convsCrawled: (prev?.convsCrawled ?? 0) + day.convsCrawled,
        })
      }
      const done = doneCount()
      onProgress?.(finishedBefore + done, dates.length)
      if (done === chunk.length) break
      idle = done > before || crawled > 0 || res.walkAdvanced ? 0 : idle + 1
      if (idle >= MAX_IDLE_ATTEMPTS) break
    }

    const apiNote = apiErrors.size ? ` (${[...apiErrors].join("; ")})` : ""
    for (const date of chunk) {
      const day = byDate.get(date)
      if (day) out.push(day)
      if (isDone(date)) continue
      issues.push({
        date,
        reason: failure
          ? `lỗi khi đồng bộ: ${failure}`
          : day
            ? `còn hội thoại chưa quét hết${apiNote}`
            : `chưa quét tới được ngày này${apiNote}`,
      })
    }
    finishedBefore += doneCount()
  }
  return { days: out, incomplete: issues.map((x) => x.date), issues }
}

/**
 * One Vietnamese line summing up what a range sync couldn't finish, and what
 * to do about it — for the toast after a sync. Empty when nothing is left.
 */
export function describeSyncIssues(issues: SyncIssue[]): string {
  if (issues.length === 0) return ""
  const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`
  const byReason = new Map<string, string[]>()
  for (const { date, reason } of issues) {
    byReason.set(reason, [...(byReason.get(reason) ?? []), date])
  }
  const parts = [...byReason].map(([reason, days]) => {
    const list = days.slice(0, 8).map(dm).join(", ")
    return `${list}${days.length > 8 ? ` … (+${days.length - 8})` : ""}: ${reason}`
  })
  const isError = issues.some((x) => x.reason.startsWith("lỗi"))
  return `Còn ${issues.length} ngày chưa quét xong — ${parts.join(" · ")}. ${
    isError
      ? "Kiểm tra kết nối / token Pancake rồi bấm đồng bộ lại"
      : "Bấm đồng bộ lại để quét tiếp"
  } (phần đã quét được giữ lại).`
}
