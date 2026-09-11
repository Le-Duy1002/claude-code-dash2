import "server-only"

/**
 * Pancake API access for the work-tracking feature. Read-only.
 *
 * Two products, two auth schemes (see `.env.local`):
 *   POS   — `pos.pages.fm/api/v1`, one `api_key` per shop. Orders, customers,
 *           shop staff.
 *   INBOX — `pages.fm/api/v1`, one account `access_token` covering every page.
 *           Conversations, conversation tags, messages.
 *
 * All Pancake timestamps come back WITHOUT a timezone and are UTC
 * (an order's `inserted_at` is exactly 7h behind its `einvoice_date`, which is
 * Vietnam local). `parsePancakeTime` normalises them to epoch ms.
 */

const POS_BASE =
  process.env.PANCAKE_POS_API_BASE ?? "https://pos.pages.fm/api/v1"
const INBOX_BASE =
  process.env.PANCAKE_INBOX_API_BASE ?? "https://pages.fm/api/v1"
const INBOX_TOKEN = process.env.PANCAKE_INBOX_ACCESS_TOKEN ?? ""

export type PancakeShop = {
  /** Human label, e.g. "Hẻm Tarot". */
  name: string
  /** POS api_key (also identifies the shop server-side). */
  apiKey: string
  /** POS shop id, e.g. "4681569". */
  shopId: string
  /** Facebook page id used by the inbox API, e.g. "103852949161375". */
  fbPageId: string
}

/** The POS shops configured in the environment (`PANCAKE_POS_1..3_*`). */
export function pancakeShops(): PancakeShop[] {
  return [1, 2, 3]
    .map((n) => ({
      name: process.env[`PANCAKE_POS_${n}_NAME`] ?? `Shop ${n}`,
      apiKey: process.env[`PANCAKE_POS_${n}_API_KEY`] ?? "",
      shopId: process.env[`PANCAKE_POS_${n}_SHOP_ID`] ?? "",
      fbPageId: process.env[`PANCAKE_POS_${n}_FB_PAGE_ID`] ?? "",
    }))
    .filter((shop) => shop.apiKey && shop.shopId)
}

/** A Facebook page the CS team works — a POS shop, or inbox-only. */
export type PancakePage = {
  name: string
  fbPageId: string
  /** null for inbox-only pages (no POS shop / order data) */
  shopId: string | null
  apiKey: string | null
}

/**
 * Every page to track: the POS shops, plus inbox-only pages listed in
 * `PANCAKE_INBOX_EXTRA_PAGES` (comma-separated `<fb_page_id>:<name>`).
 */
export function pancakePages(): PancakePage[] {
  const shops: PancakePage[] = pancakeShops().map((s) => ({
    name: s.name,
    fbPageId: s.fbPageId,
    shopId: s.shopId,
    apiKey: s.apiKey,
  }))
  const known = new Set(shops.map((s) => s.fbPageId))
  const extra: PancakePage[] = (process.env.PANCAKE_INBOX_EXTRA_PAGES ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((entry) => {
      const colon = entry.indexOf(":")
      const id = (colon === -1 ? entry : entry.slice(0, colon)).trim()
      const name = colon === -1 ? id : entry.slice(colon + 1).trim() || id
      return { name, fbPageId: id, shopId: null, apiKey: null }
    })
    .filter((p) => p.fbPageId && !known.has(p.fbPageId))
  return [...shops, ...extra]
}

export function hasInboxToken(): boolean {
  return Boolean(INBOX_TOKEN)
}

/** `"2026-09-04T07:05:13.244832"` (UTC, no suffix) -> epoch ms. */
export function parsePancakeTime(value: unknown): number {
  if (typeof value !== "string" || !value) return 0
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

function redact(url: string): string {
  return url.replace(/(api_key|access_token|page_access_token)=[^&]+/g, "$1=***")
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson<T = unknown>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
    if (response.status === 429 && attempt < 3) {
      await sleep(1200 * (attempt + 1))
      continue
    }
    const text = await response.text()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    if (!response.ok) {
      throw new Error(
        `Pancake ${response.status} ${redact(url)} — ${
          typeof body === "string"
            ? body.slice(0, 120)
            : JSON.stringify(body).slice(0, 120)
        }`
      )
    }
    return body as T
  }
}

/**
 * The pages.fm inbox API rate-limits aggressively (HTTP 429). Gate every inbox
 * request through one global limiter: at most `INBOX_MAX_CONCURRENT` in flight
 * and starts spaced `INBOX_MIN_INTERVAL_MS` apart (~8 req/s sustained). The
 * 429 retry in `getJson` is the backstop.
 */
const INBOX_MAX_CONCURRENT = 4
const INBOX_MIN_INTERVAL_MS = 120
let inboxInFlight = 0
let inboxLastStart = 0
const inboxWaiters: (() => void)[] = []

async function inboxAcquire(): Promise<void> {
  while (inboxInFlight >= INBOX_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => inboxWaiters.push(resolve))
  }
  const wait = inboxLastStart + INBOX_MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  inboxLastStart = Date.now()
  inboxInFlight += 1
}

