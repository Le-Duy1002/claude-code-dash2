import "server-only"

import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { deflateRawSync, inflateRawSync } from "node:zlib"

import { FieldValue } from "firebase-admin/firestore"

import {
  addDays,
  coverByHour,
  getCell,
  isoFromDate,
  mapScheduleWeek,
  mondayOf,
  weekIdsForDates,
  weekdayMon0,
  type ScheduleWeek,
} from "@/features/schedule/types"
import { adminDb } from "@/lib/firebase-admin"
import {
  fetchConversationsSince,
  fetchMessages,
  fetchOrdersSince,
  fetchPageTags,
  fetchWebPageStatistics,
  fetchWebTagStatistics,
  hasInboxToken,
  pancakePages,
  type PancakeConversation,
  type PancakeOrder,
  type PancakePage,
  type PancakeShop,
} from "@/lib/pancake"
import {
  gradeConversation,
  shiftSpanAt,
  type GradedMessage,
  type OnDuty,
  type ReplyOutcome,
  type StaffReply,
} from "../reply-grading"
import { seenStaffByFbId, staffByUid } from "../staff"
import {
  DEMO_CLOSED_TAG_BY_STAFF,
  DEMO_VIEWED_TAG_BY_STAFF,
  NO_REPLY_NEEDED_TAGS,
  TAG_NAMES,
  addBucket,
  emptyBucket,
  emptyDemoFunnelStats,
  emptyPageHourlyStats,
  markActivity,
  shiftBucketOf,
  vnDayRange,
  vnHour,
  type AgentDayBucket,
  type AgentDayDoc,
  type BucketTree,
  type DemoFunnelStats,
  type PageHourlyStats,
  type PancakeDayStat,
  type ShiftBucketKey,
} from "../types"

