import "server-only"

import { fetchWebTagHourly } from "@/lib/pancake"
import { STAFF } from "@/features/pancake/staff"
import {
  DEMO_CLOSED_TAG_BY_STAFF,
  DEMO_VIEWED_TAG_BY_STAFF,
  shiftBucketOf,
  type AgentDayDoc,
  type ShiftKey,
} from "@/features/pancake/types"

export type DemoTally = { viewed: number; closed: number }

/**
 * First day scores and pay count demo by tags. "{X} Chốt" had no uses at all
 * through 24/09/2026 while "{X}Demo" ran all month, so an earlier day adds
 * viewers with no closes and only drags the rate towards 0%.
 */
export const DEMO_TAGS_FROM = "2026-10-01"

/**
 * One person's demo figures for a day, counted from their OWN Pancake tags
 * ("{X}Demo" / "{X} Chốt"), never from who the order or reply belongs to. Same
 * source and fallback as `/api/pancake/demo-dashboard`, so every screen agrees.
 * These are Pancake's net counts (put on − removed), so a day can be negative.
 */
export function storedDemoTally(
  doc: AgentDayDoc | undefined,
  staffKey: string,
  wantShops: Set<string> | null
): DemoTally {
  const tally = { viewed: 0, closed: 0 }
  if (!doc) return tally
  const hasPancake =
    doc.pancakeDemoStats && Object.keys(doc.pancakeDemoStats).length > 0
  const source = hasPancake ? doc.pancakeDemoStats! : (doc.demoFunnel ?? {})
  for (const [pageId, funnel] of Object.entries(source)) {
    if (wantShops && !wantShops.has(pageId)) continue
    tally.viewed += funnel.byStaff[staffKey]?.viewed ?? 0
    tally.closed += funnel.byStaff[staffKey]?.closed ?? 0
  }
  return tally
}

/** `storedDemoTally` added up for scoring, from `DEMO_TAGS_FROM` onwards. */
export function sumStoredDemoTally(
  docs: AgentDayDoc[],
  staffKey: string,
  wantShops: Set<string> | null
): DemoTally {
  const total = { viewed: 0, closed: 0 }
  for (const doc of docs) {
    if (doc.date < DEMO_TAGS_FROM) continue
    const day = storedDemoTally(doc, staffKey, wantShops)
    total.viewed += day.viewed
    total.closed += day.closed
  }
  return total
}

/** Chốt ÷ xem, in percent. Null when nothing net was viewed, so no score. */
export function demoTallyRate(tally: DemoTally): number | null {
  return tally.viewed > 0 ? (tally.closed / tally.viewed) * 100 : null
}

/** Pancake took 88 days per tag call and refused 158 ("Invalid date range"). */
const TAG_STATS_MAX_DAYS = 60

/**
 * The same tags for a single shift, as date → staff key → tally. Pancake's
 * daily tag figures have no shift split, so these are read live, hour by hour.
 */
export async function shiftDemoTally(
  shift: Exclude<ShiftKey, "all">,
  pageIds: string[],
  dates: string[]
): Promise<Map<string, Record<string, DemoTally>>> {
  const byDate = new Map<string, Record<string, DemoTally>>()
  await Promise.all(
    pageIds.map(async (pageId) => {
      for (let i = 0; i < dates.length; i += TAG_STATS_MAX_DAYS) {
        const span = dates.slice(i, i + TAG_STATS_MAX_DAYS)
        const { hours, totalsByTagId, tagText } = await fetchWebTagHourly(
          pageId,
          span[0],
          span[span.length - 1]
        )
        const idsOf = (text: string) =>
          Object.keys(tagText).filter((id) => tagText[id] === text)
        const sumAt = (ids: string[], hour: number) =>
          ids.reduce((sum, id) => sum + (totalsByTagId[id]?.[hour] ?? 0), 0)

        for (const { key } of STAFF) {
          const viewedIds = idsOf(DEMO_VIEWED_TAG_BY_STAFF[key])
          const closedIds = idsOf(DEMO_CLOSED_TAG_BY_STAFF[key])
          hours.forEach((atMs, hour) => {
            if (shiftBucketOf(atMs) !== shift) return
            const date = new Date(atMs + 7 * 3_600_000)
              .toISOString()
              .slice(0, 10)
            const perStaff = byDate.get(date) ?? {}
            const tally = (perStaff[key] ??= { viewed: 0, closed: 0 })
            tally.viewed += sumAt(viewedIds, hour)
            tally.closed += sumAt(closedIds, hour)
            byDate.set(date, perStaff)
          })
        }
      }
    })
  )
  return byDate
}
