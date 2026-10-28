"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  clearPresence,
  publishPresence,
  subscribeToPresence,
} from "../services/presence-service"
import type { Actor } from "../services/schedule-service"
import {
  MONTH_LABELS,
  PRESENCE_ACTION_LABELS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_STALE_MS,
  describeFocus,
  formatAgo,
  samePresenceFocus,
  type PresenceAction,
  type PresenceFocus,
  type ScheduleChange,
  type SchedulePresence,
  type ShiftId,
} from "../types"

/** How long a cell stays lit after someone else changed it. */
const CHANGE_FLASH_MS = 20_000
/** A presence doc silent this long is a dead tab's leftover — delete it. */
const PRESENCE_GARBAGE_MS = 10 * 60_000

// ------------------------------------------------------------ person colours
// One colour per signed-in person (not per staff — the staff chips already
// use theirs), picked from the uid so it stays the same across tabs/days.
// Class strings are spelled out in full so Tailwind can see them.

type PersonTone = { dot: string; ring: string; tag: string }

const PERSON_TONES: PersonTone[] = [
  { dot: "bg-rose-500", ring: "ring-rose-500", tag: "bg-rose-500 text-white" },
  { dot: "bg-blue-500", ring: "ring-blue-500", tag: "bg-blue-500 text-white" },
  {
    dot: "bg-orange-500",
    ring: "ring-orange-500",
    tag: "bg-orange-500 text-white",
  },
  {
    dot: "bg-fuchsia-500",
    ring: "ring-fuchsia-500",
    tag: "bg-fuchsia-500 text-white",
  },
  { dot: "bg-teal-500", ring: "ring-teal-500", tag: "bg-teal-500 text-white" },
  {
    dot: "bg-yellow-500",
    ring: "ring-yellow-500",
    tag: "bg-yellow-500 text-yellow-950",
  },
]

export function personTone(uid: string): PersonTone {
  let hash = 0
  for (let i = 0; i < uid.length; i += 1) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0
  }
  return PERSON_TONES[hash % PERSON_TONES.length]
}

/** Given name for a tight tag: "Nguyễn Thị Hà" → "Hà", an email → its user. */
export function shortName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.includes("@")) return trimmed.split("@")[0]
  const words = trimmed.split(/\s+/)
  return words[words.length - 1] || trimmed
}

function monthKeyLabel(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return m ? `${MONTH_LABELS[m - 1]}/${y}` : month
}

const CHANGE_VERBS: Partial<Record<ScheduleChange["kind"], string>> = {
  assign: "đăng ký",
  unassign: "bỏ ca",
  reassign: "đổi người",
  note: "sửa ghi chú",
}

function cellKey(weekId: string, dayIndex: number, shift: ShiftId): string {
  return `${weekId}:${dayIndex}:${shift}`
}

