/**
 * Who answered a customer's message, and whose fault a slow or missing answer
 * is. Pure — no React, no Firebase, no server-only imports (the Pancake sync
 * calls it per conversation).
 *
 * Rules (user, 29/09/2026):
 *  - Shifts end at 13h, 19h and 24h (Sáng 8–13, Chiều 13–19, Tối 19–24, VN).
 *  - A customer message is the responsibility of whoever is ON DUTY when it
 *    arrives — from the shift schedule (incl. "trực hộ" hours), else whoever
 *    was active in that shift (see `OnDuty`).
 *  - Answered within that same shift → graded for whoever answered it
 *    (criterion 4: ≤ 3′ on time, else slow). Unchanged.
 *  - Still unanswered when the shift ends, and answered later by someone
 *    else → NOT the later person's slow reply: it is a "bỏ sót" (missed) for
 *    the person on duty when the message arrived.
 *  - Exception — handover: a message arriving in the last 30 minutes of a
 *    shift may be answered by the next shift. The next person is graded,
 *    counting from the start of their shift.
 *  - Answered after the shift by the on-duty person themselves → their own
 *    slow reply (criterion 4), as before.
 *  - Never answered → missed for the person on duty (for a handover-window
 *    message: the next shift's person), as the old "bỏ ngỏ tin cuối" was.
 */

import { staffByKey } from "./staff"

/** A shift's last stretch in which the next shift may answer instead. */
export const HANDOVER_WINDOW_MS = 30 * 60_000
/** Grace after the next shift starts before a handed-over message counts as unanswered. */
const HANDOVER_GRACE_MS = 20 * 60_000
/** First-reply time at or under this is on time (criterion 4). */
export const ON_TIME_MINUTES = 3

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const HOUR = 3_600_000

type ShiftSpan = { key: "sang" | "chieu" | "toi"; startMs: number; endMs: number }

/** The VN shift containing `ms`, or null in the 0–8h gap. */
export function shiftSpanAt(ms: number): ShiftSpan | null {
  const local = ms + VN_OFFSET_MS
  const midnight = Math.floor(local / (24 * HOUR)) * 24 * HOUR - VN_OFFSET_MS
  const h = new Date(local).getUTCHours()
  const span = (key: ShiftSpan["key"], from: number, to: number) => ({
    key,
    startMs: midnight + from * HOUR,
    endMs: midnight + to * HOUR,
  })
  if (h >= 8 && h < 13) return span("sang", 8, 13)
  if (h >= 13 && h < 19) return span("chieu", 13, 19)
  if (h >= 19) return span("toi", 19, 24)
  return null
}

/** Start of the shift after `shift` (Tối → next day's Sáng at 8h). */
function nextShiftStart(shift: ShiftSpan): number {
  return shift.key === "toi" ? shift.endMs + 8 * HOUR : shift.endMs
}

