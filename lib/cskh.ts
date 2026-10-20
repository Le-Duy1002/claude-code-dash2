import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { adminDb } from "@/lib/firebase-admin"
import {
  fetchConversation,
  fetchConversationsSince,
  fetchWebTagHourly,
  fetchWebTagStatistics,
  searchConversations,
  type PancakeConversation,
} from "@/lib/pancake"
import {
  CSKH_CLOSED_TAG,
  CSKH_PAGE_ID,
  CSKH_STAFF,
  ISO_DATE,
  ISO_MONTH,
  foldName,
  formatDm,
  isRelevant,
  mapCskhCustomer,
  normTag,
  parseConversationRef,
  staffKeyFromTags,
  vnDateOf,
  type CskhCustomer,
  type CskhCustomerPatch,
  type CskhDebtorInput,
  type CskhPayment,
  type CskhSearchHit,
  type CskhSyncResult,
} from "@/features/cskh/types"

/**
 * Server side of the "Chăm sóc khách hàng" tab (Hẻm Trong Đường page). All
 * Firestore access goes through the Admin SDK, so these collections need no
 * client security rules:
 *   cskhCustomers/{conversationId} — one closed customer (see `CskhCustomer`)
 *   cskhBaseline/{autoId}          — `{ ids }`: conversations that already had
 *                                    "Chốt sale" before tracking started
 *   cskhMeta/state                 — record `ids`, baseline progress, tracking
 *                                    start, last sync
 */

const CUSTOMERS = "cskhCustomers"
const BASELINE = "cskhBaseline"
const STATE = "cskhMeta/state"
const HOUR = 3_600_000
const DAY = 86_400_000
const BASELINE_CHUNK = 4000
/** How far back a "Chốt sale" Pancake has but no record yet keeps being looked for. */
const MATCH_DAYS = 7
/** Longest a close is dated before the conversation's last update. */
const MAX_MATCH_LAG = 3 * DAY

type CskhState = {
  /** every `cskhCustomers` id */
  ids?: string[]
  /** the whole-page walk reached the end */
  baselineWalked?: boolean
  /** …and the catch-up pass after it too — tracking is on */
  baselineDone?: boolean
  baselineCursor?: number
  baselineStartedAtMs?: number
  baselineScanned?: number
  trackingSinceMs?: number
  lastSyncedAtMs?: number
}

type TagsOf = (tagIds: number[]) => string[]

/** Tag id → text for the page, from Pancake's tag statistics catalogue. */
async function tagNamer(): Promise<TagsOf> {
  const today = vnDateOf(Date.now())
  const { tagLabel } = await fetchWebTagStatistics(CSKH_PAGE_ID, today, today)
  return (tagIds) =>
    tagIds
      .map((id) => tagLabel[String(id)])
      .filter((t): t is string => Boolean(t))
}

function hasClosedTag(tags: string[]): boolean {
  return tags.map(normTag).includes(CSKH_CLOSED_TAG)
}

async function saveBaselineIds(ids: string[]): Promise<void> {
  const col = adminDb().collection(BASELINE)
  for (let i = 0; i < ids.length; i += BASELINE_CHUNK) {
    await col.add({
      ids: ids.slice(i, i + BASELINE_CHUNK),
      createdAt: FieldValue.serverTimestamp(),
    })
  }
}

/**
 * Once, before anything is tracked: walk the WHOLE page (≈28k conversations,
 * over several calls resuming at `baselineCursor`) and remember every
 * conversation that already carries "Chốt sale" — Pancake can't say when
 * those were tagged. Then a catch-up pass over what was touched while the
 * walk ran (a conversation bumped to the top can jump past the cursor), and
 * tracking starts.
 */
