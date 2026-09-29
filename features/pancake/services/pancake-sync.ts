import "server-only"

import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { deflateRawSync, inflateRawSync } from "node:zlib"

import { FieldValue } from "firebase-admin/firestore"

import { adminDb } from "@/lib/firebase-admin"
import {
  fetchConversationsSince,
  fetchMessages,
  fetchOrdersSince,
  fetchPageTags,
  hasInboxToken,
  pancakePages,
  type PancakeConversation,
  type PancakeOrder,
  type PancakePage,
  type PancakeShop,
} from "@/lib/pancake"
import { seenStaffByFbId, staffByUid } from "../staff"
import {
  NO_REPLY_NEEDED_TAGS,
  TAG_NAMES,
  addBucket,
  emptyBucket,
  markActivity,
  shiftBucketOf,
  vnDayRange,
  vnHour,
  type AgentDayBucket,
  type AgentDayDoc,
  type BucketTree,
  type ShiftBucketKey,
} from "../types"

type TagSets = {
  demo: Set<number>
  tiemNang: Set<number>
  daChot: Set<number>
  /** demo | thông điệp | hẹn | khách rác — excludes a conv from criteria 4 & 5 */
  noReplyNeeded: Set<number>
}

/** Order statuses that don't count as revenue (huỷ / hoàn) — best effort. */
const CANCELLED_STATUSES = new Set([11, 12, 13, 14, 15, 16])
/**
 * Max NEW conversations to message-crawl per shop per day per sync call.
 * What's left makes the day `partial`; the next call (via the resume)
 * carries on.
 */
const MAX_CRAWL = 450
/** Concurrency for the message crawl (the inbox API is globally throttled). */
const CRAWL_CONCURRENCY = 6
/** Keep only the N most recent offending events per bucket in Firestore. */
const MAX_EVENTS = 40

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

type ShopTree = Record<string, Partial<Record<ShiftBucketKey, AgentDayBucket>>>

function cellOf(tree: ShopTree, staffKey: string, sb: ShiftBucketKey) {
  const byStaff = (tree[staffKey] ??= {})
  return (byStaff[sb] ??= emptyBucket())
}