function inboxRelease(): void {
  inboxInFlight -= 1
  inboxWaiters.shift()?.()
}

async function inboxJson<T = unknown>(url: string): Promise<T> {
  await inboxAcquire()
  try {
    return await getJson<T>(url)
  } finally {
    inboxRelease()
  }
}

// ---------------------------------------------------------------- POS: orders

export type PancakeOrder = {
  id: number
  status: number
  statusName: string
  totalPrice: number
  insertedAtMs: number
  updatedAtMs: number
  conversationId: string | null
  sellerId: string | null
  sellerName: string | null
  careId: string | null
  creatorId: string | null
  creatorName: string | null
  tags: string[]
}

function mapOrder(raw: Record<string, unknown>): PancakeOrder {
  const seller = (raw.assigning_seller ?? null) as Record<string, unknown> | null
  const creator = (raw.creator ?? null) as Record<string, unknown> | null
  return {
    id: Number(raw.id ?? raw.system_id ?? 0),
    status: Number(raw.status ?? 0),
    statusName: String(raw.status_name ?? ""),
    totalPrice: Number(raw.total_price ?? 0),
    insertedAtMs: parsePancakeTime(raw.inserted_at),
    updatedAtMs: parsePancakeTime(raw.updated_at),
    conversationId: (raw.conversation_id as string) ?? null,
    sellerId: (raw.assigning_seller_id as string) ?? (seller?.id as string) ?? null,
    sellerName: (seller?.name as string) ?? null,
    careId: (raw.assigning_care_id as string) ?? null,
    creatorId: (creator?.id as string) ?? null,
    creatorName: (creator?.name as string) ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
  }
}

export type OrdersSinceResult = {
  orders: PancakeOrder[]
  /** `true` when the walk stopped (page cap or deadline) before reaching an order older than the deepest checkpoint. */
  truncated: boolean
  /** `true` when the walk reached the very end of this shop's order history. */
  complete: boolean
  /** `page_number` to resume from — pass as `startPage` to continue this walk later. */
  endPage: number
  /** Which of the input `checkpoints` this call structurally confirmed reaching —
   * see `ConversationsSinceResult.reachedCheckpoints`, same idea. */
  reachedCheckpoints: Set<number>
}

/**
 * Orders for a shop, newest first, walking pages until every checkpoint of
 * interest is reached (or `maxPages`/`deadlineMs` is hit). Pancake POS
 * returns orders sorted by `inserted_at` descending, so no server-side date
 * filter is needed. `page_number` is real offset pagination, so resuming
 * from `startPage` after a truncated walk is safe: any churn (new orders
 * inserted since) only causes a little redundant re-fetching of the tail
 * already covered, never a skip. See `fetchConversationsSince` for why
 * `checkpoints` (one per boundary the caller cares about) beats a single
 * `sinceMs`.
 */