async function continueBaseline(
  state: CskhState,
  tagsOf: TagsOf,
  deadlineMs: number
): Promise<CskhSyncResult> {
  const stateRef = adminDb().doc(STATE)
  const startedAtMs = state.baselineStartedAtMs ?? Date.now()
  let scanned = state.baselineScanned ?? 0
  const result = (baselineDone: boolean): CskhSyncResult => ({
    phase: "baseline",
    scanned,
    created: 0,
    updated: 0,
    baselineDone,
    truncated: !baselineDone,
  })

  if (!state.baselineWalked) {
    const walk = await fetchConversationsSince(CSKH_PAGE_ID, [0], {
      maxBatches: 2000,
      startCursor: state.baselineCursor ?? 0,
      deadlineMs,
    })
    await saveBaselineIds(
      walk.conversations
        .filter((c) => hasClosedTag(tagsOf(c.tagIds)))
        .map((c) => c.id)
    )
    scanned += walk.conversations.length
    await stateRef.set(
      {
        baselineStartedAtMs: startedAtMs,
        baselineCursor: walk.endCursor,
        baselineScanned: scanned,
        baselineWalked: walk.complete,
      },
      { merge: true }
    )
    if (!walk.complete) return result(false)
  }

  const recent = await fetchConversationsSince(
    CSKH_PAGE_ID,
    [startedAtMs - 60_000],
    { maxBatches: 400, deadlineMs }
  )
  await saveBaselineIds(
    recent.conversations
      .filter((c) => hasClosedTag(tagsOf(c.tagIds)))
      .map((c) => c.id)
  )
  if (recent.truncated) return result(false)

  const now = Date.now()
  await stateRef.set(
    {
      baselineDone: true,
      trackingSinceMs: now,
      lastSyncedAtMs: now,
      lastSyncedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
  return result(true)
}

export class CskhError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

/**
 * Pancake's own record of "Chốt sale" being put on conversations (Thẻ hội
 * thoại, hour by hour, net of removals) since `fromMs`, and per Vietnam day
 * how many of those no record is dated to yet.
 */
type ClosedSlots = {
  /** one hour start (epoch ms) per tag put on, latest first */
  events: number[]
  /** VN day -> events that day not yet taken by a record */
  free: Map<string, number>
}

async function closedSlots(
  fromMs: number,
  now: number,
  recordDates: string[]
): Promise<ClosedSlots> {
  const { hours, totalsByTagId, tagText } = await fetchWebTagHourly(
    CSKH_PAGE_ID,
    vnDateOf(fromMs),
    vnDateOf(now)
  )
  const id = Object.keys(tagText).find(
    (tagId) => normTag(tagText[tagId]) === CSKH_CLOSED_TAG
  )
  const events: number[] = []
  if (id) {
    hours.forEach((atMs, i) => {
      if (atMs < fromMs) return
      for (let n = 0; n < (totalsByTagId[id][i] ?? 0); n += 1) events.push(atMs)
    })
  }
  events.sort((a, b) => b - a)
  const free = new Map<string, number>()
  for (const atMs of events) {
    free.set(vnDateOf(atMs), (free.get(vnDateOf(atMs)) ?? 0) + 1)
  }
  for (const date of recordDates) {
    if (free.has(date)) free.set(date, free.get(date)! - 1)
  }
  return { events, free }
}

/** The earliest event whose day still has a close to find, or null. */
function earliestOpenEvent(slots: ClosedSlots): number | null {
  let earliest: number | null = null
  for (const atMs of slots.events) {
    if ((slots.free.get(vnDateOf(atMs)) ?? 0) > 0) earliest = atMs
  }
  return earliest
}

/**
 * Dates a newly found close by Pancake's events: the latest one it can have
 * been tagged at (not after its last update, not before it began, at most
 * `MAX_MATCH_LAG` back) on a day that still has a close to find — and takes
 * it. Null when none fits.
 */
function takeClosedDate(
  slots: ClosedSlots,
  conv: PancakeConversation
): string | null {
  for (const atMs of slots.events) {
    if (atMs > conv.updatedAtMs) continue
    if (
      atMs + HOUR <= conv.insertedAtMs ||
      atMs < conv.updatedAtMs - MAX_MATCH_LAG
    ) {
      break
    }
    const date = vnDateOf(atMs)
    const left = slots.free.get(date) ?? 0
    if (left > 0) {
      slots.free.set(date, left - 1)
      return date
    }
  }
  return null
}

function sameList(a: unknown, b: string[]): boolean {
  return (
    Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i])
  )
}

/**
 * Until the baseline is done, each call advances it (see `continueBaseline`).
 * After that it first reads Pancake's Thẻ hội thoại: when "Chốt sale" was
 * put on conversations, hour by hour (`closedSlots`). Then it walks the
 * conversations touched in the last `sinceDays` days — further back when
 * Pancake has a "Chốt sale" from the last `MATCH_DAYS` days that no record
 * accounts for yet. One with "Chốt sale" that is neither in the baseline nor
 * recorded yet was tagged since tracking started, so it becomes a record,
 * dated by the Pancake event it matches (`takeClosedDate`), else by its
 * `updated_at` (a tag change bumps it; the 30-min cron sees it soon after).
 * Later runs only refresh a record's tags, name, auto-assigned staff and
 * whether "Chốt sale" is still on it — never the hand-entered fields.
 */