type TagSets = {
  /** false when the page's tag catalogue couldn't be fetched */
  loaded: boolean
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

/**
 * One graded conversation of a day. Grading a conversation's messages is
 * settled once its outcome is final, but staff often tag it later — e.g.
 * "Hẹn" days after the customer went quiet — so everything that depends on
 * tags is NOT frozen at grading time: the day keeps these records and
 * re-scores them on every sync with the conversation's current tags
 * (user, 10/10/2026).
 */
type ConvRecord = {
  label: string
  customerId?: string
  pageId: string
  /** refreshed from the conversation list on every sync */
  tagIds: number[]
  /** tracked staff.key -> earliest message time that day */
  handlers: Record<string, number>
  outcomes: Pick<ReplyOutcome, "staffKey" | "kind" | "atMs" | "detail">[]
}

/** conversation id -> record, for one page */
type ConvRecords = Map<string, ConvRecord>

// Stored as one JSON string per page: as a Firestore map, every field of
// every record would get its own index entries (40k max per document).
function encodeRecords(records: ConvRecords): string {
  return JSON.stringify(Object.fromEntries(records))
}

function decodeRecords(json: string | undefined): ConvRecords {
  if (!json) return new Map()
  return new Map(Object.entries(JSON.parse(json) as Record<string, ConvRecord>))
}

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

/**
 * Raw per-page totals for one Vietnam day, bucketed by local hour — NOT
 * staff-attributed (unlike `bucketShopOrders`/`syncShopInbox`, which only
 * count what a tracked staff member touched). Feeds the page-level dashboard
 * (new conversations / orders / close rate, filterable by hour-of-day), kept
 * entirely separate from the staff-scoring trees above.
 */
function bucketPageHourly(
  conversations: PancakeConversation[],
  orders: PancakeOrder[],
  fromMs: number,
  toMs: number
): PageHourlyStats {
  const stats = emptyPageHourlyStats()
  for (const conv of conversations) {
    if (conv.lastCustomerAtMs < fromMs || conv.lastCustomerAtMs >= toMs) continue
    stats.newConversations[vnHour(conv.lastCustomerAtMs)] += 1
  }
  for (const order of orders) {
    if (order.insertedAtMs < fromMs || order.insertedAtMs >= toMs) continue
    const h = vnHour(order.insertedAtMs)
    stats.ordersTotal[h] += 1
    const closed = order.status !== 0 && !CANCELLED_STATUSES.has(order.status)
    if (closed) stats.ordersClosed[h] += 1
  }
  return stats
}

/**
 * Demo funnel for one Vietnam day: `demo` tag (sent, team-wide) and each
 * staff member's "assigned/viewed" and "closed" tags (see
 * `DEMO_VIEWED_TAG_BY_STAFF`/`DEMO_CLOSED_TAG_BY_STAFF`) — day attribution
 * matches `bucketPageHourly`/`syncShopInbox`: the day the CUSTOMER last
 * wrote, not whenever a tag happened to be toggled.
 */
function bucketDemoFunnel(
  conversations: PancakeConversation[],
  fromMs: number,
  toMs: number,
  demoTagId: DemoTagIds
): DemoFunnelStats {
  const stats = emptyDemoFunnelStats()
  for (const staffKey of Object.keys(demoTagId.viewedByStaff)) {
    stats.byStaff[staffKey] = { viewed: 0, closed: 0 }
  }
  const hasAny = (conv: PancakeConversation, ids: Set<number>) =>
    conv.tagIds.some((id) => ids.has(id))
  for (const conv of conversations) {
    if (conv.lastCustomerAtMs < fromMs || conv.lastCustomerAtMs >= toMs) continue
    if (hasAny(conv, demoTagId.sent)) stats.sent += 1
    for (const [staffKey, ids] of Object.entries(demoTagId.viewedByStaff)) {
      if (hasAny(conv, ids)) stats.byStaff[staffKey].viewed += 1
    }
    for (const [staffKey, ids] of Object.entries(demoTagId.closedByStaff)) {
      if (hasAny(conv, ids)) stats.byStaff[staffKey].closed += 1
    }
  }
  return stats
}

// ------------------------------------------ inbox (accumulated across sync runs)

async function syncShopInbox(
  shop: Pick<PancakePage, "name" | "fbPageId">,
  fromMs: number,
  toMs: number,
  /** activity captured by earlier runs — the scoring is rebuilt from `records` */
  seedTree: ShopTree,
  processed: Set<string>,
  /** this page's graded conversations so far; newly graded ones are added */
  records: ConvRecords,
  tagId: TagSets,
  closedOrderConvIds: Set<string>,
  conversations: PancakeConversation[],
  maxCrawl: number = MAX_CRAWL,
  /** stop starting new message crawls past this; the rest wait for the next sync */
  deadlineMs: number = Infinity,
  /** who the shift schedule puts on duty at an instant */
  onDuty: OnDuty = () => null
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
    /** customer messages that need a person, oldest first */
    customer: GradedMessage[]
    /** tracked staff messages (may run past the day), oldest first */
    replies: StaffReply[]
  }

  // Botcake's flow has ~30-min gaps mid-sequence, so the window is generous.
  const BOT_GRACE_MS = 20 * 60_000
  // A customer line that is a thank-you / "I'll contact later" / "no need"
  // needs no reply — not a miss even if unanswered. (User, 06/09.) "Đợi em
  // xíu" DOES need a reply (user, 29/09).
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
      const replies: StaffReply[] = []
      for (const m of messages) {
        const member = m.actor === "staff" ? staffByUid(m.senderUid) : null
        if (!member) continue
        replies.push({ atMs: m.insertedAtMs, staffKey: member.key })
        if (!inDay(m.insertedAtMs)) continue
        const prev = handlersToday.get(member.key)
        if (prev == null || m.insertedAtMs < prev) {
          handlersToday.set(member.key, m.insertedAtMs)
        }
      }

      const botMsgs = messages.filter((m) => m.actor === "bot")
      const botHandled = (atMs: number) =>
        botMsgs.some(
          (b) => b.insertedAtMs > atMs && b.insertedAtMs - atMs <= BOT_GRACE_MS
        )

      // a sticker / emoji the customer sends once staff have written is a
      // reaction, not something to answer (user, 10/10/2026)
      const firstStaffMs =
        messages.find((m) => m.actor === "staff")?.insertedAtMs ?? Infinity

      // customer messages that actually need a person: after the Botcake
      // first-touch, inside working hours (>= 8h VN)
      const customer = messages
        .filter(
          (m) =>
            m.actor === "customer" &&
            inDay(m.insertedAtMs) &&
            vnHour(m.insertedAtMs) >= 8 &&
            !botHandled(m.insertedAtMs) &&
            !(m.reactionOnly && m.insertedAtMs > firstStaffMs)
        )
        .map((m) => ({ atMs: m.insertedAtMs, text: m.text }))
      return { conv, handlersToday, customer, replies }
    } catch {
      return { conv, handlersToday: new Map(), customer: [], replies: [] }
    }
  })

  // Who was active in each shift (staff messages here + activity already on
  // the day) — the fallback when the schedule doesn't say who was on duty.
  const activeIn = new Map<number, Map<string, number>>()
  const noteActive = (shiftStartMs: number, staffKey: string, n: number) => {
    const counts = activeIn.get(shiftStartMs) ?? new Map<string, number>()
    counts.set(staffKey, (counts.get(staffKey) ?? 0) + n)
    activeIn.set(shiftStartMs, counts)
  }
  const shiftStartHour: Partial<Record<ShiftBucketKey, number>> = {
    sang: 8,
    chieu: 13,
    toi: 19,
  }
  for (const [staffKey, byShift] of Object.entries(tree)) {
    for (const [sb, cell] of Object.entries(byShift)) {
      const h = shiftStartHour[sb as ShiftBucketKey]
      if (h != null && cell?.activityHits) {
        noteActive(fromMs + h * 3_600_000, staffKey, cell.activityHits)
      }
    }
  }
  for (const item of crawled) {
    for (const r of item?.replies ?? []) {
      const span = shiftSpanAt(r.atMs)
      if (span) noteActive(span.startMs, r.staffKey, 1)
    }
  }
  const whoIsOnDuty: OnDuty = (atMs) => {
    const scheduled = onDuty(atMs)
    if (scheduled) return scheduled
    const span = shiftSpanAt(atMs)
    const counts = span ? activeIn.get(span.startMs) : undefined
    if (!counts) return null
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }

  const nowMs = Date.now()
  let skipped = 0
  for (const item of crawled) {
    if (!item) {
      skipped += 1
      continue
    }
    const conv = item.conv
    // Only count a conversation once its outcome is settled — a message
    // still waiting for a reply may yet be answered in its shift, or by the
    // next shift (making it the previous shift's miss). Left un-`processed`,
    // it's simply crawled again next sync.
    const grading = gradeConversation({
      customer: item.customer,
      replies: item.replies,
      onDuty: whoIsOnDuty,
      needsReply: (text) => !CLOSING_RE.test(text),
      nowMs,
    })
    if (!grading.final) continue
    processed.add(conv.id)
    // as before, only conversations a tracked staff member took part in are
    // graded (here: any reply from this day on — the next shift's included)
    const engaged = item.replies.some((r) => r.atMs >= fromMs)
    const outcomes = engaged ? grading.outcomes : []
    if (item.handlersToday.size === 0 && outcomes.length === 0) continue
    records.set(conv.id, {
      label: conv.customerName,
      customerId: conv.customerUuid ?? undefined,
      pageId: conv.pageId,
      tagIds: conv.tagIds,
      handlers: Object.fromEntries(item.handlersToday),
      outcomes: outcomes.map(({ staffKey, kind, atMs, detail }) => ({
        staffKey,
        kind,
        atMs,
        detail,
      })),
    })
  }

  // Score every graded conversation of the day — earlier runs' included —
  // with its CURRENT tags (see `ConvRecord`).
  for (const conv of conversations) {
    const record = records.get(conv.id)
    if (record) record.tagIds = conv.tagIds
  }
  for (const [conversationId, record] of records) {
    const hasDemo = has(record.tagIds, tagId.demo)
    const hasTiemNang = has(record.tagIds, tagId.tiemNang)
    const hasDaChot = has(record.tagIds, tagId.daChot)
    const closedHere = closedOrderConvIds.has(conversationId)
    // khách nói vu vơ / hẹn / cảm ơn / broadcast — không cần rep đúng hạn
    const noReplyNeeded = has(record.tagIds, tagId.noReplyNeeded)

    const evBase = {
      label: record.label,
      customerId: record.customerId,
      pageId: record.pageId,
      conversationId,
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
    for (const [key, firstMs] of Object.entries(record.handlers)) {
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
    // Otherwise each person the grading holds responsible gets one outcome
    // (see `gradeConversation`: a message left past the end of a shift is
    // that shift's miss, not the next person's slow reply).
    if (noReplyNeeded || hasDaChot) continue
    for (const o of record.outcomes) {
      const b = bucket(o.staffKey, shiftBucketOf(o.atMs))
      b.replied += 1
      const event = { ...evBase, atMs: o.atMs, detail: o.detail }
      if (o.kind === "missed") {
        b.missed += 1
        b.missedEvents.push(event)
      } else if (o.kind === "onTime") {
        b.onTime += 1
      } else {
        b.slow += 1
        b.slowEvents.push(event)
      }
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

/** Tag ids for the demo funnel (sent / viewed-by / closed-by) — see
 * `DEMO_VIEWED_TAG_BY_STAFF`/`DEMO_CLOSED_TAG_BY_STAFF`'s doc comment. */
type DemoTagIds = {
  sent: Set<number>
  viewedByStaff: Record<string, Set<number>>
  closedByStaff: Record<string, Set<number>>
}

type PageInputs = {
  page: PancakePage
  shop: PancakeShop | null
  tagId: TagSets
  demoTagId: DemoTagIds
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
    loaded: false,
    demo: new Set<number>(),
    tiemNang: new Set<number>(),
    daChot: new Set<number>(),
    noReplyNeeded: new Set<number>(),
  }
  const demoTagId: DemoTagIds = {
    sent: new Set<number>(),
    viewedByStaff: Object.fromEntries(
      Object.keys(DEMO_VIEWED_TAG_BY_STAFF).map((k) => [k, new Set<number>()])
    ),
    closedByStaff: Object.fromEntries(
      Object.keys(DEMO_CLOSED_TAG_BY_STAFF).map((k) => [k, new Set<number>()])
    ),
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
        if (text === TAG_NAMES.demo) demoTagId.sent.add(tag.id)
        for (const [staffKey, tagText] of Object.entries(DEMO_VIEWED_TAG_BY_STAFF)) {
          if (text === tagText) demoTagId.viewedByStaff[staffKey].add(tag.id)
        }
        for (const [staffKey, tagText] of Object.entries(DEMO_CLOSED_TAG_BY_STAFF)) {
          if (text === tagText) demoTagId.closedByStaff[staffKey].add(tag.id)
        }
      }
      tagId.loaded = true
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
    demoTagId,
    conversations,
    convTags,
    orders,
    warnings,
    convReached,
    orderReached,
    walk,
  }
}

/**
 * Bump when the inbox grading rules change: a day built with an older
 * version is re-graded (every conversation crawled again) on its next sync.
 *   2 — a message left unanswered past the end of a shift is that shift's
 *       miss, not the next person's slow reply (29/09/2026).
 *   3 — graded conversations are kept (`convRecords`) and re-scored with
 *       their current tags on every sync (10/10/2026).
 *   4 — a sticker / emoji the customer sends after a staff message needs
 *       no reply (10/10/2026).
 */
const RULES_VERSION = 4

/**
 * A day's inbox tree with only its activity signals kept — the base every
 * sync builds on. The scoring is rebuilt from the graded conversations
 * (`ConvRecord`); the "seen" markers behind the activity can't be (Pancake
 * only keeps recent ones).
 */
function activityOnly(tree: ShopTree): ShopTree {
  const out: ShopTree = {}
  for (const [staffKey, byShift] of Object.entries(tree)) {
    out[staffKey] = {}
    for (const [sb, cell] of Object.entries(byShift) as [
      ShiftBucketKey,
      AgentDayBucket,
    ][]) {
      if (!cell) continue
      out[staffKey][sb] = {
        ...emptyBucket(),
        activityHits: cell.activityHits ?? 0,
        firstActivityMs: cell.firstActivityMs ?? 0,
        lastActivityMs: cell.lastActivityMs ?? 0,
      }
    }
  }
  return out
}

/** Build one Vietnam day's `pancakeAgentDaily/{date}` from pre-fetched inputs. */
async function buildDay(
  dateISO: string,
  inputs: PageInputs[],
  fresh: boolean,
  crawlDeadlineMs: number = Infinity,
  onDuty: OnDuty = () => null
): Promise<AgentDayDoc> {
  const { fromMs, toMs } = vnDayRange(dateISO)
  const warnings: string[] = []
  if (!hasInboxToken()) {
    warnings.push("PANCAKE_INBOX_ACCESS_TOKEN chưa cấu hình — bỏ qua inbox.")
  }

  const ref = adminDb().collection("pancakeAgentDaily").doc(dateISO)
  // Always read, even when `fresh`: `pancakeStats` is independent of the
  // inbox regrade/rebuild this flag controls (it comes from
  // `syncPancakeStatistics`, run earlier in the same `syncDays` call), and
  // the `.set()` below replaces the whole document — skipping this read on
  // a fresh rebuild would silently erase whatever was just captured there.
  const existingDoc = (await ref.get().catch(() => null))?.data() as
    | AgentDayDoc
    | undefined
  const existing = fresh ? undefined : existingDoc
  const regrade =
    existing != null && (existing.rulesVersion ?? 1) < RULES_VERSION
  const processed = new Set<string>(
    regrade ? [] : (existing?.processedConvIds ?? [])
  )
  const existingRecords = regrade ? {} : (existing?.convRecords ?? {})

  const orderData: BucketTree = {}
  const inboxData: BucketTree = {}
  const convRecords: Record<string, string> = {}
  const pageHourly: Record<string, PageHourlyStats> = {}
  const demoFunnel: Record<string, DemoFunnelStats> = {}
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
    pageHourly[fbPageId] = bucketPageHourly(
      input.conversations,
      input.orders,
      fromMs,
      toMs
    )
    demoFunnel[fbPageId] = bucketDemoFunnel(
      input.conversations,
      fromMs,
      toMs,
      input.demoTagId
    )

    const seed = (existing?.inboxData?.[fbPageId] as ShopTree) ?? {}
    if (hasInboxToken() && fbPageId && !input.tagId.loaded) {
      // Without the tag catalogue every conversation would be scored as
      // untagged — keep what the last good sync built for this page.
      inboxData[fbPageId] = seed
      if (existingRecords[fbPageId] != null) {
        convRecords[fbPageId] = existingRecords[fbPageId]
      }
      partial = true
      continue
    }
    const records = decodeRecords(existingRecords[fbPageId])
    const inbox = await syncShopInbox(
      input.page,
      fromMs,
      toMs,
      activityOnly(seed),
      processed,
      records,
      input.tagId,
      closedOrderConvIds,
      input.conversations,
      MAX_CRAWL,
      crawlDeadlineMs,
      onDuty
    )
    inboxData[fbPageId] = inbox.tree
    convRecords[fbPageId] = encodeRecords(records)
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
    pageHourly,
    demoFunnel,
    pancakeStats: existingDoc?.pancakeStats ?? {},
    pancakeDemoStats: existingDoc?.pancakeDemoStats ?? {},
    processedConvIds: [...processed].slice(-4000),
    convRecords,
    warnings: [...new Set([...warnings, ...inputs.flatMap((i) => i.warnings)])],
    rulesVersion: RULES_VERSION,
  }

  await ref.set({ ...doc, updatedAt: FieldValue.serverTimestamp() })
  return doc
}

/**
 * Who the shift schedule (`workSchedules`, incl. "trực hộ" hours) puts on
 * duty at an instant — for `dates` and the morning after (a message left at
 * the end of a Tối shift is handed over to the next day's Sáng).
 */
async function loadOnDuty(dates: string[]): Promise<OnDuty> {
  const span = [...dates, addDays(dates[dates.length - 1], 1)]
  const coll = adminDb().collection("workSchedules")
  const weeks = new Map<string, ScheduleWeek>()
  try {
    const snaps = await adminDb().getAll(
      ...weekIdsForDates(span).map((id) => coll.doc(id))
    )
    for (const s of snaps) {
      weeks.set(s.id, mapScheduleWeek(s.id, s.exists ? s.data() : undefined))
    }
  } catch {
    // no schedule → fall back to who was active (see `syncShopInbox`)
  }
  return (atMs) => {
    const shift = shiftSpanAt(atMs)
    if (!shift) return null
    const date = isoFromDate(new Date(atMs + 7 * 3_600_000))
    const week = weeks.get(mondayOf(date))
    if (!week) return null
    const cell = getCell(week, weekdayMon0(date), shift.key)
    if (!cell.excludeFromScore) return cell.staff
    // "đổi ca": whoever worked that hour answers for it — the "trực hộ" hours
    // ticked in the schedule; the rest stay with the registered person
    // (user, 29/09/2026). A swap with no hours ticked (older entries) is
    // unknown, so whoever was active that shift is used instead.
    if (!cell.cover?.length) return null
    return coverByHour(cell.cover)[vnHour(atMs)] ?? cell.staff
  }
}

/**
 * Capture Pancake's OWN per-day stats (`pancake.vn/.../statistics/page` —
 * see `fetchWebPageStatistics`) for exactly the dates a `syncDays` call is
 * working on, and merge them into those `pancakeAgentDaily/{date}` docs.
 * Unlike the old `pages.fm` endpoint this is keyed on, this one takes an
 * arbitrary date range, so a deep historical sync backfills Pancake's real
 * figures for THOSE dates directly — no dependency on catching a rolling
 * window in time. One request per page regardless of how many `dates`.
 */
export async function syncPancakeStatistics(dates: string[]): Promise<{
  datesWritten: string[]
  warnings: string[]
}> {
  const pages = pancakePages().filter((p) => p.fbPageId)
  if (!hasInboxToken() || pages.length === 0 || dates.length === 0) {
    return { datesWritten: [], warnings: [] }
  }
  const sorted = [...dates].sort()
  const fromISO = sorted[0]
  const toISO = sorted[sorted.length - 1]

  const warnings: string[] = []
  const byDate = new Map<string, Record<string, PancakeDayStat>>()
  await Promise.all(
    pages.map(async (page) => {
      try {
        const stats = await fetchWebPageStatistics(page.fbPageId, fromISO, toISO)
        for (const { date, ...rest } of stats) {
          const entry = byDate.get(date) ?? {}
          entry[page.fbPageId] = rest
          byDate.set(date, entry)
        }
      } catch (error) {
        warnings.push(`${page.name}: thống kê Pancake — ${(error as Error).message}`)
      }
    })
  )
  const written = [...byDate.keys()]
  if (written.length === 0) return { datesWritten: [], warnings }

  const coll = adminDb().collection("pancakeAgentDaily")
  const batch = adminDb().batch()
  for (const date of written) {
    batch.set(
      coll.doc(date),
      { pancakeStats: byDate.get(date), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    )
  }
  await batch.commit()
  return { datesWritten: written, warnings }
}

/**
 * Same idea as `syncPancakeStatistics`, for the demo tag funnel: capture
 * Pancake's OWN per-day, per-tag counts (`pancake.vn/.../statistics/tags` —
 * see `fetchWebTagStatistics`) for exactly the dates a `syncDays` call is
 * working on, matched to `TAG_NAMES.demo`/`DEMO_VIEWED_TAG_BY_STAFF`/
 * `DEMO_CLOSED_TAG_BY_STAFF` by tag TEXT (each page has its own numeric tag
 * ids — see `DemoTagIds`), and merged into `pancakeAgentDaily/{date}
 * .pancakeDemoStats`. Always one request per page (never combined —
 * `fetchWebTagStatistics`'s doc comment explains why).
 */
export async function syncPancakeTagStatistics(dates: string[]): Promise<{
  datesWritten: string[]
  warnings: string[]
}> {
  const pages = pancakePages().filter((p) => p.fbPageId)
  if (!hasInboxToken() || pages.length === 0 || dates.length === 0) {
    return { datesWritten: [], warnings: [] }
  }
  const sorted = [...dates].sort()
  const fromISO = sorted[0]
  const toISO = sorted[sorted.length - 1]

  const warnings: string[] = []
  const byDate = new Map<string, Record<string, DemoFunnelStats>>()
  await Promise.all(
    pages.map(async (page) => {
      try {
        const { dates: resultDates, totalsByTagId, tagText } =
          await fetchWebTagStatistics(page.fbPageId, fromISO, toISO)
        const idsWhereText = (text: string) =>
          Object.keys(tagText).filter((id) => tagText[id] === text)
        const sentIds = idsWhereText(TAG_NAMES.demo)
        const viewedIds = Object.fromEntries(
          Object.entries(DEMO_VIEWED_TAG_BY_STAFF).map(([k, text]) => [
            k,
            idsWhereText(text),
          ])
        )
        const closedIds = Object.fromEntries(
          Object.entries(DEMO_CLOSED_TAG_BY_STAFF).map(([k, text]) => [
            k,
            idsWhereText(text),
          ])
        )
        const sumAt = (ids: string[], i: number) =>
          ids.reduce((s, id) => s + (totalsByTagId[id]?.[i] ?? 0), 0)

        resultDates.forEach((date, i) => {
          const stats = emptyDemoFunnelStats()
          stats.sent = sumAt(sentIds, i)
          for (const staffKey of Object.keys(DEMO_VIEWED_TAG_BY_STAFF)) {
            stats.byStaff[staffKey] = {
              viewed: sumAt(viewedIds[staffKey] ?? [], i),
              closed: sumAt(closedIds[staffKey] ?? [], i),
            }
          }
          const entry = byDate.get(date) ?? {}
          entry[page.fbPageId] = stats
          byDate.set(date, entry)
        })
      } catch (error) {
        warnings.push(`${page.name}: thống kê thẻ Pancake — ${(error as Error).message}`)
      }
    })
  )
  const written = [...byDate.keys()]
  if (written.length === 0) return { datesWritten: [], warnings }

  const coll = adminDb().collection("pancakeAgentDaily")
  const batch = adminDb().batch()
  for (const date of written) {
    batch.set(
      coll.doc(date),
      { pancakeDemoStats: byDate.get(date), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    )
  }
  await batch.commit()
  return { datesWritten: written, warnings }
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
  const [inputs, onDuty, statsResult, tagStatsResult] = await Promise.all([
    Promise.all(
      pages.map((page) =>
        fetchPageInputs(
          page,
          pending,
          phase1DeadlineMs,
          resume?.pages[page.fbPageId]
        )
      )
    ),
    loadOnDuty(pending),
    syncPancakeStatistics(pending),
    syncPancakeTagStatistics(pending),
  ])

  const out: AgentDayDoc[] = []
  for (const date of pending) {
    if (Date.now() >= routeDeadlineMs) break
    const { fromMs } = vnDayRange(date)
    if (!inputs.every((pi) => dateReachedByPage(pi, fromMs))) continue
    // the crawl itself also stops at the deadline — what's left of the day
    // comes back `partial` and goes into the resume
    out.push(
      await buildDay(
        date,
        inputs,
        freshDays.has(date),
        routeDeadlineMs,
        onDuty
      )
    )
  }

  const finished = new Set(out.filter((d) => !d.partial).map((d) => d.date))
  const built = new Set(out.map((d) => d.date))
  const unfinished = pending.filter((d) => !finished.has(d))
  const errors = [
    ...new Set([
      ...inputs.flatMap((pi) => pi.warnings),
      ...statsResult.warnings,
      ...tagStatsResult.warnings,
    ]),
  ]

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