export async function fetchOrdersSince(
  shop: PancakeShop,
  checkpoints: number[],
  {
    pageSize = 50,
    maxPages = 40,
    startPage = 1,
    deadlineMs = Infinity,
  }: {
    pageSize?: number
    maxPages?: number
    startPage?: number
    deadlineMs?: number
  } = {}
): Promise<OrdersSinceResult> {
  const sinceMs = Math.min(...checkpoints)
  const ordered = [...new Set(checkpoints)].sort((a, b) => b - a)
  const reachedCheckpoints = new Set<number>()
  let nextCheckpoint = 0

  const out: PancakeOrder[] = []
  let truncated = true
  let complete = false
  let page = startPage
  for (let i = 0; i < maxPages; i += 1) {
    if (Date.now() >= deadlineMs) break
    const url = new URL(`${POS_BASE}/shops/${shop.shopId}/orders`)
    url.searchParams.set("api_key", shop.apiKey)
    url.searchParams.set("page_number", String(page))
    url.searchParams.set("page_size", String(pageSize))
    const body = await getJson<{ data?: Record<string, unknown>[] }>(url.toString())
    const rows = body.data ?? []
    if (rows.length === 0) {
      truncated = false
      complete = true
      for (; nextCheckpoint < ordered.length; nextCheckpoint += 1) {
        reachedCheckpoints.add(ordered[nextCheckpoint])
      }
      break
    }
    page += 1

    let allOlder = true
    let pageMaxInserted = -Infinity
    for (const raw of rows) {
      const order = mapOrder(raw)
      pageMaxInserted = Math.max(pageMaxInserted, order.insertedAtMs)
      if (order.insertedAtMs && order.insertedAtMs < sinceMs) {
        continue
      }
      allOlder = false
      out.push(order)
    }
    while (
      nextCheckpoint < ordered.length &&
      pageMaxInserted < ordered[nextCheckpoint]
    ) {
      reachedCheckpoints.add(ordered[nextCheckpoint])
      nextCheckpoint += 1
    }
    if (allOlder || rows.length < pageSize) {
      truncated = false
      // either every checkpoint is behind us (allOlder) or there's no more
      // data at all (short page) — either way, nothing left to confirm them against
      for (; nextCheckpoint < ordered.length; nextCheckpoint += 1) {
        reachedCheckpoints.add(ordered[nextCheckpoint])
      }
      break
    }
  }
  return { orders: out, truncated, complete, endPage: page, reachedCheckpoints }
}

// ---------------------------------------------------------------- POS: staff

export type PancakeStaff = { id: string; name: string; department: string | null }

export async function fetchShopStaff(shop: PancakeShop): Promise<PancakeStaff[]> {
  const url = new URL(`${POS_BASE}/shops/${shop.shopId}/users`)
  url.searchParams.set("api_key", shop.apiKey)
  const body = await getJson<{ data?: Record<string, unknown>[] }>(url.toString())
  return (body.data ?? []).map((row) => {
    const user = (row.user ?? {}) as Record<string, unknown>
    const dept = (row.department ?? null) as Record<string, unknown> | null
    return {
      id: String(user.id ?? row.user_id ?? ""),
      name: String(user.name ?? "—"),
      department: (dept?.name as string) ?? null,
    }
  })
}

// ---------------------------------------------------------------- INBOX: tags

export type PancakeTag = { id: number; text: string; color: string }

/** The page's tag catalogue, from `settings.tags`. Keyed for name lookup. */
export async function fetchPageTags(fbPageId: string): Promise<Map<number, PancakeTag>> {
  const url = new URL(`${INBOX_BASE}/pages/${fbPageId}/settings`)
  url.searchParams.set("access_token", INBOX_TOKEN)
  const body = await inboxJson<{ settings?: { tags?: Record<string, unknown>[] } }>(
    url.toString()
  )
  const map = new Map<number, PancakeTag>()
  for (const raw of body.settings?.tags ?? []) {
    const id = Number(raw.id)
    if (!Number.isFinite(id)) continue
    map.set(id, {
      id,
      text: String(raw.text ?? `Tag ${id}`),
      color: String(raw.color ?? "#999999"),
    })
  }
  return map
}

// ------------------------------------------------------- INBOX: conversations

export type PancakeConversation = {
  id: string
  pageId: string
  customerName: string
  customerUuid: string | null
  fromPsid: string | null
  tagIds: number[]
  assigneeIds: string[]
  messageCount: number
  lastCustomerAtMs: number
  updatedAtMs: number
  insertedAtMs: number
  /** Pancake user UUID of whoever last sent in the thread, or null (bot). */
  lastSentByUid: string | null
  /** fb_id + when, of staff who recently viewed the thread. */
  recentSeenBy: { fbId: string; name: string; atMs: number }[]
}