function useNow(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

// ------------------------------------------------------------ context

type LiveContextValue = {
  month: string
  /** other people with the page open (one entry per person), freshest first */
  others: SchedulePresence[]
  /** others' cell changes from the last few seconds, newest per cell */
  recentByCell: Map<string, ScheduleChange>
  /** now on the server's clock (heartbeats and changes carry server times) */
  serverNowMs: number
  /** presence couldn't be read (e.g. Firestore rules not deployed yet) */
  unavailable: boolean
  claim: (focus: PresenceFocus) => void
  release: (focus: PresenceFocus) => void
}

const LiveContext = React.createContext<LiveContextValue | null>(null)

/**
 * Live presence for the Lịch làm page: publishes this tab (who, which month,
 * what it has open) with a heartbeat, and shares everyone else's — plus the
 * month's change log — with the grid below it.
 */
export function SchedulePresenceProvider({
  actor,
  month,
  changes,
  children,
}: {
  actor: Actor
  /** `yyyy-mm` being viewed */
  month: string
  /** the viewed month's change log, newest first */
  changes: ScheduleChange[]
  children: React.ReactNode
}) {
  const [tabId] = React.useState(
    () => `${actor.uid}_${Math.random().toString(36).slice(2, 10)}`
  )
  const focusRef = React.useRef<PresenceFocus | null>(null)
  const monthRef = React.useRef(month)
  const [rows, setRows] = React.useState<SchedulePresence[]>([])
  const [unavailable, setUnavailable] = React.useState(false)
  // server clock − local clock, learned from this tab's own heartbeat
  const [skewMs, setSkewMs] = React.useState(0)
  const nowMs = useNow(5_000)
  const serverNowMs = nowMs + skewMs

  const publish = React.useCallback(() => {
    publishPresence(tabId, {
      uid: actor.uid,
      name: actor.name,
      month: monthRef.current,
      focus: focusRef.current,
    }).catch(() => {})
  }, [tabId, actor.uid, actor.name])

  React.useEffect(() => {
    monthRef.current = month
    publish()
  }, [month, publish])

  React.useEffect(() => {
    const timer = setInterval(publish, PRESENCE_HEARTBEAT_MS)
    const leave = () => {
      clearPresence(tabId).catch(() => {})
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") publish()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", leave)
    // back from the bfcache after `pagehide` removed us
    window.addEventListener("pageshow", publish)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", leave)
      window.removeEventListener("pageshow", publish)
      leave()
    }
  }, [publish, tabId])

  React.useEffect(
    () =>
      subscribeToPresence(
        (next) => {
          setRows(next)
          setUnavailable(false)
          // a confirmed heartbeat of ours arrives right after the server
          // stamped it, so its time minus ours is the clock difference
          const own = next.find((p) => p.id === tabId)
          if (own?.seenAtMs && !own.pending) {
            setSkewMs(own.seenAtMs - Date.now())
          }
        },
        () => setUnavailable(true)
      ),
    [tabId]
  )

  // tidy up tabs that died without deleting their doc
  const swept = React.useRef(new Set<string>())
  React.useEffect(() => {
    for (const p of rows) {
      if (p.id === tabId || swept.current.has(p.id)) continue
      if (p.seenAtMs && serverNowMs - p.seenAtMs > PRESENCE_GARBAGE_MS) {
        swept.current.add(p.id)
        clearPresence(p.id).catch(() => {})
      }
    }
  }, [rows, serverNowMs, tabId])

  const claim = React.useCallback(
    (focus: PresenceFocus) => {
      if (samePresenceFocus(focusRef.current, focus)) return
      focusRef.current = focus
      publish()
    },
    [publish]
  )
  const release = React.useCallback(
    (focus: PresenceFocus) => {
      // only if it is still ours — closing one picker while opening another
      // can release after the new claim
      if (!samePresenceFocus(focusRef.current, focus)) return
      focusRef.current = null
      publish()
    },
    [publish]
  )

  const others = React.useMemo(() => {
    const byUid = new Map<string, SchedulePresence>()
    for (const p of rows) {
      if (!p.uid || p.uid === actor.uid) continue
      if (!p.seenAtMs || serverNowMs - p.seenAtMs > PRESENCE_STALE_MS) continue
      // one person, several tabs: the tab doing something wins
      const prev = byUid.get(p.uid)
      if (
        !prev ||
        (!prev.focus && p.focus) ||
        (Boolean(prev.focus) === Boolean(p.focus) && p.seenAtMs > prev.seenAtMs)
      ) {
        byUid.set(p.uid, p)
      }
    }
    return [...byUid.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "vi")
    )
  }, [rows, serverNowMs, actor.uid])

  const recentByCell = React.useMemo(() => {
    const map = new Map<string, ScheduleChange>()
    for (const c of changes) {
      if (serverNowMs - c.atMs > CHANGE_FLASH_MS) break // newest first
      if (c.byUid === actor.uid || c.dayIndex == null || !c.shift) continue
      const key = cellKey(c.weekId, c.dayIndex, c.shift)
      if (!map.has(key)) map.set(key, c)
    }
    return map
  }, [changes, serverNowMs, actor.uid])

  const value = React.useMemo<LiveContextValue>(
    () => ({
      month,
      others,
      recentByCell,
      serverNowMs,
      unavailable,
      claim,
      release,
    }),
    [month, others, recentByCell, serverNowMs, unavailable, claim, release]
  )

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}