function trimEvents(tree: ShopTree) {
  const clean = (events: { atMs: number; label: string; detail?: string }[]) => {
    const seen = new Set<string>()
    return events
      .filter((e) => {
        const key = `${e.atMs}|${e.label}|${e.detail ?? ""}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, c) => c.atMs - a.atMs)
      .slice(0, MAX_EVENTS)
  }
  for (const byStaff of Object.values(tree)) {
    for (const b of Object.values(byStaff)) {
      if (!b) continue
      b.slowEvents = clean(b.slowEvents)
      b.missedEvents = clean(b.missedEvents)
      b.tagWrongEvents = clean(b.tagWrongEvents)
    }
  }
}

// -------------------------------------------------- orders (recomputed each run)

/** Bucket a pre-fetched order list into one Vietnam day's [fromMs, toMs). */
function bucketShopOrders(
  orders: PancakeOrder[],
  fromMs: number,
  toMs: number,
  demoTagIds: Set<number>,
  convTags: Map<string, number[]>
): { tree: ShopTree; closedOrderConvIds: Set<string> } {
  const tree: ShopTree = {}
  const closedOrderConvIds = new Set<string>()

  for (const order of orders) {
    if (order.insertedAtMs < fromMs || order.insertedAtMs >= toMs) continue
    const member = staffByUid(order.sellerId)
    if (!member) continue
    const b = cellOf(tree, member.key, shiftBucketOf(order.insertedAtMs))
    b.ordersTotal += 1
    const closed = order.status !== 0 && !CANCELLED_STATUSES.has(order.status)
    if (!closed) continue
    markActivity(b, order.insertedAtMs) // creating an order = at work
    b.ordersClosed += 1
    b.revenue += order.totalPrice
    if (order.conversationId) {
      closedOrderConvIds.add(order.conversationId)
      const tags = convTags.get(order.conversationId) ?? []
      if (tags.some((id) => demoTagIds.has(id))) b.demoClosed += 1
    }
  }
  return { tree, closedOrderConvIds }
}

// ------------------------------------------ inbox (accumulated across sync runs)

async function syncShopInbox(
  shop: Pick<PancakePage, "name" | "fbPageId">,
  fromMs: number,
  toMs: number,
  seedTree: ShopTree,
  processed: Set<string>,
  tagId: TagSets,
  closedOrderConvIds: Set<string>,
  conversations: PancakeConversation[],
  maxCrawl: number = MAX_CRAWL,
  /** stop starting new message crawls past this; the rest wait for the next sync */
  deadlineMs: number = Infinity
): Promise<{ tree: ShopTree; crawled: number; partial: boolean }> {
  // seed from what earlier runs already captured
  const tree: ShopTree = {}
  for (const [staffKey, byShift] of Object.entries(seedTree)) {
    tree[staffKey] = {}
    for (const [sb, cell] of Object.entries(byShift) as [
      ShiftBucketKey,
      AgentDayBucket,
    ][]) {
      const fresh = emptyBucket()
      addBucket(fresh, { ...emptyBucket(), ...cell })
      tree[staffKey][sb] = fresh
    }
  }
  const bucket = (k: string, sb: ShiftBucketKey) => cellOf(tree, k, sb)
  const has = (tags: number[], ids: Set<number>) => tags.some((id) => ids.has(id))

  const inDay = (ms: number) => ms >= fromMs && ms < toMs
  const seenStaff = (conv: (typeof conversations)[number]) =>
    conv.recentSeenBy.filter(
      (s) => inDay(s.atMs) && seenStaffByFbId(s.fbId) != null
    )

  // "seen" markers are a cheap activity signal for non-token-owner staff
  for (const conv of conversations) {
    for (const s of seenStaff(conv)) {
      markActivity(
        bucket(seenStaffByFbId(s.fbId)!.key, shiftBucketOf(s.atMs)),
        s.atMs
      )
    }
  }

  // A conversation belongs to the day the CUSTOMER messaged. `updated_at` is
  // bumped by later bot/tag activity, so it can't be used to date a historical
  // day (it would drop Sep-4 conversations that a bot touched on Sep-5).
  const toCrawl = conversations
    .filter(
      (conv) =>
        conv.customerUuid &&
        inDay(conv.lastCustomerAtMs) &&
        !processed.has(conv.id)
    )
    .sort((a, b) => b.lastCustomerAtMs - a.lastCustomerAtMs)
  const partial = toCrawl.length > maxCrawl
  const crawlSet = toCrawl.slice(0, maxCrawl)

  if (!shop.fbPageId) return { tree, crawled: 0, partial: false }

  type Crawled = {
    conv: (typeof conversations)[number]
    /** tracked staff.key -> earliest message time today */
    handlersToday: Map<string, number>
    /**
     * The response outcome for this conversation, or null when it needs no
     * human (all first-touches handled by Botcake, or this staff never
     * engaged). `minutes` is the FIRST-response time in minutes (crit 4);
     * `kind` also folds in end-of-day abandonment (crit 5).
     */
    response: {
      kind: "onTime" | "slow" | "missed"
      minutes: number | null
      replierKey: string | null
    } | null
  }

  // Botcake's flow has ~30-min gaps mid-sequence, so the window is generous.
  const BOT_GRACE_MS = 20 * 60_000
  // A customer's LAST line that is a thank-you / "I'll contact later" / "no
  // need" needs no reply — not a miss even if unanswered. (User, 06/09.)
  const CLOSING_RE =
    /c[aáảâấ]?m ơn|thank|tks|d[aạ] v[aâ]ng|v[aâ]ng [aạ]|li[eê]n h[eệ].*(sau|l[aạ]i)|nh[aắ]n.*(sau|l[aạ]i)|h[eẹ]n.*(sau|l[aạ]i|g[aặ]p)|đ[eể] (m[iì]nh|em|e|t[oô]i) (xem|suy ngh|tham kh|h[oỏ]i)|khi n[aà]o c[aầ]n|c[aầ]n (th[iì]|g[iì]) (nh[aắ]n|li[eê]n h[eệ]|inbox)|kh[oô]ng c[aầ]n|th[oô]i [aạ]|ok(i|e|ê)?( [aạ]| nha| b[aạ]n)?\s*$/i

  const crawled = await mapLimit<
    (typeof conversations)[number],
    Crawled | null
  >(crawlSet, CRAWL_CONCURRENCY, async (conv) => {
    // out of time: leave it un-`processed` so the next sync crawls it
    if (Date.now() >= deadlineMs) return null
    try {
      const messages = await fetchMessages(
        shop.fbPageId,
        conv.id,
        conv.customerUuid!,
        { sinceMs: fromMs, maxBatches: 10 }
      )
      const handlersToday = new Map<string, number>()
      const staffMsgs = messages.filter(
        (m) => m.actor === "staff" && m.senderUid && staffByUid(m.senderUid)
      )
      for (const m of staffMsgs) {
        if (!inDay(m.insertedAtMs)) continue
        const key = staffByUid(m.senderUid)!.key
        const prev = handlersToday.get(key)
        if (prev == null || m.insertedAtMs < prev) handlersToday.set(key, m.insertedAtMs)
      }

      const botMsgs = messages.filter((m) => m.actor === "bot")
      const botHandled = (atMs: number) =>
        botMsgs.some(
          (b) => b.insertedAtMs > atMs && b.insertedAtMs - atMs <= BOT_GRACE_MS
        )

      // customer messages that actually need a person: after the Botcake
      // first-touch, inside working hours (>= 8h VN)
      const relevant = messages.filter(
        (m) =>
          m.actor === "customer" &&
          inDay(m.insertedAtMs) &&
          vnHour(m.insertedAtMs) >= 8 &&
          !botHandled(m.insertedAtMs)
      )

      let response: Crawled["response"] = null
      if (relevant.length > 0 && handlersToday.size > 0) {
        const staffAfter = (t: number) =>
          staffMsgs.find((s) => s.insertedAtMs > t) ?? null
        const keyOf = (uid: string | null | undefined) =>
          uid ? (staffByUid(uid)?.key ?? null) : null

        const firstCm = relevant[0]
        const firstReply = staffAfter(firstCm.insertedAtMs)
        const firstMin = firstReply
          ? Math.max(
              0,
              (firstReply.insertedAtMs - firstCm.insertedAtMs) / 60_000
            )
          : null

        // "abandoned" only once the last customer line has gone unanswered for
        // 20+ min (measured to now, or to end-of-day for past days) — otherwise
        // a message that just arrived would be a false miss and the conv is
        // never re-crawled this day.
        const last = relevant[relevant.length - 1]
        const deadline = Math.min(toMs, Date.now())
        const abandoned =
          !staffAfter(last.insertedAtMs) &&
          !CLOSING_RE.test(last.text) &&
          deadline - last.insertedAtMs > 20 * 60_000

        const replierKey =
          keyOf(firstReply?.senderUid) ??
          [...handlersToday.keys()][0] ??
          null

        if (abandoned) {
          response = { kind: "missed", minutes: firstMin, replierKey }
        } else if (firstReply && firstMin != null) {
          response = {
            kind: firstMin <= 3 ? "onTime" : "slow",
            minutes: firstMin,
            replierKey,
          }
        }
        // else: first line is a closing note or just arrived — nothing to grade
      }
      return { conv, handlersToday, response }
    } catch {
      return { conv, handlersToday: new Map(), response: null }
    }
  })

  let skipped = 0
  for (const item of crawled) {
    if (!item) {
      skipped += 1
      continue
    }
    processed.add(item.conv.id)
    const conv = item.conv
    if (item.handlersToday.size === 0 && item.response == null) continue

    const hasDemo = has(conv.tagIds, tagId.demo)
    const hasTiemNang = has(conv.tagIds, tagId.tiemNang)
    const hasDaChot = has(conv.tagIds, tagId.daChot)
    const closedHere = closedOrderConvIds.has(conv.id)
    // khách nói vu vơ / hẹn / cảm ơn / broadcast — không cần rep đúng hạn
    const noReplyNeeded = has(conv.tagIds, tagId.noReplyNeeded)

    const evBase = {
      label: conv.customerName,
      customerId: conv.customerUuid ?? undefined,
      pageId: conv.pageId,
      conversationId: conv.id,
    }

    // criterion 6 — the "Đã chốt" tag rule (user, 05/09):
    // customer paid + order created -> must carry "Đã chốt"; "Đã chốt" is valid
    // only alongside "Tiềm năng", OR "Demo" (then "Tiềm năng" not required).
    let ruleApplied = false
    const issues: string[] = []
    if (closedHere || hasDaChot) {
      ruleApplied = true
      if (!hasDaChot) issues.push("có đơn chốt nhưng thiếu tag Đã chốt")
      else if (!hasTiemNang && !hasDemo)
        issues.push("Đã chốt nhưng thiếu tag Tiềm năng (hoặc Demo)")
    }

    // per staff who replied today: "Tổng hội thoại" counts every conversation
    // (1 khách = 1 hội thoại); the response outcome below is what skips the
    // "no reply needed" tags.
    for (const [key, firstMs] of item.handlersToday) {
      const b = bucket(key, shiftBucketOf(firstMs))
      b.convHandled += 1
      if (hasDemo) b.demoConversations += 1
      if (ruleApplied) {
        b.tagChecked += 1
        if (issues.length === 0) b.tagCorrect += 1
        else {
          b.tagWrong += 1
          b.tagWrongEvents.push({
            ...evBase,
            atMs: firstMs,
            detail: issues.join("; "),
          })
        }
      }
    }

    // criteria 4 & 5 — skip conversations tagged Demo* / Thông điệp / Hẹn /
    // Khách rác (không cần rep), and "Đã chốt" ones (khách thường chỉ nhắn
    // một câu cảm ơn cuối hội thoại). They still count in "Tổng hội thoại".
    const r = item.response
    if (!r || noReplyNeeded || hasDaChot) continue
    const key = r.replierKey ?? [...item.handlersToday.keys()][0]
    if (!key) continue
    const at = item.handlersToday.get(key) ?? conv.lastCustomerAtMs
    const b = bucket(key, shiftBucketOf(at))
    b.replied += 1
    const event = { ...evBase, atMs: at }
    if (r.kind === "missed") {
      b.missed += 1
      b.missedEvents.push({ ...event, detail: "bỏ ngỏ tin cuối của khách" })
    } else if (r.kind === "onTime") {
      b.onTime += 1
    } else {
      b.slow += 1
      b.slowEvents.push({
        ...event,
        detail:
          r.minutes == null
            ? "rep chậm"
            : `rep tin đầu sau ${Math.round(r.minutes)}′`,
      })
    }
  }

  trimEvents(tree)
  return {
    tree,
    crawled: crawlSet.length - skipped,
    partial: partial || skipped > 0,
  }
}

// ---------------------------------------------- per-page fetch (once per range)
// The tag catalogue, the conversation list and the order list are pulled ONCE
// for the whole date span, then each day is built by filtering that shared data.
// Syncing a month is one conversation walk, not 30.

type PageInputs = {
  page: PancakePage
  shop: PancakeShop | null
  tagId: TagSets
  conversations: PancakeConversation[]
  convTags: Map<string, number[]>
  orders: PancakeOrder[]
  warnings: string[]
  /**
   * Which requested days' `fromMs` this page's conversation/order walks
   * structurally confirmed reaching (see `fetchConversationsSince`'s
   * `reachedCheckpoints` doc comment) — a day is only safe to build once
   * it's in BOTH sets (or `orderReached` is moot for an inbox-only page).
   * NOT a running min over individual timestamps: pagination churn can make
   * one item look deeper than anything actually contiguously examined,
   * silently "confirming" a day the walk actually skipped past.
   */
  convReached: Set<number>
  orderReached: Set<number>
  /** this call's conversation walk, or null when there was none / it failed */
  walk: { startCursor: number; endCursor: number; startedAtMs: number } | null
}

/**
 * A day is safe to build from a page's fetched data once that page's walk
 * structurally confirmed reaching it (`fromMs` is in `convReached`, and
 * `orderReached` too if the page has a POS shop). Each requested day is its
 * own checkpoint (see `fetchConversationsSince`), so a call confirms a
 * shallow day the moment the walk passes it, without waiting for the
 * deepest requested day.
 */
function dateReachedByPage(pi: PageInputs, fromMs: number): boolean {
  return pi.convReached.has(fromMs) && (!pi.shop || pi.orderReached.has(fromMs))
}

/**
 * Walk-length backstop only — the real bound is the phase-1 deadline. A busy
 * page needs ~8 conversation batches (40 each) per day back (measured
 * 29/09/2026: 217–241 batches, 80–180s, to reach 29 days back), so a guessed
 * cap stops short and the oldest days can never be reached. When the
 * deadline cuts a walk short, the call returns a `WalkResume` instead.
 */
const MAX_WALK_STEPS = 5000

/**
 * How long `fetchPageInputs` (the conversation/order LIST walk) may run
 * before it must stop, leaving the rest of the route's `maxDuration` (300s)
 * for the per-day message crawl below.
 */
const CRAWL_TIME_BUDGET_MS = 150_000
/** Hard stop for the whole route (per-day crawl included), safely under the
 * platform's 300s `maxDuration` kill — which returns no response at all. */
const ROUTE_TIME_BUDGET_MS = 260_000

// ------------------------------------------------ resuming across calls
// Reaching the start of a month takes ~220–250 conversation batches per page
// (2–3 months: 3×), and crawling a busy day's messages takes a minute or
// two, so one call rarely finishes a whole range. Whatever it doesn't finish
// — days it didn't reach, days the clock cut short, days crawled only in
// part — it hands the client as a resume point, and the next call carries on
// from there instead of re-walking from the top (which, for a deep day,
// would eat the whole next call again and never converge).
//
// Resuming from a raw list position alone would lose data: a conversation
// belongs to the day its CUSTOMER last wrote, but the list is ordered by
// `updated_at`, which later bot/staff/tag activity bumps — so part of a day's
// conversations sit ABOVE where the walk has got to (measured: 635 of the
// 2687 conversations of 01–07/09, i.e. ~24%). Those were already walked past,
// so they travel with the resume (`carry`); and each resumed call first
// re-reads everything touched since the previous call began (bumped to the
// top meanwhile) before continuing. Carry + that top-up + the rest of the
// walk = exactly what one walk from the top sees (verified 29/09/2026: 2687
// vs 2687 conversations, no difference).

/** A carried conversation — only the fields building a day reads. */
type CarriedConversation = Pick<
  PancakeConversation,
  | "id"
  | "pageId"
  | "customerName"
  | "customerUuid"
  | "tagIds"
  | "lastCustomerAtMs"
  | "updatedAtMs"
  | "recentSeenBy"
>

type PageResume = {
  /** `current_count` to continue the conversation walk from */
  cursor: number
  /** when the previous call's walk started (the next top-up reads from here) */
  walkStartedAtMs: number
  /** days (of the resume's `dates`) this page's walk has already reached */
  reached: string[]
  /** already-walked conversations the unfinished days need */
  carry: CarriedConversation[]
}

type WalkResumeState = {
  /** the days still unfinished — the next call's work */
  dates: string[]
  /** of `dates`, those a `fresh` sync hasn't rebuilt yet */
  fresh: string[]
  /** by fbPageId */
  pages: Record<string, PageResume>
}

/** Opaque to the client: `dates` to request next, `token` to send back. */
export type WalkResume = { dates: string[]; token: string }

/** Keep the token well under the platform's 4.5 MB request-body limit. */
const MAX_RESUME_TOKEN_CHARS = 3_000_000

function resumeKey(): Buffer | null {
  const secret =
    process.env.CRON_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.PANCAKE_INBOX_ACCESS_TOKEN
  if (!secret) return null
  return createHash("sha256").update(`pancake-walk-resume:${secret}`).digest()
}

/**
 * Compressed + HMAC-signed so the carried conversations (tags, timestamps —
 * they feed the scoring) can't be edited client-side. Null when it can't be
 * issued (no secret configured, or too large to send back).
 */
function encodeResume(state: WalkResumeState): WalkResume | null {
  const key = resumeKey()
  if (!key) return null
  const payload = deflateRawSync(JSON.stringify(state)).toString("base64url")
  const mac = createHmac("sha256", key).update(payload).digest("base64url")
  const token = `${payload}.${mac}`
  if (token.length > MAX_RESUME_TOKEN_CHARS) return null
  return { dates: state.dates, token }
}

function decodeResume(token: unknown): WalkResumeState | null {
  const key = resumeKey()
  if (!key || typeof token !== "string") return null
  const [payload, mac] = token.split(".")
  if (!payload || !mac) return null
  const expected = createHmac("sha256", key).update(payload).digest()
  const given = Buffer.from(mac, "base64url")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null
  }
  try {
    return JSON.parse(
      inflateRawSync(Buffer.from(payload, "base64url")).toString("utf8")
    ) as WalkResumeState
  } catch {
    return null
  }
}

function toCarried(c: PancakeConversation): CarriedConversation {
  return {
    id: c.id,
    pageId: c.pageId,
    customerName: c.customerName,
    customerUuid: c.customerUuid,
    tagIds: c.tagIds,
    lastCustomerAtMs: c.lastCustomerAtMs,
    updatedAtMs: c.updatedAtMs,
    recentSeenBy: c.recentSeenBy,
  }
}

function fromCarried(c: CarriedConversation): PancakeConversation {
  return {
    ...c,
    fromPsid: null,
    assigneeIds: [],
    messageCount: 0,
    insertedAtMs: 0,
    lastSentByUid: null,
  }
}

/** Conversations from `pi` that building any of `days` can use. */
function carryFor(pi: PageInputs, days: string[]): CarriedConversation[] {
  const spans = days.map((d) => vnDayRange(d))
  const inDays = (ms: number) =>
    spans.some((s) => ms >= s.fromMs && ms < s.toMs)
  const orderConvIds = new Set(
    pi.orders
      .filter((o) => inDays(o.insertedAtMs) && o.conversationId)
      .map((o) => o.conversationId!)
  )
  return pi.conversations
    .filter(
      (c) =>
        inDays(c.lastCustomerAtMs) ||
        c.recentSeenBy.some((s) => inDays(s.atMs)) ||
        orderConvIds.has(c.id)
    )
    .map(toCarried)
}

async function fetchPageInputs(
  page: PancakePage,
  dates: string[],
  deadlineMs: number,
  /** continue this page's walk from an earlier call (see `WalkResume`) */
  resumeFrom?: PageResume
): Promise<PageInputs> {
  const warnings: string[] = []
  const tagId: TagSets = {
    demo: new Set<number>(),
    tiemNang: new Set<number>(),
    daChot: new Set<number>(),
    noReplyNeeded: new Set<number>(),
  }
  const fromOf = (date: string) => vnDayRange(date).fromMs
  const checkpoints = dates.map(fromOf)
  let conversations: PancakeConversation[] = []
  let walk: PageInputs["walk"] = null
  // Every checkpoint ("nothing to wait on") when there's no inbox/shop
  // configured, so a missing token/shop can't block every date from ever
  // being built.
  let convReached = !hasInboxToken() || !page.fbPageId ? new Set(checkpoints) : new Set<number>()
  let orderReached = !page.apiKey || !page.shopId ? new Set(checkpoints) : new Set<number>()

  const shop: PancakeShop | null =
    page.apiKey && page.shopId
      ? {
          name: page.name,
          apiKey: page.apiKey,
          shopId: page.shopId,
          fbPageId: page.fbPageId,
        }
      : null

  // The inbox (conversations) and POS (orders) walks hit different APIs and
  // are independent, so they run side by side — one after the other, a
  // conversation walk that uses the whole phase-1 budget would leave the
  // order walk no time at all, and then no day could be built.
  const inboxWalk = async () => {
    if (!hasInboxToken() || !page.fbPageId) return
    try {
      for (const tag of (await fetchPageTags(page.fbPageId)).values()) {
        const text = tag.text.trim().toLowerCase()
        const isDemo = text.includes("demo")
        if (isDemo) tagId.demo.add(tag.id)
        if (text === TAG_NAMES.tiemNang) tagId.tiemNang.add(tag.id)
        if (text === TAG_NAMES.daChot) tagId.daChot.add(tag.id)
        if (isDemo || NO_REPLY_NEEDED_TAGS.includes(text)) {
          tagId.noReplyNeeded.add(tag.id)
        }
      }
    } catch (error) {
      warnings.push(`${page.name}: tag — ${(error as Error).message}`)
    }
    const startedAtMs = Date.now()
    if (resumeFrom) {
      try {
        // everything touched since the previous call began (bumped above its
        // position meanwhile) — must be read in full to resume safely
        const topUp = await fetchConversationsSince(
          page.fbPageId,
          [resumeFrom.walkStartedAtMs],
          { maxBatches: MAX_WALK_STEPS, deadlineMs }
        )
        if (!topUp.truncated) {
          const already = new Set(resumeFrom.reached)
          const toReach = dates.filter((d) => !already.has(d))
          const rest = toReach.length
            ? await fetchConversationsSince(page.fbPageId, toReach.map(fromOf), {
                maxBatches: MAX_WALK_STEPS,
                startCursor: resumeFrom.cursor,
                deadlineMs,
              })
            : null
          // later sources are fresher: carry < rest of the walk < top-up
          const merged = new Map<string, PancakeConversation>()
          for (const c of [
            ...resumeFrom.carry.map(fromCarried),
            ...(rest?.conversations ?? []),
            ...topUp.conversations,
          ]) {
            merged.set(c.id, c)
          }
          conversations = [...merged.values()]
          convReached = new Set([
            ...[...already].filter((d) => dates.includes(d)).map(fromOf),
            ...(rest?.reachedCheckpoints ?? []),
          ])
          walk = {
            startCursor: resumeFrom.cursor,
            endCursor: rest?.endCursor ?? resumeFrom.cursor,
            startedAtMs,
          }
          return
        }
      } catch (error) {
        warnings.push(`${page.name}: hội thoại — ${(error as Error).message}`)
      }
      // couldn't resume safely — fall back to a walk from the top
    }
    try {
      const result = await fetchConversationsSince(page.fbPageId, checkpoints, {
        maxBatches: MAX_WALK_STEPS,
        deadlineMs,
      })
      conversations = result.conversations
      convReached = result.reachedCheckpoints
      walk = { startCursor: 0, endCursor: result.endCursor, startedAtMs }
      // A cut-short walk is NOT a day warning: only days the walk reached get
      // built, so it never concerns a built day. The rest go into the resume.
    } catch (error) {
      warnings.push(`${page.name}: hội thoại — ${(error as Error).message}`)
    }
  }

  // Orders are re-walked from the top every call: ~15 pages a month, and
  // `inserted_at` never changes, so there's no carry to worry about.
  let orders: PancakeOrder[] = []
  const orderWalk = async () => {
    if (!shop) return
    try {
      const result = await fetchOrdersSince(shop, checkpoints, {
        pageSize: 100,
        maxPages: MAX_WALK_STEPS,
        deadlineMs,
      })
      orders = result.orders
      orderReached = result.reachedCheckpoints
    } catch (error) {
      warnings.push(`${page.name}: đơn hàng — ${(error as Error).message}`)
    }
  }

  await Promise.all([inboxWalk(), orderWalk()])

  // one conversation can come back on two inbox pages — dedupe by id
  const byId = new Map(conversations.map((c) => [c.id, c]))
  conversations = [...byId.values()]
  const convTags = new Map(conversations.map((c) => [c.id, c.tagIds]))

  return {
    page,
    shop,
    tagId,
    conversations,
    convTags,
    orders,
    warnings,
    convReached,
    orderReached,
    walk,
  }
}

/** Build one Vietnam day's `pancakeAgentDaily/{date}` from pre-fetched inputs. */
async function buildDay(
  dateISO: string,
  inputs: PageInputs[],
  fresh: boolean,
  crawlDeadlineMs: number = Infinity
): Promise<AgentDayDoc> {
  const { fromMs, toMs } = vnDayRange(dateISO)
  const warnings: string[] = []
  if (!hasInboxToken()) {
    warnings.push("PANCAKE_INBOX_ACCESS_TOKEN chưa cấu hình — bỏ qua inbox.")
  }

  const ref = adminDb().collection("pancakeAgentDaily").doc(dateISO)
  const existing = fresh
    ? undefined
    : ((await ref.get().catch(() => null))?.data() as AgentDayDoc | undefined)
  const processed = new Set<string>(existing?.processedConvIds ?? [])

  const orderData: BucketTree = {}
  const inboxData: BucketTree = {}
  let convsCrawled = 0
  let partial = false

  for (const input of inputs) {
    const fbPageId = input.page.fbPageId
    const { tree: orderTree, closedOrderConvIds } = input.shop
      ? bucketShopOrders(
          input.orders,
          fromMs,
          toMs,
          input.tagId.demo,
          input.convTags
        )
      : { tree: {} as ShopTree, closedOrderConvIds: new Set<string>() }
    orderData[fbPageId] = orderTree

    const inbox = await syncShopInbox(
      input.page,
      fromMs,
      toMs,
      (existing?.inboxData?.[fbPageId] as ShopTree) ?? {},
      processed,
      input.tagId,
      closedOrderConvIds,
      input.conversations,
      MAX_CRAWL,
      crawlDeadlineMs
    )
    inboxData[fbPageId] = inbox.tree
    convsCrawled += inbox.crawled
    partial = partial || inbox.partial
  }

  const doc: AgentDayDoc = {
    date: dateISO,
    syncedAtMs: Date.now(),
    convsCrawled,
    partial,
    shops: inputs.map((i) => ({ id: i.page.fbPageId, name: i.page.name })),
    orderData,
    inboxData,
    processedConvIds: [...processed].slice(-4000),
    warnings: [...new Set([...warnings, ...inputs.flatMap((i) => i.warnings)])],
  }

  await ref.set({ ...doc, updatedAt: FieldValue.serverTimestamp() })
  return doc
}

export type SyncDaysResult = {
  /** the days built this call (a day the walk didn't reach is absent) */
  docs: AgentDayDoc[]
  /**
   * The conversation walk got further than where it started — progress
   * toward days not built yet, even when `docs` is empty.
   */
  walkAdvanced: boolean
  /**
   * Set when some requested day isn't finished (not reached, cut short by
   * the clock, or crawled only in part): request exactly `resume.dates`
   * next, passing `resume.token` back, and that call carries on from here.
   */
  resume: WalkResume | null
  /** Pancake API errors this call hit (a failed walk builds no day at all) */
  errors: string[]
}

/**
 * Sync a set of Vietnam calendar days, oldest first. Page data (tags,
 * conversations, orders) is fetched ONCE for the whole span, so syncing 30
 * days costs one conversation walk plus one message crawl per day.
 * `fresh` rebuilds each day from scratch, ignoring earlier syncs.
 * `resumeToken` continues from an earlier call's `resume` (it must be for
 * days inside `dates`; `fresh` then comes from the resume).
 */
export async function syncDays(
  dates: string[],
  fresh = false,
  resumeToken: string | null = null
): Promise<SyncDaysResult> {
  const requested = [...new Set(dates)].sort()
  if (requested.length === 0) {
    return { docs: [], walkAdvanced: false, resume: null, errors: [] }
  }

  const state = decodeResume(resumeToken)
  const resume =
    state &&
    state.dates.length > 0 &&
    state.dates.every((d) => requested.includes(d))
      ? state
      : null
  const pending = resume ? [...resume.dates].sort() : requested
  const freshDays = new Set(resume ? resume.fresh : fresh ? pending : [])

  const pages = pancakePages()
  const startedAt = Date.now()
  const phase1DeadlineMs = startedAt + CRAWL_TIME_BUDGET_MS
  const routeDeadlineMs = startedAt + ROUTE_TIME_BUDGET_MS
  const inputs = await Promise.all(
    pages.map((page) =>
      fetchPageInputs(
        page,
        pending,
        phase1DeadlineMs,
        resume?.pages[page.fbPageId]
      )
    )
  )

  const out: AgentDayDoc[] = []
  for (const date of pending) {
    if (Date.now() >= routeDeadlineMs) break
    const { fromMs } = vnDayRange(date)
    if (!inputs.every((pi) => dateReachedByPage(pi, fromMs))) continue
    // the crawl itself also stops at the deadline — what's left of the day
    // comes back `partial` and goes into the resume
    out.push(await buildDay(date, inputs, freshDays.has(date), routeDeadlineMs))
  }

  const finished = new Set(out.filter((d) => !d.partial).map((d) => d.date))
  const built = new Set(out.map((d) => d.date))
  const unfinished = pending.filter((d) => !finished.has(d))
  const errors = [...new Set(inputs.flatMap((pi) => pi.warnings))]

  let resumeOut: WalkResume | null = null
  let walkAdvanced = false
  const walked = inputs.filter((pi) => hasInboxToken() && pi.page.fbPageId)
  if (unfinished.length > 0 && walked.every((pi) => pi.walk)) {
    resumeOut = encodeResume({
      dates: unfinished,
      fresh: unfinished.filter((d) => freshDays.has(d) && !built.has(d)),
      pages: Object.fromEntries(
        walked.map((pi) => [
          pi.page.fbPageId,
          {
            cursor: pi.walk!.endCursor,
            walkStartedAtMs: pi.walk!.startedAtMs,
            reached: unfinished.filter((d) =>
              pi.convReached.has(vnDayRange(d).fromMs)
            ),
            carry: carryFor(pi, unfinished),
          },
        ])
      ),
    })
    if (!resumeOut) {
      errors.push(
        "Không tạo được điểm quét tiếp (quá nhiều hội thoại chưa xong trong một đợt) — lần sau sẽ quét lại từ đầu."
      )
    }
    walkAdvanced = walked.some((pi) => pi.walk!.endCursor > pi.walk!.startCursor)
  }

  return { docs: out, walkAdvanced, resume: resumeOut, errors }
}

/** Sync a single Vietnam calendar day. */
export async function syncDay(
  dateISO: string,
  fresh = false
): Promise<AgentDayDoc | undefined> {
  const { docs } = await syncDays([dateISO], fresh)
  return docs[0]
}