function mapConversation(raw: Record<string, unknown>): PancakeConversation {
  const customers = Array.isArray(raw.customers) ? raw.customers : []
  const first = (customers[0] ?? {}) as Record<string, unknown>
  const lastSentBy = (raw.last_sent_by ?? {}) as Record<string, unknown>
  const seen = Array.isArray(raw.recent_seen_users) ? raw.recent_seen_users : []
  return {
    id: String(raw.id ?? ""),
    pageId: String(raw.page_id ?? ""),
    customerName: String(first.name ?? "Khách"),
    customerUuid: (first.id as string) ?? null,
    fromPsid: (raw.from_psid as string) ?? null,
    tagIds: Array.isArray(raw.tags) ? raw.tags.map(Number).filter(Number.isFinite) : [],
    assigneeIds: Array.isArray(raw.assignee_ids) ? raw.assignee_ids.map(String) : [],
    messageCount: Number(raw.message_count ?? 0),
    lastCustomerAtMs: parsePancakeTime(raw.last_customer_interactive_at),
    updatedAtMs: parsePancakeTime(raw.updated_at),
    insertedAtMs: parsePancakeTime(raw.inserted_at),
    lastSentByUid: (lastSentBy.uid as string) ?? null,
    recentSeenBy: (seen as Record<string, unknown>[]).map((entry) => ({
      fbId: String(entry.fb_id ?? ""),
      name: String(entry.fb_name ?? ""),
      atMs: parsePancakeTime(entry.seen_at),
    })),
  }
}

/**
 * Conversations for a page, newest first (by `updated_at`).
 *
 * The pages.fm inbox paginates with a `current_count` CURSOR — the number of
 * conversations the caller already holds — NOT `page_number` (which is silently
 * ignored and always returns the first batch). Walk batches until one lands
 * entirely before `sinceMs`.
 */
export type ConversationsSinceResult = {
  conversations: PancakeConversation[]
  /**
   * `true` when the walk stopped (batch cap or deadline) without ever
   * reaching a page entirely older than the deepest checkpoint — some older
   * conversations may be missing. Resume with `startCursor: endCursor`.
   */
  truncated: boolean
  /** `true` when the walk reached the very end of this page's conversation history. */
  complete: boolean
  /** `current_count` cursor to resume from — pass as `startCursor` to continue this walk later. */
  endCursor: number
  /**
   * Which of the input `checkpoints` this call structurally confirmed
   * reaching: for each one, some batch was found where EVERY item's
   * `touchedAt` was older than it — the same all-of-a-batch guarantee
   * `truncated` uses for the single deepest checkpoint, just checked
   * incrementally for each one as the walk passes it. This is what a
   * calendar day needs to be safe to build from `conversations` — NOT a
   * running min over individual timestamps (that's unsafe: pagination churn
   * can make one item look deeper than anything actually contiguously
   * examined, silently "confirming" a day the walk actually skipped past).
   */
  reachedCheckpoints: Set<number>
}

/**
 * `current_count` is real offset pagination, so resuming a truncated walk
 * from `startCursor` is safe even with churn: if new conversations were
 * touched (bumped to the top) between calls, resuming at the same numeric
 * cursor re-reads a little of the tail already covered — it never skips
 * conversations that lie further back than the cursor.
 *
 * `checkpoints` are the boundaries the caller actually cares about (e.g. one
 * per calendar day it might build) — the walk tracks, as it goes, which of
 * them it has passed with a full batch-old-enough guarantee. Passing every
 * requested day's boundary here (rather than just the single deepest one)
 * is what lets a call confirm a SHALLOWER day the moment the walk reaches
 * it, instead of only trusting the deepest target once the whole walk
 * finishes — which would silently skip shallower days a truncated earlier
 * call already walked past without building.
 */
export async function fetchConversationsSince(
  fbPageId: string,
  checkpoints: number[],
  {
    maxBatches = 25,
    startCursor = 0,
    deadlineMs = Infinity,
  }: { maxBatches?: number; startCursor?: number; deadlineMs?: number } = {}
): Promise<ConversationsSinceResult> {
  const sinceMs = Math.min(...checkpoints)
  // descending: shallowest (largest) first, matching the newest-first walk
  const ordered = [...new Set(checkpoints)].sort((a, b) => b - a)
  const reachedCheckpoints = new Set<number>()
  let nextCheckpoint = 0

  const out: PancakeConversation[] = []
  const seen = new Set<string>()
  let cursor = startCursor
  let truncated = true
  let complete = false

  for (let batch = 0; batch < maxBatches; batch += 1) {
    if (Date.now() >= deadlineMs) break
    const url = new URL(`${INBOX_BASE}/pages/${fbPageId}/conversations`)
    url.searchParams.set("access_token", INBOX_TOKEN)
    url.searchParams.set("current_count", String(cursor))
    const body = await inboxJson<{ conversations?: Record<string, unknown>[] }>(
      url.toString()
    )
    const rows = body.conversations ?? []
    if (rows.length === 0) {
      truncated = false
      complete = true
      for (; nextCheckpoint < ordered.length; nextCheckpoint += 1) {
        reachedCheckpoints.add(ordered[nextCheckpoint])
      }
      break
    }
    cursor += rows.length

    let fresh = 0
    let allOlder = true
    let batchMaxTouched = -Infinity
    for (const raw of rows) {
      const conv = mapConversation(raw)
      if (seen.has(conv.id)) continue
      seen.add(conv.id)
      fresh += 1
      const touchedAt = Math.max(conv.updatedAtMs, conv.lastCustomerAtMs)
      batchMaxTouched = Math.max(batchMaxTouched, touchedAt)
      if (touchedAt && touchedAt >= sinceMs) {
        allOlder = false
        out.push(conv)
      }
    }
    while (
      nextCheckpoint < ordered.length &&
      batchMaxTouched < ordered[nextCheckpoint]
    ) {
      reachedCheckpoints.add(ordered[nextCheckpoint])
      nextCheckpoint += 1
    }
    if (fresh === 0 || allOlder) {
      truncated = false
      break
    }
  }
  return {
    conversations: out,
    truncated,
    complete,
    endCursor: cursor,
    reachedCheckpoints,
  }
}