export async function syncCskhCustomers({
  sinceDays,
  deadlineMs,
}: {
  sinceDays: number
  deadlineMs: number
}): Promise<CskhSyncResult> {
  const db = adminDb()
  const col = db.collection(CUSTOMERS)
  const stateRef = db.doc(STATE)
  const state = ((await stateRef.get()).data() ?? {}) as CskhState
  const tagsOf = await tagNamer()
  if (!state.baselineDone) return continueBaseline(state, tagsOf, deadlineMs)

  const now = Date.now()
  const trackingSinceMs = state.trackingSinceMs ?? now

  const matchFromMs = Math.max(trackingSinceMs, now - MATCH_DAYS * DAY)
  let slots: ClosedSlots | null = null
  try {
    const dated = await col
      .where("closedDate", ">=", vnDateOf(matchFromMs))
      .get()
    slots = await closedSlots(
      matchFromMs,
      now,
      dated.docs
        .map((doc) => doc.data())
        .filter((data) => !data.legacy)
        .map((data) => String(data.closedDate))
    )
  } catch {
    // no Pancake events: walk the window, date closes by their last update
  }
  const openFromMs = slots ? earliestOpenEvent(slots) : null
  const walk = await fetchConversationsSince(
    CSKH_PAGE_ID,
    [Math.min(now - sinceDays * DAY, openFromMs ?? Infinity)],
    { maxBatches: 400, deadlineMs }
  )

  const known = new Set<string>(state.ids ?? [])
  const baseline = new Set<string>()
  for (const doc of (await db.collection(BASELINE).get()).docs) {
    for (const id of (doc.data().ids as string[] | undefined) ?? []) {
      baseline.add(id)
    }
  }

  // oldest update first, so each new close takes the event nearest its own
  const touched = walk.conversations
    .map((conv) => {
      const tags = tagsOf(conv.tagIds)
      return { conv, tags, closed: hasClosedTag(tags) }
    })
    .filter(
      (t) => known.has(t.conv.id) || (t.closed && !baseline.has(t.conv.id))
    )
    .sort((a, b) => a.conv.updatedAtMs - b.conv.updatedAtMs)

  const knownRefs = touched
    .filter((t) => known.has(t.conv.id))
    .map((t) => col.doc(t.conv.id))
  const existing = new Map<string, Record<string, unknown>>()
  if (knownRefs.length) {
    for (const snap of await db.getAll(...knownRefs)) {
      if (snap.exists) existing.set(snap.id, snap.data()!)
    }
  }

  let created = 0
  let updated = 0
  const newIds: string[] = []
  let batch = db.batch()
  let pending = 0
  const flush = async () => {
    if (pending === 0) return
    await batch.commit()
    batch = db.batch()
    pending = 0
  }

  for (const { conv, tags, closed } of touched) {
    const ref = col.doc(conv.id)
    const prev = existing.get(conv.id)
    if (!prev) {
      if (!closed) continue
      batch.set(ref, {
        pageId: CSKH_PAGE_ID,
        customerName: conv.customerName,
        staffKey: staffKeyFromTags(tags),
        staffManual: false,
        closedDate:
          (slots && takeClosedDate(slots, conv)) ??
          vnDateOf(
            Math.min(now, Math.max(conv.updatedAtMs, trackingSinceMs))
          ),
        legacy: false,
        debtMonth: null,
        price: null,
        payments: [],
        tags,
        tagRemoved: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByName: null,
      })
      newIds.push(conv.id)
      created += 1
    } else {
      const patch: Record<string, unknown> = {}
      if (!sameList(prev.tags, tags)) patch.tags = tags
      if (prev.customerName !== conv.customerName) {
        patch.customerName = conv.customerName
      }
      // an old customer added by hand was never a tracked close
      if (!prev.legacy && Boolean(prev.tagRemoved) !== !closed) {
        patch.tagRemoved = !closed
      }
      if (!prev.staffManual) {
        const staffKey = staffKeyFromTags(tags)
        if ((prev.staffKey ?? null) !== staffKey) patch.staffKey = staffKey
      }
      if (Object.keys(patch).length === 0) continue
      batch.update(ref, patch)
      updated += 1
    }
    pending += 1
    if (pending >= 400) await flush()
  }
  await flush()

  await stateRef.set(
    {
      ...(newIds.length ? { ids: FieldValue.arrayUnion(...newIds) } : {}),
      lastSyncedAt: FieldValue.serverTimestamp(),
      lastSyncedAtMs: now,
    },
    { merge: true }
  )

  return {
    phase: "sync",
    scanned: walk.conversations.length,
    created,
    updated,
    baselineDone: true,
    truncated: walk.truncated,
  }
}

