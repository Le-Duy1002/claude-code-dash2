"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { RANGE_LABELS, RANGE_PRESET_GROUPS, type RangeKey } from "../types"

export type RangeValue = {
  range: RangeKey
  /** `YYYY-MM-DD` (Vietnam), only meaningful when range === "custom" */
  from?: string
  to?: string
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
const MONTHS = (n: number) => `Th${String(n + 1).padStart(2, "0")}`

function todayISO(): string {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function parseISO(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number)
  return { y, m: m - 1, d }
}

/** dd/mm/yyyy */
function fmt(s: string): string {
  const { y, m, d } = parseISO(s)
  return `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`
}

/** Monday-first weeks for a month; leading/trailing days are null. */
function monthGrid(y: number, m: number): (number | null)[][] {
  const first = new Date(Date.UTC(y, m, 1))
  const startPad = (first.getUTCDay() + 6) % 7 // Mon = 0
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const cells: (number | null)[] = Array(startPad).fill(null)
  for (let d = 1; d <= days; d += 1) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function addMonth(y: number, m: number, delta: number) {
  const base = new Date(Date.UTC(y, m + delta, 1))
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() }
}

function Month({
  y,
  m,
  from,
  to,
  onPick,
}: {
  y: number
  m: number
  from: string | null
  to: string | null
  onPick: (isoDate: string) => void
}) {
  const weeks = monthGrid(y, m)
  const today = todayISO()
  return (
    <div className="w-[15rem]">
      <p className="mb-1.5 text-center text-sm font-medium">
        {MONTHS(m)} {y}
      </p>
      <div className="grid grid-cols-7 text-center text-[0.7rem] text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
        {weeks.flat().map((d, i) => {
          if (d == null) return <span key={i} />
          const cur = iso(y, m, d)
          const inRange =
            from && to && cur >= from && cur <= to && cur !== from && cur !== to
          const isEnd = cur === from || cur === to
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(cur)}
              className={cn(
                "mx-auto flex size-8 items-center justify-center rounded-md tabular-nums transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                inRange && "rounded-none bg-primary/10 text-foreground",
                isEnd && "bg-primary font-medium text-primary-foreground",
                !isEnd && cur === today && "ring-1 ring-primary ring-inset"
              )}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: RangeValue
  onChange: (next: RangeValue) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [draftFrom, setDraftFrom] = React.useState<string | null>(null)
  const [draftTo, setDraftTo] = React.useState<string | null>(null)
  const [view, setView] = React.useState(() => {
    const base = value.from ? parseISO(value.from) : parseISO(todayISO())
    return addMonth(base.y, base.m, -1)
  })

  // seed the draft from the current value each time the popover opens
  React.useEffect(() => {
    if (!open) return
    if (value.range === "custom" && value.from) {
      setDraftFrom(value.from)
      setDraftTo(value.to ?? value.from)
      const p = parseISO(value.from)
      setView(addMonth(p.y, p.m, -1))
    } else {
      setDraftFrom(null)
      setDraftTo(null)
    }
  }, [open, value.range, value.from, value.to])

  const label =
    value.range === "custom" && value.from
      ? `${fmt(value.from)} → ${fmt(value.to ?? value.from)}`
      : RANGE_LABELS[value.range]

  function pick(isoDate: string) {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(isoDate)
      setDraftTo(null)
    } else if (isoDate < draftFrom) {
      setDraftTo(draftFrom)
      setDraftFrom(isoDate)
    } else {
      setDraftTo(isoDate)
    }
  }

  function applyCustom() {
    if (!draftFrom) return
    onChange({ range: "custom", from: draftFrom, to: draftTo ?? draftFrom })
    setOpen(false)
  }

  function applyPreset(key: RangeKey) {
    onChange({ range: key })
    setOpen(false)
  }

  const next = addMonth(view.y, view.m, 1)
  const previewFrom = draftFrom
  const previewTo = draftTo ?? draftFrom

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button variant="outline" size="sm" className={cn("gap-1.5", className)} />
        }
      >
        <CalendarIcon data-icon="inline-start" className="size-4" />
        <span className="tabular-nums">{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="end" className="z-50">
          <Popover.Popup className="z-50 origin-(--transform-origin) rounded-lg border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex flex-col sm:flex-row">
              {/* presets */}
              <div className="flex min-w-[9rem] flex-col gap-0.5 border-b p-2 sm:border-r sm:border-b-0">
                {RANGE_PRESET_GROUPS.map((group) => (
                  <div key={group.label} className="mb-1 last:mb-0">
                    <p className="px-2 py-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </p>
                    {group.keys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyPreset(key)}
                        className={cn(
                          "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                          value.range === key &&
                            "bg-accent font-medium text-accent-foreground"
                        )}
                      >
                        {RANGE_LABELS[key]}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* calendar */}
              <div className="p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setView(addMonth(view.y, view.m, -1))}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {previewFrom
                      ? `${fmt(previewFrom)}${
                          previewTo && previewTo !== previewFrom
                            ? ` → ${fmt(previewTo)}`
                            : " → …"
                        }`
                      : "Chọn ngày bắt đầu và kết thúc"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setView(addMonth(view.y, view.m, 1))}
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
                <div className="flex gap-4">
                  <Month
                    y={view.y}
                    m={view.m}
                    from={previewFrom}
                    to={previewTo}
                    onPick={pick}
                  />
                  <div className="hidden sm:block">
                    <Month
                      y={next.y}
                      m={next.m}
                      from={previewFrom}
                      to={previewTo}
                      onPick={pick}
                    />
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraftFrom(null)
                      setDraftTo(null)
                    }}
                  >
                    Xoá
                  </Button>
                  <Button size="sm" disabled={!draftFrom} onClick={applyCustom}>
                    Áp dụng
                  </Button>
                </div>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