// ---------------------------------------------------------- INBOX: messages

export type PancakeMessage = {
  id: string
  insertedAtMs: number
  /** "customer" | "staff" | "bot" */
  actor: "customer" | "staff" | "bot"
  senderName: string
  /** Pancake user UUID of the staff sender (`from.uid`), or null. */
  senderUid: string | null
  /** plain-text message body (tags stripped), best effort */
  text: string
}

/**
 * Who sent a message. A message is from the CUSTOMER only when `from.id` is the
 * customer's PSID (i.e. NOT the page id) — every outbound message (a human
 * staff reply, a Botcake flow, a quick-reply template, an auto message) carries
 * the page id in `from.id` / `from.admin_id`. Human staff replies additionally
 * carry `from.uid`; everything else outbound is treated as "bot".
 *
 * The earlier heuristic (no `admin_name` ⇒ customer) misclassified template /
 * page-name outbound messages as customer messages, which inflated response
 * times ("bỏ sót 28 phút" when the agent actually replied in 1 minute).
 */
function classifyActor(
  from: Record<string, unknown>,
  pageId: string
): PancakeMessage["actor"] {
  const fromPage =
    String(from.id ?? "") === pageId || String(from.admin_id ?? "") === pageId
  if (!fromPage) return "customer"
  if (from.uid) return "staff"
  return "bot"
}

function mapMessage(
  raw: Record<string, unknown>,
  pageId: string
): PancakeMessage {
  const from = (raw.from ?? {}) as Record<string, unknown>
  const body = String(raw.original_message ?? raw.message ?? "")
  return {
    id: String(raw.id ?? ""),
    insertedAtMs: parsePancakeTime(raw.inserted_at),
    actor: classifyActor(from, pageId),
    senderName: String(from.admin_name ?? from.name ?? "—"),
    senderUid: (from.uid as string) ?? null,
    text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  }
}

/**
 * Messages of a conversation, oldest first. The endpoint returns only the last
 * ~25 messages and pages backwards with a `current_count` cursor — walk it
 * until the oldest fetched message is before `sinceMs` (default: keep just the
 * last batch).
 */
export async function fetchMessages(
  fbPageId: string,
  conversationId: string,
  customerUuid: string,
  { sinceMs = Infinity, maxBatches = 6 }: { sinceMs?: number; maxBatches?: number } = {}
): Promise<PancakeMessage[]> {
  const byId = new Map<string, PancakeMessage>()
  let cursor = 0

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const url = new URL(
      `${INBOX_BASE}/pages/${fbPageId}/conversations/${conversationId}/messages`
    )
    url.searchParams.set("access_token", INBOX_TOKEN)
    url.searchParams.set("customer_id", customerUuid)
    if (cursor > 0) url.searchParams.set("current_count", String(cursor))
    const body = await inboxJson<{ messages?: Record<string, unknown>[] }>(
      url.toString()
    )
    const rows = body.messages ?? []
    if (rows.length === 0) break
    cursor += rows.length

    let fresh = 0
    let oldest = Infinity
    for (const raw of rows) {
      const message = mapMessage(raw, fbPageId)
      oldest = Math.min(oldest, message.insertedAtMs || Infinity)
      if (byId.has(message.id)) continue
      byId.set(message.id, message)
      fresh += 1
    }
    if (fresh === 0 || oldest < sinceMs) break
  }

  return [...byId.values()].sort((a, b) => a.insertedAtMs - b.insertedAtMs)
}