/**
 * Khách xem per day per staff (Pancake's own name-tag counts over `dates`),
 * every record relevant to the range, when khách chốt tracking started, and
 * the last sync time.
 */
export async function readCskhReport(dates: string[]): Promise<{
  views: Record<string, Record<string, number>>
  customers: CskhCustomer[]
  closedTrackedFrom: string | null
  pancakeClosed: Record<string, number>
  lastSyncedAtMs: number | null
  warnings: string[]
}> {
  const warnings: string[] = []
  const views: Record<string, Record<string, number>> = {}
  const pancakeClosed: Record<string, number> = {}
  for (const date of dates) views[date] = {}
  if (dates.length === 0) {
    return {
      views,
      customers: [],
      closedTrackedFrom: null,
      pancakeClosed,
      lastSyncedAtMs: null,
      warnings,
    }
  }
  const from = dates[0]
  const to = dates[dates.length - 1]

  const [stats, customersSnap, stateSnap] = await Promise.all([
    fetchWebTagStatistics(CSKH_PAGE_ID, from, to).catch((error: Error) => {
      warnings.push(`Không lấy được số tag từ Pancake: ${error.message}`)
      return null
    }),
    adminDb().collection(CUSTOMERS).get(),
    adminDb().doc(STATE).get(),
  ])

  if (stats) {
    for (const staff of CSKH_STAFF) {
      const id = Object.keys(stats.tagText).find(
        (tagId) => normTag(stats.tagText[tagId]) === staff.tag
      )
      if (!id) {
        warnings.push(`Page không có tag "${staff.name}".`)
        continue
      }
      stats.dates.forEach((date, i) => {
        if (views[date]) views[date][staff.key] = stats.totalsByTagId[id][i] ?? 0
      })
    }
    const closedId = Object.keys(stats.tagText).find(
      (tagId) => normTag(stats.tagText[tagId]) === CSKH_CLOSED_TAG
    )
    if (closedId) {
      stats.dates.forEach((date, i) => {
        pancakeClosed[date] = stats.totalsByTagId[closedId][i] ?? 0
      })
    }
  }

  const customers = customersSnap.docs
    .map((doc) => mapCskhCustomer(doc.id, doc.data()))
    .filter((c) => isRelevant(c, from, to))
    .sort((a, b) => b.closedDate.localeCompare(a.closedDate))

  const state = (stateSnap.data() ?? {}) as CskhState
  const closedTrackedFrom =
    state.baselineDone && state.trackingSinceMs
      ? vnDateOf(state.trackingSinceMs)
      : null
  if (!closedTrackedFrom) {
    warnings.push(
      `Chưa lập xong danh sách khách đã chốt từ trước (đã quét ${(
        state.baselineScanned ?? 0
      ).toLocaleString("vi-VN")} / khoảng 28.000 hội thoại). Bấm "Đồng bộ ngay" để quét tiếp — app bắt đầu ghi nhận khách chốt từ lúc xong bước này.`
    )
  } else {
    if (from < closedTrackedFrom) {
      warnings.push(
        `Trước ${formatDm(closedTrackedFrom)}: app chưa theo dõi từng khách chốt, nên chỉ cột Tổng có khách chốt (số tag "Chốt sale" của Pancake). Phần chia theo nhân viên, giá bản luận và AOV chỉ có từ ngày này (trước đó hiện "—").`
      )
    }
    // the tracking start day's Pancake count includes the hours before it
    const assigned: Record<string, number> = {}
    for (const c of customers) {
      if (c.legacy || c.tagRemoved || !c.staffKey) continue
      assigned[c.closedDate] = (assigned[c.closedDate] ?? 0) + 1
    }
    const gaps = dates
      .filter(
        (date) =>
          date > closedTrackedFrom &&
          pancakeClosed[date] != null &&
          pancakeClosed[date] !== (assigned[date] ?? 0)
      )
      .map(
        (date) =>
          `${formatDm(date)}: Pancake ${pancakeClosed[date]} · app ${assigned[date] ?? 0}`
      )
    if (gaps.length) {
      warnings.push(
        `Khách chốt theo tag "Chốt sale" của Pancake khác số khách app đã gán nhân viên — ${gaps.join("; ")}. Khách vừa gắn tag sẽ vào app ở lần đồng bộ tới; nếu vẫn lệch, xem lại ngày chốt của khách hoặc hội thoại có "Chốt sale" mà chưa có tag tên nhân viên.`
      )
    }
  }

  return {
    views,
    customers,
    closedTrackedFrom,
    pancakeClosed,
    lastSyncedAtMs: state.lastSyncedAtMs ?? null,
    warnings,
  }
}

