"use client"

import * as React from "react"
import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import {
  subscribeToChanges,
  subscribeToWeeks,
} from "../services/schedule-service"
import {
  MONTH_LABELS,
  emptyWeek,
  parseIso,
  todayIso,
  weeksOfMonth,
  type ScheduleChange,
  type ScheduleWeek,
} from "../types"
import { ChangeHistoryDialog } from "./change-history-dialog"
import { WeekGrid } from "./week-grid"

function shiftMonth(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

export function ScheduleView() {
  const { user } = useAuth()
  const actor = React.useMemo(
    () =>
      user
        ? {
            uid: user.uid,
            name: user.displayName || user.email || "Người dùng",
          }
        : null,
    [user]
  )

  const today = parseIso(todayIso())
  const [year, setYear] = React.useState(today.getUTCFullYear())
  const [month, setMonth] = React.useState(today.getUTCMonth() + 1)

  const weekIds = React.useMemo(() => weeksOfMonth(year, month), [year, month])

  const [weeks, setWeeks] = React.useState<Record<string, ScheduleWeek>>({})
  const [changes, setChanges] = React.useState<ScheduleChange[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    let got = false
    const done = () => {
      got = true
      setLoading(false)
    }
    const unsubWeeks = subscribeToWeeks(
      weekIds,
      (next) => {
        setWeeks(next)
        done()
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      }
    )
    const unsubChanges = subscribeToChanges(weekIds, setChanges, () => {})
    const t = setTimeout(() => {
      if (!got) setLoading(false)
    }, 4000)
    return () => {
      unsubWeeks()
      unsubChanges()
      clearTimeout(t)
    }
  }, [user, weekIds])

  const displayWeeks = React.useMemo(
    () => weekIds.map((id) => weeks[id] ?? emptyWeek(id)),
    [weekIds, weeks]
  )

  const yearOptions = React.useMemo(() => {
    const base = today.getUTCFullYear()
    const years = new Set([base - 1, base, base + 1, year])
    return [...years]
      .sort((a, b) => a - b)
      .map((y) => ({ value: String(y), label: String(y) }))
  }, [today, year])

  const monthLabel = `${MONTH_LABELS[month - 1]}/${year}`

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Lịch làm việc</h1>
          <p className="text-sm text-muted-foreground">
            Mỗi người tự chọn tên mình vào ca đăng ký. Quản lý bấm{" "}
            <strong>Chốt tuần</strong> khi lịch đã ổn — sau đó mọi chỉnh sửa
            được ghi vào lịch sử. Dữ liệu này dùng chấm tiêu chí 1–2 và tính
            lương.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              const n = shiftMonth(year, month, -1)
              setYear(n.year)
              setMonth(n.month)
            }}
          >
            <ChevronLeftIcon />
          </Button>
          <Select
            items={MONTH_LABELS.map((l, i) => ({
              value: String(i + 1),
              label: l,
            }))}
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {MONTH_LABELS.map((l, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {l}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            items={yearOptions}
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {yearOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              const n = shiftMonth(year, month, 1)
              setYear(n.year)
              setMonth(n.month)
            }}
          >
            <ChevronRightIcon />
          </Button>
          <ChangeHistoryDialog changes={changes} monthLabel={monthLabel} />
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : actor ? (
        <div className="flex flex-col gap-5">
          {displayWeeks.map((week) => (
            <WeekGrid key={week.weekId} week={week} actor={actor} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
