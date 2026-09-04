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
  type PancakePage,
  type PancakeShop,
} from "@/lib/pancake"
import { seenStaffByFbId, staffByUid } from "../staff"
import {
  TAG_NAMES,
  addBucket,
  emptyBucket,
  markActivity,
  shiftBucketOf,
  vnDayRange,
  type AgentDayBucket,
  type AgentDayDoc,
  type BucketTree,
  type ShiftBucketKey,
} from "../types"

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

async function syncShopOrders(
  shop: PancakeShop,
  fromMs: number,
  toMs: number,
  demoTagIds: Set<number>,
  convTags: Map<string, number[]>,
  warnings: string[]
): Promise<{ tree: ShopTree; closedOrderConvIds: Set<string> }> {
  const tree: ShopTree = {}
  const closedOrderConvIds = new Set<string>()

  let orders: Awaited<ReturnType<typeof fetchOrdersSince>> = []
  try {
    orders = await fetchOrdersSince(shop, fromMs, { pageSize: 100, maxPages: 80 })
  } catch (error) {
    warnings.push(`${shop.name}: đơn hàng — ${(error as Error).message}`)
  }

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
  tagId: { demo: Set<number>; tiemNang: Set<number>; daChot: Set<number> },
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

  // Crawl every conversation that had ANY activity that day (so a reply today
  // to a customer who wrote yesterday is still captured).
  const active = (conv: (typeof conversations)[number]) =>
    inDay(Math.max(conv.updatedAtMs, conv.lastCustomerAtMs)) ||
    inDay(conv.lastCustomerAtMs)
  const toCrawl = conversations
    .filter((conv) => conv.customerUuid && active(conv) && !processed.has(conv.id))
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
  const partial = toCrawl.length > MAX_CRAWL
  const crawlSet = toCrawl.slice(0, MAX_CRAWL)

  if (!shop.fbPageId) return { tree, crawled: 0, partial: false }

  type Crawled = {
    conv: (typeof conversations)[number]
    /** tracked staff.key -> earliest message time today */
    handlersToday: Map<string, number>
    /** worst first-response to a customer message SENT TODAY */
    worst: { minutes: number | null; replierKey: string | null } | null
  }

  const crawled = await mapLimit<
    (typeof conversations)[number],
    Crawled
  >(crawlSet, CRAWL_CONCURRENCY, async (conv) => {
    try {
      const messages = await fetchMessages(
        shop.fbPageId,
        conv.id,
        conv.customerUuid!,
        { sinceMs: fromMs, maxBatches: 6 }
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

      // worst first-response over the customer messages sent today
      let worst: Crawled["worst"] = null
      for (const cm of messages) {
        if (cm.actor !== "customer" || !inDay(cm.insertedAtMs)) continue
        const next = staffMsgs.find((sm) => sm.insertedAtMs > cm.insertedAtMs)
        const minutes = next
          ? Math.max(0, (next.insertedAtMs - cm.insertedAtMs) / 60_000)
          : null
        const replierKey = next ? staffByUid(next.senderUid)!.key : null
        // null (unanswered) always wins; otherwise the largest gap wins
        if (
          !worst ||
          minutes == null ||
          (worst.minutes != null && minutes > worst.minutes)
        ) {
          worst = { minutes, replierKey }
          if (minutes == null) break
        }
      }
      return { conv, handlersToday, worst }
    } catch {
      return { conv, handlersToday: new Map(), worst: null }
    }
  })

  for (const item of crawled) {
    processed.add(item.conv.id)
    const conv = item.conv
    if (item.handlersToday.size === 0 && item.worst == null) continue

    const hasDemo = has(conv.tagIds, tagId.demo)
    const hasTiemNang = has(conv.tagIds, tagId.tiemNang)
    const hasDaChot = has(conv.tagIds, tagId.daChot)
    const closedHere = closedOrderConvIds.has(conv.id)

    // criterion 6 — the "Đã chốt" tag rule (user, 05/09):
    // a conversation where the customer paid + an order was created must carry
    // "Đã chốt", and "Đã chốt" is valid only alongside "Tiềm năng" OR "Demo".
    let ruleApplied = false
    const issues: string[] = []
    if (closedHere || hasDaChot) {
      ruleApplied = true
      if (!hasDaChot) issues.push("có đơn chốt nhưng thiếu tag Đã chốt")
      else if (!hasTiemNang && !hasDemo)
        issues.push("Đã chốt nhưng không kèm Tiềm năng / Demo")
    }

    // convHandled + tag check -> every staff who replied today
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
            atMs: firstMs,
            label: `KH ${conv.customerName}`,
            detail: issues.join("; "),
          })
        }
      }
    }

    // response outcome -> the staff who made the worst (or the) reply
    if (!item.worst) continue
    const w = item.worst
    const key =
      w.replierKey ??
      [...item.handlersToday.keys()][0] ??
      staffByUid(conv.lastSentByUid)?.key
    if (!key) continue
    const at = item.handlersToday.get(key) ?? conv.lastCustomerAtMs
    const b = bucket(key, shiftBucketOf(at))
    b.replied += 1
    const event = { atMs: at, label: `KH ${conv.customerName}` }
    if (w.minutes == null || w.minutes > 15) {
      b.missed += 1
      b.missedEvents.push({
        ...event,
        detail: w.minutes == null ? "chưa trả lời" : `sau ${Math.round(w.minutes)}′`,
      })
    } else if (w.minutes <= 3) {
      b.onTime += 1
    } else {
      b.slow += 1
      b.slowEvents.push({ ...event, detail: `sau ${Math.round(w.minutes)}′` })
    }
  }

  trimEvents(tree)
  return { tree, crawled: crawlSet.length, partial }
}