const SEARCH_LIMIT = 20

/**
 * "Tìm khách": a pasted Pancake link/id finds that one conversation; a name
 * finds customers already in the app plus Pancake conversations whose
 * CUSTOMER NAME matches (Pancake's search also matches message text — those
 * are dropped). A conversation that has a record shows as the record.
 */
export async function searchCskhCustomers(
  query: string
): Promise<CskhSearchHit[]> {
  const text = query.trim()
  const records = (await adminDb().collection(CUSTOMERS).get()).docs.map(
    (doc) => mapCskhCustomer(doc.id, doc.data())
  )
  const byId = new Map(records.map((c) => [c.id, c]))

  const ref = parseConversationRef(text)
  if (ref) {
    const record = byId.get(ref)
    if (record) return [{ kind: "record", customer: record }]
    const conv = await fetchConversation(CSKH_PAGE_ID, ref)
    if (!conv) return []
    const tags = (await tagNamer())(conv.tagIds)
    return [
      {
        kind: "pancake",
        conversationId: conv.id,
        customerName: conv.customerName,
        staffKey: staffKeyFromTags(tags),
        tags,
        updatedAtMs: conv.updatedAtMs,
      },
    ]
  }

  const folded = foldName(text)
  if (folded.length < 2) return []
  const recordHits: CskhSearchHit[] = records
    .filter((c) => foldName(c.customerName).includes(folded))
    .sort((a, b) => a.customerName.localeCompare(b.customerName, "vi"))
    .slice(0, SEARCH_LIMIT)
    .map((customer) => ({ kind: "record", customer }))

  const [convs, tagsOf] = await Promise.all([
    searchConversations(CSKH_PAGE_ID, text).catch(() => []),
    tagNamer(),
  ])
  const pancakeHits: CskhSearchHit[] = convs
    .filter(
      (conv) =>
        !byId.has(conv.id) && foldName(conv.customerName).includes(folded)
    )
    .slice(0, SEARCH_LIMIT)
    .map((conv) => {
      const tags = tagsOf(conv.tagIds)
      return {
        kind: "pancake",
        conversationId: conv.id,
        customerName: conv.customerName,
        staffKey: staffKeyFromTags(tags),
        tags,
        updatedAtMs: conv.updatedAtMs,
      }
    })

  return [...recordHits, ...pancakeHits]
}

const STAFF_KEYS = new Set(CSKH_STAFF.map((s) => s.key))

function cleanPayments(value: unknown): CskhPayment[] {
  if (!Array.isArray(value)) throw new CskhError("payments phải là danh sách")
  return value.map((raw) => {
    const p = raw as Partial<CskhPayment>
    const amount = Number(p?.amount)
    if (typeof p?.id !== "string" || !p.id) throw new CskhError("Thiếu id lần trả")
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new CskhError("Số tiền trả phải lớn hơn 0")
    }
    if (typeof p.date !== "string" || !ISO_DATE.test(p.date)) {
      throw new CskhError("Ngày nhận tiền không hợp lệ")
    }
    if (p.kind !== "chot" && p.kind !== "no") {
      throw new CskhError("Chọn loại: khách chốt trả hay trả nợ")
    }
    if (p.kind === "no" && !(typeof p.debtMonth === "string" && ISO_MONTH.test(p.debtMonth))) {
      throw new CskhError("Trả nợ cần chọn nợ của tháng nào")
    }
    return {
      id: p.id,
      amount: Math.round(amount),
      date: p.date,
      kind: p.kind,
      debtMonth: p.kind === "no" ? p.debtMonth! : null,
    }
  })
}