function hhmm(ms: number): string {
  const d = new Date(ms + VN_OFFSET_MS)
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes()
  ).padStart(2, "0")}`
}

const nameOf = (key: string) => staffByKey(key)?.name ?? key

/** Staff key on duty at an instant, or null when it can't be told. */
export type OnDuty = (atMs: number) => string | null

export type GradedMessage = { atMs: number; text: string }
export type StaffReply = { atMs: number; staffKey: string }

export type ReplyOutcome = {
  staffKey: string
  kind: "onTime" | "slow" | "missed"
  /** reply time for onTime/slow, the customer message's time for missed */
  atMs: number
  /** response minutes for onTime/slow */
  minutes: number | null
  detail: string
}

export type ConversationGrading = {
  /**
   * False while a message's outcome can't be known yet (unanswered, and its
   * shift — or the handover grace — isn't over). The caller must not count
   * or mark the conversation processed until it's final.
   */
  final: boolean
  /** at most one per staff: missed > slow > onTime */
  outcomes: ReplyOutcome[]
}

const RANK: Record<ReplyOutcome["kind"], number> = {
  onTime: 0,
  slow: 1,
  missed: 2,
}

/**
 * Grade one conversation's customer messages.
 *
 * @param customer customer messages that need a person (bot-handled and
 *   out-of-hours ones already removed), oldest first
 * @param replies tracked staff messages, oldest first (may run past the day)
 * @param needsReply false for lines like "cảm ơn" that expect no answer
 */
export function gradeConversation({
  customer,
  replies,
  onDuty,
  needsReply,
  nowMs,
}: {
  customer: GradedMessage[]
  replies: StaffReply[]
  onDuty: OnDuty
  needsReply: (text: string) => boolean
  nowMs: number
}): ConversationGrading {
  const outcomes = new Map<string, ReplyOutcome>()
  const put = (o: ReplyOutcome) => {
    const prev = outcomes.get(o.staffKey)
    if (!prev || RANK[o.kind] > RANK[prev.kind]) outcomes.set(o.staffKey, o)
  }
  const replyAfter = (t: number) => replies.find((r) => r.atMs > t) ?? null
  const graded = (
    staffKey: string,
    fromMs: number,
    replyAtMs: number,
    detail: (min: number) => string
  ): ReplyOutcome => {
    const minutes = Math.max(0, (replyAtMs - fromMs) / 60_000)
    return {
      staffKey,
      kind: minutes <= ON_TIME_MINUTES ? "onTime" : "slow",
      atMs: replyAtMs,
      minutes,
      detail: detail(Math.round(minutes)),
    }
  }

  let final = true
  // criterion 4 grades the FIRST message's reply time only (whatever it
  // says, as before); every message still decides who, if anyone, missed
  // one — except lines like "cảm ơn" that expect no answer
  const first = customer[0]

  for (const m of customer) {
    const shift = shiftSpanAt(m.atMs)
    if (!shift) continue
    const duty = onDuty(m.atMs)
    const handover = m.atMs >= shift.endMs - HANDOVER_WINDOW_MS
    const reply = replyAfter(m.atMs)
    const needed = needsReply(m.text)

    if (!reply) {
      if (!needed) continue
      const decideAt = handover
        ? nextShiftStart(shift) + HANDOVER_GRACE_MS
        : shift.endMs
      if (nowMs < decideAt) {
        final = false
        continue
      }
      const owner = handover ? (onDuty(nextShiftStart(shift)) ?? duty) : duty
      if (owner) {
        put({
          staffKey: owner,
          kind: "missed",
          atMs: handover ? nextShiftStart(shift) : m.atMs,
          minutes: null,
          detail: handover
            ? `nhận bàn giao nhưng bỏ ngỏ tin khách lúc ${hhmm(m.atMs)}`
            : `bỏ ngỏ tin khách lúc ${hhmm(m.atMs)} (không ai trả lời)`,
        })
      }
      continue
    }

    // answered within the shift, or late by the on-duty person themselves
    if (reply.atMs < shift.endMs || reply.staffKey === duty) {
      if (m === first) {
        put(
          graded(reply.staffKey, m.atMs, reply.atMs, (min) =>
            reply.atMs < shift.endMs
              ? `rep tin đầu sau ${min}′`
              : `rep tin đầu sau ${min}′ (quá hết ca)`
          )
        )
      }
      continue
    }

    // answered after the shift ended, by someone else
    if (handover) {
      if (m === first) {
        const from = Math.max(m.atMs, shiftSpanAt(reply.atMs)?.startMs ?? m.atMs)
        put(
          graded(
            reply.staffKey,
            from,
            reply.atMs,
            (min) => `nhận bàn giao ca — rep sau ${min}′ tính từ đầu ca`
          )
        )
      }
      continue
    }
    if (needed && duty) {
      put({
        staffKey: duty,
        kind: "missed",
        atMs: m.atMs,
        minutes: null,
        detail: `tin khách lúc ${hhmm(m.atMs)} chưa rep đến hết ca (${new Date(
          shift.endMs + VN_OFFSET_MS
        ).getUTCHours() || 24}h) — ${nameOf(reply.staffKey)} rep hộ lúc ${hhmm(
          reply.atMs
        )}`,
      })
    }
    // on-duty person unknown: nobody to blame, and not the replier's fault
  }

  return { final, outcomes: [...outcomes.values()] }
}
