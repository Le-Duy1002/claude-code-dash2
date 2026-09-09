"use client"

import * as React from "react"
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import { formatDateTime, pancakeConvLink, type ScoreEventLite } from "../types"

function copyText(text: string, note: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(note),
    () => toast.error("Không copy được")
  )
}

/**
 * The grouped list of conversations/events behind a score cell — shared by the
 * work-tracking scorecard drill-down and the daily-log drill-down. Click a name
 * to copy it, click the ID to copy the conversation id, "↗ Pancake" opens it.
 */
export function OffenderList({ events }: { events: ScoreEventLite[] }) {
  const [showDetails, setShowDetails] = React.useState(false)

  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      ScoreEventLite & { count: number }
    >()
    for (const e of events) {
      const key = `${e.label}|${e.detail ?? ""}`
      const prev = map.get(key)
      if (prev) {
        prev.count += 1
        prev.atMs = Math.min(prev.atMs, e.atMs)
      } else {
        map.set(key, { ...e, count: 1 })
      }
    }
    return [...map.values()].sort((a, b) => a.atMs - b.atMs)
  }, [events])

  if (grouped.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Không có hội thoại nào.</p>
    )
  }

  const hasConvIds = grouped.some((e) => e.conversationId)
  const n = `${events.length}${events.length >= 40 ? "+" : ""}`

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {hasConvIds
            ? `Hội thoại làm mất điểm (${n}) — bấm tên để copy, bấm ID để copy ID hội thoại`
            : `Chi tiết làm mất điểm (${n})`}
        </p>
        {hasConvIds ? (
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            aria-expanded={showDetails}
          >
            {showDetails ? "Ẩn ID hội thoại" : "Hiện ID hội thoại"}
            <ChevronDownIcon
              className={cn(
                "size-3.5 transition-transform",
                showDetails && "rotate-180"
              )}
            />
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y rounded-md border text-sm">
        {grouped.map((e, i) => {
          const link = pancakeConvLink(e.pageId, e.conversationId)
          return (
            <li key={i} className="flex flex-col gap-0.5 px-2.5 py-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums text-muted-foreground">
                  {formatDateTime(e.atMs)}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(e.label, `Đã copy tên: ${e.label}`)}
                  className="font-medium underline-offset-2 hover:underline"
                  title="Bấm để copy tên khách"
                >
                  {e.label}
                </button>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                    title="Mở hội thoại trên Pancake"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                    Pancake
                  </a>
                ) : null}
                {e.detail ? (
                  <span className="text-destructive">— {e.detail}</span>
                ) : null}
                {e.count > 1 ? (
                  <span className="text-muted-foreground">×{e.count}</span>
                ) : null}
              </div>
              {showDetails && e.conversationId ? (
                <button
                  type="button"
                  onClick={() =>
                    copyText(e.conversationId as string, "Đã copy ID hội thoại")
                  }
                  className="w-fit font-mono text-[0.7rem] text-muted-foreground underline-offset-2 hover:underline"
                  title="Bấm để copy ID hội thoại"
                >
                  ID: {e.conversationId}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