function newPaymentId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * "Thêm khách trả nợ": records an old customer (closed before tracking)
 * paying off a debt, with that first payment. Keyed by the Pancake
 * conversation when a link/id is given — adding the same conversation again
 * appends the payment to the existing record instead.
 */
export async function createCskhDebtor(
  input: CskhDebtorInput,
  actorName: string
): Promise<CskhCustomer> {
  const customerName = String(input.customerName ?? "").trim()
  if (!customerName) throw new CskhError("Nhập tên khách")
  const staffKey = input.staffKey ?? null
  if (staffKey !== null && !STAFF_KEYS.has(staffKey)) {
    throw new CskhError("Nhân viên không hợp lệ")
  }
  if (!ISO_MONTH.test(String(input.debtMonth ?? ""))) {
    throw new CskhError("Chọn nợ của tháng nào")
  }
  const price =
    input.price == null || (input.price as unknown) === ""
      ? null
      : Number(input.price)
  if (price != null && (!Number.isFinite(price) || price < 0)) {
    throw new CskhError("Giá bản luận không hợp lệ")
  }
  const conversationId = input.conversation
    ? parseConversationRef(input.conversation)
    : null
  if (input.conversation && !conversationId) {
    throw new CskhError("Link / mã hội thoại Pancake không hợp lệ")
  }
  const [payment] = cleanPayments([
    {
      id: newPaymentId(),
      amount: input.amount,
      date: input.date,
      kind: "no",
      debtMonth: input.debtMonth,
    },
  ])

  const db = adminDb()
  const col = db.collection(CUSTOMERS)
  const ref = conversationId ? col.doc(conversationId) : col.doc()
  const snap = await ref.get()
  if (snap.exists) {
    const prev = mapCskhCustomer(snap.id, snap.data()!)
    await ref.update({
      payments: [...prev.payments, payment],
      updatedAt: FieldValue.serverTimestamp(),
      updatedByName: actorName,
    })
  } else {
    await ref.set({
      pageId: CSKH_PAGE_ID,
      customerName,
      staffKey,
      staffManual: true,
      closedDate: "",
      legacy: true,
      debtMonth: input.debtMonth,
      price: price == null ? null : Math.round(price),
      payments: [payment],
      tags: [],
      tagRemoved: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByName: actorName,
    })
    await db
      .doc(STATE)
      .set({ ids: FieldValue.arrayUnion(ref.id) }, { merge: true })
  }
  const fresh = await ref.get()
  return mapCskhCustomer(fresh.id, fresh.data()!)
}

/** Saves the hand-edited fields of one record. */
export async function updateCskhCustomer(
  id: string,
  patch: CskhCustomerPatch,
  actorName: string
): Promise<CskhCustomer> {
  const update: Record<string, unknown> = {}
  if ("staffKey" in patch) {
    const key = patch.staffKey ?? null
    if (key !== null && !STAFF_KEYS.has(key)) {
      throw new CskhError("Nhân viên không hợp lệ")
    }
    update.staffKey = key
    update.staffManual = true
  }
  if ("closedDate" in patch) {
    if (typeof patch.closedDate !== "string" || !ISO_DATE.test(patch.closedDate)) {
      throw new CskhError("Ngày chốt không hợp lệ")
    }
    update.closedDate = patch.closedDate
  }
  if ("price" in patch) {
    if (patch.price == null) {
      update.price = null
    } else {
      const price = Number(patch.price)
      if (!Number.isFinite(price) || price < 0) {
        throw new CskhError("Giá bản luận không hợp lệ")
      }
      update.price = Math.round(price)
    }
  }
  if ("payments" in patch) update.payments = cleanPayments(patch.payments)
  if (Object.keys(update).length === 0) throw new CskhError("Không có gì để lưu")

  const ref = adminDb().collection(CUSTOMERS).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new CskhError("Không tìm thấy khách này", 404)
  await ref.update({
    ...update,
    updatedAt: FieldValue.serverTimestamp(),
    updatedByName: actorName,
  })
  const fresh = await ref.get()
  return mapCskhCustomer(fresh.id, fresh.data()!)
}
