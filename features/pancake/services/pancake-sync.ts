import "server-only"

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
/** Max NEW conversations to message-crawl per shop per sync run. */
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
  conversations: Awaited<ReturnType<typeof fetchConversationsSince>>
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
  const partial = toCrawl.length > MAX_CRAWL
  const crawlSet = toCrawl.slice(0, MAX_CRAWL)

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
    Crawled
  >(crawlSet, CRAWL_CONCURRENCY, async (conv) => {
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

  for (const item of crawled) {
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
  return { tree, crawled: crawlSet.length, partial }
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
}

async function fetchPageInputs(
  page: PancakePage,
  rangeFromMs: number,
  spanDays: number
): Promise<PageInputs> {
  const warnings: string[] = []
  const tagId: TagSets = {
    demo: new Set<number>(),
    tiemNang: new Set<number>(),
    daChot: new Set<number>(),
    noReplyNeeded: new Set<number>(),
  }
  let conversations: PancakeConversation[] = []

  if (hasInboxToken() && page.fbPageId) {
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
    try {
      conversations = await fetchConversationsSince(page.fbPageId, rangeFromMs, {
        // a wider span needs to page deeper to reach the oldest day
        maxBatches: Math.min(150, 40 + spanDays * 3),
      })
    } catch (error) {
      warnings.push(`${page.name}: hội thoại — ${(error as Error).message}`)
    }
  }
  // one conversation can come back on two inbox pages — dedupe by id
  const byId = new Map(conversations.map((c) => [c.id, c]))
  conversations = [...byId.values()]
  const convTags = new Map(conversations.map((c) => [c.id, c.tagIds]))

  const shop: PancakeShop | null =
    page.apiKey && page.shopId
      ? {
          name: page.name,
          apiKey: page.apiKey,
          shopId: page.shopId,
          fbPageId: page.fbPageId,
        }
      : null

  let orders: PancakeOrder[] = []
  if (shop) {
    try {
      orders = await fetchOrdersSince(shop, rangeFromMs, {
        pageSize: 100,
        maxPages: Math.min(200, 40 + spanDays * 4),
      })
    } catch (error) {
      warnings.push(`${page.name}: đơn hàng — ${(error as Error).message}`)
    }
  }

  return { page, shop, tagId, conversations, convTags, orders, warnings }
}

/** Build one Vietnam day's `pancakeAgentDaily/{date}` from pre-fetched inputs. */
async function buildDay(
  dateISO: string,
  inputs: PageInputs[],
  fresh: boolean
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
      input.conversations
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

/**
 * Sync a set of Vietnam calendar days, oldest first. Page data (tags,
 * conversations, orders) is fetched ONCE for the whole span, so syncing 30
 * days costs one conversation walk plus one message crawl per day.
 * `fresh` rebuilds each day from scratch, ignoring earlier syncs.
 */
export async function syncDays(
  dates: string[],
  fresh = false
): Promise<AgentDayDoc[]> {
  const sorted = [...new Set(dates)].sort()
  if (sorted.length === 0) return []

  const pages = pancakePages()
  const rangeFromMs = vnDayRange(sorted[0]).fromMs
  const inputs = await Promise.all(
    pages.map((page) => fetchPageInputs(page, rangeFromMs, sorted.length))
  )

  const out: AgentDayDoc[] = []
  for (const date of sorted) {
    out.push(await buildDay(date, inputs, fresh))
  }
  return out
}

/** Sync a single Vietnam calendar day. */
export async function syncDay(
  dateISO: string,
  fresh = false
): Promise<AgentDayDoc> {
  const [doc] = await syncDays([dateISO], fresh)
  return doc
}