// ------------------------------------------------------------ hooks

/**
 * Tell the others what this component has open while `focus` is non-null
 * (a picker / popover / editor), and stop when it closes or unmounts.
 */
export function useReportFocus(focus: PresenceFocus | null) {
  const ctx = React.useContext(LiveContext)
  const claim = ctx?.claim
  const release = ctx?.release
  const key = focus ? JSON.stringify(focus) : null
  React.useEffect(() => {
    if (!key || !claim || !release) return
    const parsed = JSON.parse(key) as PresenceFocus
    claim(parsed)
    return () => release(parsed)
  }, [key, claim, release])
}

/** Who else has this cell open, and someone else's change to it just now. */
export function useCellLive(weekId: string, dayIndex: number, shift: ShiftId) {
  const ctx = React.useContext(LiveContext)
  const others = ctx?.others
  const recentByCell = ctx?.recentByCell
  return React.useMemo(
    () => ({
      viewers: (others ?? []).filter(
        (p) =>
          p.focus?.weekId === weekId &&
          p.focus.dayIndex === dayIndex &&
          p.focus.shift === shift
      ),
      recent: recentByCell?.get(cellKey(weekId, dayIndex, shift)) ?? null,
    }),
    [others, recentByCell, weekId, dayIndex, shift]
  )
}

/** Who else has a week-level editor (overtime / week note) of `weekId` open. */
export function useWeekViewers(weekId: string, action: PresenceAction) {
  const others = React.useContext(LiveContext)?.others
  return React.useMemo(
    () =>
      (others ?? []).filter(
        (p) => p.focus?.weekId === weekId && p.focus.action === action
      ),
    [others, weekId, action]
  )
}

// ------------------------------------------------------------ cell marker

/**
 * Wraps a grid cell: a ring + name tag in the colour of whoever else has it
 * open, or an amber glow + "X vừa …" for a few seconds after someone else
 * changed it.
 */
export function CellLiveFrame({
  weekId,
  dayIndex,
  shift,
  children,
}: {
  weekId: string
  dayIndex: number
  shift: ShiftId
  children: React.ReactNode
}) {
  const { viewers, recent } = useCellLive(weekId, dayIndex, shift)
  const lead = viewers[0]
  const tone = lead ? personTone(lead.uid) : null

  let tag: React.ReactNode = null
  let title: string | undefined
  if (lead && tone) {
    title = viewers
      .map((p) => `${p.name} ${PRESENCE_ACTION_LABELS[p.focus!.action]}`)
      .join(" · ")
    tag = (
      <span
        className={cn(
          "pointer-events-none absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-px text-[0.6rem] leading-tight font-medium whitespace-nowrap shadow-sm",
          tone.tag
        )}
      >
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        {shortName(lead.name)}
        {viewers.length > 1 ? ` +${viewers.length - 1}` : ""}
        {lead.focus?.action === "note" ? " · ghi chú" : ""}
      </span>
    )
  } else if (recent) {
    title = `${recent.byName}: ${recent.summary}`
    tag = (
      <span className="pointer-events-none absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-1.5 py-px text-[0.6rem] leading-tight font-medium whitespace-nowrap text-white shadow-sm">
        {shortName(recent.byName)} vừa {CHANGE_VERBS[recent.kind] ?? "sửa"}
      </span>
    )
  }

  return (
    <div
      title={title}
      className={cn(
        "relative rounded-md transition-shadow",
        tone && cn("ring-2 ring-offset-1 ring-offset-background", tone.ring),
        !tone &&
          recent &&
          "bg-amber-100/70 ring-2 ring-amber-400 ring-offset-1 ring-offset-background dark:bg-amber-500/15"
      )}
    >
      {tag}
      {children}
    </div>
  )
}