/** Crawl one Vietnam calendar day and write `pancakeAgentDaily/{date}`.
 * `fresh` ignores any earlier sync of that day and rebuilds from scratch. */
export async function syncDay(
  dateISO: string,
  fresh = false
): Promise<AgentDayDoc> {
  const pages = pancakePages()
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

  for (const page of pages) {
    // tag catalogue + conversation list (shared by orders + inbox)
    const tagId = {
      demo: new Set<number>(),
      tiemNang: new Set<number>(),
      daChot: new Set<number>(),
    }
    let conversations: Awaited<ReturnType<typeof fetchConversationsSince>> = []
    if (hasInboxToken() && page.fbPageId) {
      try {
        for (const tag of (await fetchPageTags(page.fbPageId)).values()) {
          const text = tag.text.trim().toLowerCase()
          if (text === TAG_NAMES.demo) tagId.demo.add(tag.id)
          if (text === TAG_NAMES.tiemNang) tagId.tiemNang.add(tag.id)
          if (text === TAG_NAMES.daChot) tagId.daChot.add(tag.id)
        }
      } catch (error) {
        warnings.push(`${page.name}: tag — ${(error as Error).message}`)
      }
      try {
        conversations = await fetchConversationsSince(page.fbPageId, fromMs, {
          maxBatches: 25,
        })
      } catch (error) {
        warnings.push(`${page.name}: hội thoại — ${(error as Error).message}`)
      }
    }
    // Paginating a live inbox can return the same conversation on two pages —
    // dedupe by id so it is never crawled (or counted) twice.
    const byId = new Map(conversations.map((c) => [c.id, c]))
    conversations = [...byId.values()]
    const convTags = new Map(conversations.map((c) => [c.id, c.tagIds]))

    // orders — only for pages backed by a POS shop
    let orderTree: ShopTree = {}
    let closedOrderConvIds = new Set<string>()
    if (page.apiKey && page.shopId) {
      const shop: PancakeShop = {
        name: page.name,
        apiKey: page.apiKey,
        shopId: page.shopId,
        fbPageId: page.fbPageId,
      }
      const orders = await syncShopOrders(
        shop,
        fromMs,
        toMs,
        tagId.demo,
        convTags,
        warnings
      )
      orderTree = orders.tree
      closedOrderConvIds = orders.closedOrderConvIds
    }
    orderData[page.fbPageId] = orderTree

    const inbox = await syncShopInbox(
      page,
      fromMs,
      toMs,
      (existing?.inboxData?.[page.fbPageId] as ShopTree) ?? {},
      processed,
      tagId,
      closedOrderConvIds,
      conversations
    )
    inboxData[page.fbPageId] = inbox.tree
    convsCrawled += inbox.crawled
    partial = partial || inbox.partial
  }

  const doc: AgentDayDoc = {
    date: dateISO,
    syncedAtMs: Date.now(),
    convsCrawled,
    partial,
    shops: pages.map((p) => ({ id: p.fbPageId, name: p.name })),
    orderData,
    inboxData,
    processedConvIds: [...processed].slice(-4000),
    warnings,
  }

  await ref.set({ ...doc, updatedAt: FieldValue.serverTimestamp() })
  return doc
}

/** Sync several days, oldest first. */
export async function syncDays(
  dates: string[],
  fresh = false
): Promise<AgentDayDoc[]> {
  const out: AgentDayDoc[] = []
  for (const date of [...dates].sort()) {
    out.push(await syncDay(date, fresh))
  }
  return out
}