/** "Hà đang nhập" chips for a week-level editor's heading. */
export function WeekViewerTags({
  weekId,
  action,
}: {
  weekId: string
  action: PresenceAction
}) {
  const viewers = useWeekViewers(weekId, action)
  if (viewers.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {viewers.map((p) => (
        <span
          key={p.uid}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[0.65rem] font-medium",
            personTone(p.uid).tag
          )}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-current" />
          {shortName(p.name)} đang sửa
        </span>
      ))}
    </span>
  )
}

/** Names of the others on this cell, for a warning inside its picker. */
export function useCellOtherNames(
  weekId: string,
  dayIndex: number,
  shift: ShiftId
): string[] {
  const { viewers } = useCellLive(weekId, dayIndex, shift)
  return viewers.map((p) => p.name)
}

// ------------------------------------------------------------ top panel

/**
 * "Đang mở lịch" (who has the page open and what they're doing) next to
 * "Vừa thao tác" (the month's latest changes, live).
 */
export function LivePresencePanel({
  actor,
  changes,
}: {
  actor: Actor
  changes: ScheduleChange[]
}) {
  const ctx = React.useContext(LiveContext)
  if (!ctx) return null
  const { others, month, serverNowMs, unavailable } = ctx
  const latest = changes.slice(0, 6)

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-3 shadow-xs md:grid-cols-2">
      <section className="min-w-0">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Đang mở lịch · {others.length + 1} người
        </h2>
        {unavailable ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Chưa đọc được danh sách người đang mở (thiếu quyền Firestore cho
            schedulePresence).
          </p>
        ) : null}
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span
              className={cn("size-2 shrink-0 rounded-full", personTone(actor.uid).dot)}
            />
            <span className="font-medium">{actor.name}</span>
            <span className="text-muted-foreground">(bạn)</span>
          </li>
          {others.map((p) => (
            <li key={p.uid} className="flex min-w-0 items-center gap-2">
              <span
                className={cn("size-2 shrink-0 rounded-full", personTone(p.uid).dot)}
              />
              <span className="shrink-0 font-medium">{p.name}</span>
              <span className="min-w-0 truncate text-muted-foreground">
                {p.focus ? (
                  <>
                    —{" "}
                    <span className="font-medium text-foreground">
                      {PRESENCE_ACTION_LABELS[p.focus.action]}
                    </span>{" "}
                    · {describeFocus(p.focus)}
                  </>
                ) : p.month && p.month !== month ? (
                  `— đang xem ${monthKeyLabel(p.month)}`
                ) : (
                  "— đang xem"
                )}
              </span>
            </li>
          ))}
        </ul>
        {others.length === 0 && !unavailable ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Chưa có ai khác đang mở lịch.
          </p>
        ) : null}
      </section>

      <section className="min-w-0">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Vừa thao tác
        </h2>
        {latest.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Tháng này chưa có thao tác nào.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {latest.map((c) => {
              const fresh = serverNowMs - c.atMs < CHANGE_FLASH_MS
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex min-w-0 items-baseline gap-2 rounded-md px-1.5 py-0.5 transition-colors",
                    fresh && "bg-amber-100/70 dark:bg-amber-500/15"
                  )}
                >
                  <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatAgo(c.atMs, serverNowMs)}
                  </span>
                  <span
                    className={cn(
                      "size-2 shrink-0 self-center rounded-full",
                      personTone(c.byUid).dot
                    )}
                  />
                  <span className="min-w-0 truncate" title={c.summary}>
                    <span className="font-medium">{shortName(c.byName)}</span>
                    <span className="text-muted-foreground">: </span>
                    {c.summary}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
