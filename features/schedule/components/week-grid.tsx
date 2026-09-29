"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import {
  CheckIcon,
  LockIcon,
  MessageSquareTextIcon,
  MoonIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  SunIcon,
  SunsetIcon,
  UnlockIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  lockWeek,
  setCell,
  setCellNote,
  setFreeNote,
  setOvertime,
  unlockWeek,
  type Actor,
} from "../services/schedule-service"
import {
  SCHEDULE_STAFF,
  SHIFT_DEFS,
  SHIFT_IDS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  coverByHour,
  coverFromHours,
  formatHourRanges,
  formatHours,
  getCell,
  registeredHours,
  shiftHourSlots,
  staffName,
  todayIso,
  weekDates,
  weekEndDate,
  weekLabel,
  type ScheduleWeek,
  type ShiftId,
} from "../types"

// An empty cell has value `null` and shows nothing; the "clear" item is only
// offered once someone is assigned.
const CLEAR = "__clear__"
const STAFF_OPTIONS = SCHEDULE_STAFF.map((s) => ({ value: s.key, label: s.name }))
const FILLED_OPTIONS = [{ value: CLEAR, label: "Bỏ chọn" }, ...STAFF_OPTIONS]
const HOUR_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// Class strings are spelled out in full so Tailwind can see them.
type Tone = { chip: string; dot: string }
const STAFF_TONES: Tone[] = [
  {
    chip: "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25",
    dot: "bg-sky-500",
  },
  {
    chip: "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25",
    dot: "bg-violet-500",
  },
  {
    chip: "border-pink-300 bg-pink-50 text-pink-800 hover:bg-pink-100 dark:border-pink-700 dark:bg-pink-500/15 dark:text-pink-200 dark:hover:bg-pink-500/25",
    dot: "bg-pink-500",
  },
  {
    chip: "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25",
    dot: "bg-emerald-500",
  },
  {
    chip: "border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/25",
    dot: "bg-cyan-500",
  },
  {
    chip: "border-lime-300 bg-lime-50 text-lime-800 hover:bg-lime-100 dark:border-lime-700 dark:bg-lime-500/15 dark:text-lime-200 dark:hover:bg-lime-500/25",
    dot: "bg-lime-500",
  },
]
const NEUTRAL_TONE: Tone = { chip: "bg-muted", dot: "bg-muted-foreground" }
const STAFF_TONE = new Map(
  SCHEDULE_STAFF.map((s, i) => [s.key, STAFF_TONES[i % STAFF_TONES.length]])
)

function staffTone(key: string): Tone {
  return STAFF_TONE.get(key) ?? NEUTRAL_TONE
}

const SHIFT_TONES: Record<ShiftId, { Icon: LucideIcon; badge: string }> = {
  sang: {
    Icon: SunIcon,
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  chieu: {
    Icon: SunsetIcon,
    badge:
      "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
  toi: {
    Icon: MoonIcon,
    badge:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
}

const POPUP_CLASS =
  "z-50 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"

export function WeekGrid({ week, actor }: { week: ScheduleWeek; actor: Actor }) {
  const dates = weekDates(week.weekId)
  const today = todayIso()
  const locked = week.status === "locked"

  // locked-week edit mode: status stays "locked" (so changes log as after-lock),
  // but the reason entered here is attached to every change made in this session
  const [editing, setEditing] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const editable = !locked || editing
  const changeReason = locked ? reason : null

  const hours = React.useMemo(
    () => registeredHours([week], week.weekId, weekEndDate(week.weekId)),
    [week]
  )


  return (
    <div className="overflow-hidden rounded-lg border shadow-xs">
      {/* header */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2",
          locked ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {weekLabel(week.weekId)}
          </span>
          <Badge
            variant={locked ? "default" : "outline"}
            className={cn(
              locked && "bg-emerald-600 text-white dark:bg-emerald-500"
            )}
          >
            {locked ? (
              <>
                <LockIcon /> Đã chốt
              </>
            ) : (
              "Nháp"
            )}
          </Badge>
          {locked && week.lockedByName ? (
            <span className="text-xs text-muted-foreground">
              {week.lockedByName}
            </span>
          ) : null}
        </div>
        <WeekControls
          week={week}
          actor={actor}
          editing={editing}
          onStartEditing={(r) => {
            setReason(r)
            setEditing(true)
          }}
          onStopEditing={() => {
            setEditing(false)
            setReason("")
          }}
        />
      </div>

      {/* grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-32 px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Ca
              </th>
              {dates.map((date, i) => {
                const isToday = date === today
                return (
                  <th
                    key={i}
                    className={cn(
                      "border-l px-2 py-1.5 text-center font-medium",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <div>{WEEKDAY_LABELS[i]}</div>
                    <div
                      className={cn(
                        "mt-0.5 inline-flex h-5 items-center rounded-full px-2 text-xs font-normal text-muted-foreground tabular-nums",
                        isToday && "bg-primary font-medium text-primary-foreground"
                      )}
                    >
                      {date.slice(8)}/{date.slice(5, 7)}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {SHIFT_IDS.map((shift) => {
              const { Icon, badge } = SHIFT_TONES[shift]
              return (
                <tr key={shift} className="border-b last:border-b-0">
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md",
                          badge
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <div className="font-medium">
                          {SHIFT_DEFS[shift].label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {SHIFT_DEFS[shift].range}
                        </div>
                      </div>
                    </div>
                  </td>
                  {dates.map((date, dayIndex) => (
                    <td
                      key={dayIndex}
                      className={cn(
                        "border-l px-1.5 py-1.5 text-center align-middle",
                        date === today && "bg-primary/[0.03]"
                      )}
                    >
                      <ShiftCell
                        week={week}
                        dayIndex={dayIndex}
                        shift={shift}
                        editable={editable}
                        actor={actor}
                        reason={changeReason}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* per-week hours */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Giờ đăng ký tuần:</span>
        {SCHEDULE_STAFF.map((s) => {
          const h = hours[s.key]
          const total = (h?.shiftHours ?? 0) + (h?.overtimeHours ?? 0)
          return (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className={cn("size-2 rounded-full", staffTone(s.key).dot)}
              />
              {s.name}{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatHours(total)}
              </span>
              {h?.overtimeHours ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {" "}
                  (+{formatHours(h.overtimeHours)} TG)
                </span>
              ) : null}
            </span>
          )
        })}
      </div>

      {/* overtime + note */}
      {editing && locked ? (
        <div className="border-t border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          Đang điều chỉnh tuần đã chốt — mọi thay đổi được ghi vào lịch sử. Lý
          do: <strong>{reason || "(chưa nhập)"}</strong>
        </div>
      ) : null}

      <div className="grid gap-3 border-t p-3 md:grid-cols-2">
        <OvertimeEditor
          week={week}
          actor={actor}
          editable={editable}
          reason={changeReason}
        />
        <FreeNoteEditor
          week={week}
          actor={actor}
          editable={editable}
          reason={changeReason}
        />
      </div>
    </div>
  )
}

// -------------------------------------------------------------- one cell

function ShiftCell({
  week,
  dayIndex,
  shift,
  editable,
  actor,
  reason,
}: {
  week: ScheduleWeek
  dayIndex: number
  shift: ShiftId
  editable: boolean
  actor: Actor
  reason: string | null
}) {
  const cell = getCell(week, dayIndex, shift)
  const [noteOpen, setNoteOpen] = React.useState(false)
  const [noteDraft, setNoteDraft] = React.useState(cell.note ?? "")
  const [excludeDraft, setExcludeDraft] = React.useState(
    Boolean(cell.excludeFromScore)
  )
  const [coverDraft, setCoverDraft] = React.useState(() =>
    coverByHour(cell.cover)
  )

  React.useEffect(() => {
    if (noteOpen) {
      setNoteDraft(cell.note ?? "")
      setExcludeDraft(Boolean(cell.excludeFromScore))
      setCoverDraft(coverByHour(cell.cover))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteOpen])

  async function commitStaff(staffKey: string | null) {
    try {
      await setCell(week, dayIndex, shift, staffKey, actor, reason)
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    }
  }

  async function commitNote() {
    try {
      await setCellNote(
        week,
        dayIndex,
        shift,
        noteDraft.trim(),
        excludeDraft,
        coverFromHours(coverDraft),
        actor,
        reason
      )
      setNoteOpen(false)
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    }
  }

  const covers = cell.excludeFromScore ? (cell.cover ?? []) : []
  const marker =
    cell.note || cell.excludeFromScore ? (
      <div className="flex flex-col items-center px-1 text-[0.65rem] leading-tight text-amber-600 dark:text-amber-400">
        {cell.excludeFromScore && covers.length === 0 ? (
          <span>⇄ đổi ca</span>
        ) : null}
        {covers.map((c) => (
          <span
            key={c.staff}
            className="inline-flex items-center gap-1 whitespace-nowrap"
            title={`${staffName(c.staff)} trực hộ ${formatHourRanges(c.hours)}`}
          >
            ⇄
            <span className={cn("size-1.5 rounded-full", staffTone(c.staff).dot)} />
            {staffName(c.staff)} {formatHourRanges(c.hours)}
          </span>
        ))}
        {cell.note ? (
          <span className="block max-w-full truncate" title={cell.note}>
            {cell.note}
          </span>
        ) : null}
      </div>
    ) : null

  if (!editable) {
    return (
      <div className="flex min-h-7 flex-col items-center justify-center gap-0.5 px-1 py-0.5">
        {cell.staff ? (
          <span
            className={cn(
              "rounded-md border px-2.5 py-0.5 text-sm font-medium",
              staffTone(cell.staff).chip
            )}
          >
            {staffName(cell.staff)}
          </span>
        ) : null}
        {marker}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-0.5">
        <Select
          items={cell.staff ? FILLED_OPTIONS : STAFF_OPTIONS}
          value={cell.staff}
          onValueChange={(v) => commitStaff(!v || v === CLEAR ? null : v)}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              "w-full min-w-[5rem]",
              cell.staff
                ? cn("font-medium", staffTone(cell.staff).chip)
                : "border-dashed dark:bg-transparent [&_svg]:opacity-40 hover:[&_svg]:opacity-100 hover:bg-muted/60"
            )}
          >
            <SelectValue className="justify-center">
              {(v: string | null) => (v ? staffName(v) : null)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {cell.staff ? (
                <SelectItem value={CLEAR} className="text-muted-foreground">
                  <XIcon />
                  Bỏ chọn
                </SelectItem>
              ) : null}
              {SCHEDULE_STAFF.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  <span
                    className={cn("size-2 rounded-full", staffTone(s.key).dot)}
                  />
                  {s.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Popover.Root open={noteOpen} onOpenChange={setNoteOpen}>
          <Popover.Trigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "shrink-0",
                  cell.note || cell.excludeFromScore
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground/50 hover:text-foreground"
                )}
              />
            }
          >
            {cell.excludeFromScore ? (
              <RepeatIcon />
            ) : (
              <MessageSquareTextIcon />
            )}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={4} align="end" className="z-50">
              <Popover.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
                <ShiftHeading
                  shift={shift}
                  dayIndex={dayIndex}
                  staff={cell.staff}
                />
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                  <Checkbox
                    checked={excludeDraft}
                    onCheckedChange={(c) => setExcludeDraft(c === true)}
                    className="mt-0.5"
                  />
                  <span>
                    Ca này có đổi / nhờ người trực hộ — bỏ qua khi chấm tiêu chí
                    1 (Đủ giờ ca) &amp; 2 (Vào ca)
                  </span>
                </label>
                {excludeDraft ? (
                  <CoverPicker
                    shift={shift}
                    owner={cell.staff}
                    value={coverDraft}
                    onChange={setCoverDraft}
                  />
                ) : null}
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú thêm (không bắt buộc)"
                  className="mt-3 min-h-0 text-sm"
                />
                <div className="mt-2 flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setNoteOpen(false)}
                  >
                    Huỷ
                  </Button>
                  <Button size="sm" onClick={commitNote}>
                    Lưu
                  </Button>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {marker}
    </div>
  )
}

function ShiftHeading({
  shift,
  dayIndex,
  staff,
}: {
  shift: ShiftId
  dayIndex: number
  staff: string | null
}) {
  const { Icon, badge } = SHIFT_TONES[shift]
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          badge
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          Ca {SHIFT_DEFS[shift].label.toLowerCase()} · {WEEKDAY_LABELS[dayIndex]}
        </p>
        <p className="text-xs text-muted-foreground">
          {SHIFT_DEFS[shift].range}
          {staff ? ` · ${staffName(staff)} đăng ký` : ""}
        </p>
      </div>
    </div>
  )
}

/**
 * Pick who covered the shift, then tick the hours they covered (Shift-click
 * fills a range from the last clicked hour). Hours map to one person each, so
 * several people can split a shift.
 */
function CoverPicker({
  shift,
  owner,
  value,
  onChange,
}: {
  shift: ShiftId
  owner: string | null
  value: Record<number, string>
  onChange: (next: Record<number, string>) => void
}) {
  const people = SCHEDULE_STAFF.filter((s) => s.key !== owner)
  const slots = shiftHourSlots(shift)
  const [active, setActive] = React.useState<string | null>(
    () => Object.values(value)[0] ?? null
  )
  const anchorRef = React.useRef<number | null>(null)

  function pick(hour: number, extend: boolean) {
    if (!active) return
    const next = { ...value }
    if (extend && anchorRef.current !== null) {
      const lo = Math.min(anchorRef.current, hour)
      const hi = Math.max(anchorRef.current, hour)
      for (let h = lo; h <= hi; h += 1) next[h] = active
    } else {
      if (next[hour] === active) delete next[hour]
      else next[hour] = active
    }
    anchorRef.current = hour
    onChange(next)
  }

  function fillAll() {
    if (!active) return
    onChange(Object.fromEntries(slots.map((h) => [h, active])))
  }

  const summary = coverFromHours(value)

  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-md border bg-muted/30 p-2.5">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Người trực hộ
        </p>
        <div className="flex flex-wrap gap-1">
          {people.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                active === s.key
                  ? cn(staffTone(s.key).chip, "ring-2 ring-foreground/25")
                  : "bg-background hover:bg-accent"
              )}
            >
              <span className={cn("size-2 rounded-full", staffTone(s.key).dot)} />
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Giờ {staffName(active)} trực{" "}
              <span className="font-normal">(Shift để chọn dãy)</span>
            </p>
            <button
              type="button"
              onClick={fillAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              Cả ca
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {slots.map((h) => {
              const who = value[h]
              return (
                <button
                  key={h}
                  type="button"
                  onClick={(e) => pick(h, e.shiftKey)}
                  title={`${h}:00–${h + 1}:00${who ? ` · ${staffName(who)}` : ""}`}
                  className={cn(
                    "flex h-10 flex-col items-center justify-center rounded-md border text-xs tabular-nums transition-colors select-none",
                    who
                      ? staffTone(who).chip
                      : "border-dashed bg-background text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span className="font-medium">
                    {h}–{h + 1}
                  </span>
                  {who ? (
                    <span className="text-[0.6rem] leading-none">
                      {staffName(who)}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Chọn người trực hộ để đánh dấu giờ.
        </p>
      )}

      {summary.length ? (
        <p className="text-xs">
          {summary
            .map((c) => `${staffName(c.staff)} ${formatHourRanges(c.hours)}`)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  )
}

// -------------------------------------------------------------- week controls

function WeekControls({
  week,
  actor,
  editing,
  onStartEditing,
  onStopEditing,
}: {
  week: ScheduleWeek
  actor: Actor
  editing: boolean
  onStartEditing: (reason: string) => void
  onStopEditing: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [lockOpen, setLockOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const [draftReason, setDraftReason] = React.useState("")

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (error) {
      toast.error(`Lỗi: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  if (week.status === "draft") {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setLockOpen(true)}
        >
          <LockIcon data-icon="inline-start" />
          Chốt tuần
        </Button>
        <Dialog open={lockOpen} onOpenChange={setLockOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chốt lịch {weekLabel(week.weekId)}?</DialogTitle>
              <DialogDescription>
                Sau khi chốt, mọi chỉnh sửa sẽ được ghi vào lịch sử rà soát. Vẫn
                có thể mở ra điều chỉnh sau.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setLockOpen(false)}>
                Huỷ
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await lockWeek(week, actor)
                    setLockOpen(false)
                    toast.success("Đã chốt tuần")
                  })
                }
              >
                Chốt tuần
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // locked
  return (
    <div className="flex items-center gap-1.5">
      {editing ? (
        <Button size="sm" onClick={onStopEditing}>
          <CheckIcon data-icon="inline-start" />
          Xong
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setDraftReason("")
            setEditOpen(true)
          }}
        >
          <PencilIcon data-icon="inline-start" />
          Điều chỉnh
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => {
          setDraftReason("")
          setUnlockOpen(true)
        }}
      >
        <UnlockIcon data-icon="inline-start" />
        Bỏ chốt
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Điều chỉnh tuần đã chốt</DialogTitle>
            <DialogDescription>
              Nhập lý do điều chỉnh. Lý do này gắn vào mọi thay đổi bạn thực
              hiện trong lần điều chỉnh này.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draftReason}
            onChange={(e) => setDraftReason(e.target.value)}
            placeholder="VD: Hà xin đổi ca chiều T4 sang Duy do việc gia đình"
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={!draftReason.trim()}
              onClick={() => {
                onStartEditing(draftReason.trim())
                setEditOpen(false)
              }}
            >
              Bắt đầu điều chỉnh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bỏ chốt {weekLabel(week.weekId)}?</DialogTitle>
            <DialogDescription>
              Tuần trở lại trạng thái nháp. Hành động này được ghi vào lịch sử.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draftReason}
            onChange={(e) => setDraftReason(e.target.value)}
            placeholder="Lý do bỏ chốt…"
            rows={2}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUnlockOpen(false)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !draftReason.trim()}
              onClick={() =>
                run(async () => {
                  await unlockWeek(week, actor, draftReason.trim())
                  setUnlockOpen(false)
                  onStopEditing()
                  toast.success("Đã bỏ chốt")
                })
              }
            >
              Bỏ chốt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// -------------------------------------------------------------- overtime
// Grouped by staff. Add: "＋" → pick a weekday → pick 1–9h. Each pick saves
// immediately (one entry per staff+day).

function HoursGrid({
  value,
  onPick,
}: {
  value?: number
  onPick: (hours: number) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {HOUR_CHOICES.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onPick(h)}
          className={cn(
            "h-8 rounded-md border text-sm tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground",
            value === h && "border-primary bg-primary text-primary-foreground"
          )}
        >
          {h}h
        </button>
      ))}
    </div>
  )
}

function OvertimeChip({
  dayIndex,
  hours,
  tone,
  editable,
  onSet,
  onRemove,
}: {
  dayIndex: number
  hours: number
  tone: Tone
  editable: boolean
  onSet: (hours: number) => void
  onRemove: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const label = `${WEEKDAY_SHORT[dayIndex]} · ${hours}h`

  if (!editable) {
    return (
      <Badge variant="outline" className={tone.chip}>
        {label}
      </Badge>
    )
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium transition-colors",
              tone.chip
            )}
          />
        }
      >
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50">
          <Popover.Popup className={cn(POPUP_CLASS, "w-40")}>
            <p className="mb-1 text-xs font-medium">
              {WEEKDAY_LABELS[dayIndex]} — số giờ
            </p>
            <HoursGrid
              value={hours}
              onPick={(h) => {
                onSet(h)
                setOpen(false)
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 w-full text-destructive"
              onClick={() => {
                onRemove()
                setOpen(false)
              }}
            >
              Xoá
            </Button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

const SELECTED_CELL = "border-primary bg-primary text-primary-foreground"
const GRID_CELL =
  "h-8 rounded-md border text-xs transition-colors hover:bg-accent hover:text-accent-foreground"

/** Multi-select with Shift-click extending a contiguous range from the anchor. */
function useRangeSelect() {
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const anchorRef = React.useRef<number | null>(null)

  const toggle = React.useCallback((i: number, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift && anchorRef.current !== null) {
        const a = anchorRef.current
        const lo = Math.min(a, i)
        const hi = Math.max(a, i)
        for (let d = lo; d <= hi; d += 1) next.add(d)
      } else {
        if (next.has(i)) next.delete(i)
        else next.add(i)
        anchorRef.current = i
      }
      return next
    })
  }, [])

  const clear = React.useCallback(() => {
    setSelected(new Set())
    anchorRef.current = null
  }, [])

  const list = React.useMemo(
    () => [...selected].sort((a, b) => a - b),
    [selected]
  )
  return { selected, toggle, clear, list }
}

type OtRow = { dayIndex: number; hours: number }

function AddOvertime({ onAddMany }: { onAddMany: (rows: OtRow[]) => void }) {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<"day" | "hour">("day")
  const days = useRangeSelect()
  const hours = useRangeSelect() // index into HOUR_CHOICES

  React.useEffect(() => {
    if (!open) {
      days.clear()
      hours.clear()
      setStep("day")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const hourVals = hours.list.map((i) => HOUR_CHOICES[i])
  // one hour picked → every day gets it; a range → days ramp through the range
  const preview: OtRow[] = days.list.map((dayIndex, i) => ({
    dayIndex,
    hours: hourVals[Math.min(i, hourVals.length - 1)] ?? 0,
  }))

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={<Button size="icon-sm" variant="outline" className="shrink-0" />}
      >
        <PlusIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50">
          <Popover.Popup className={cn(POPUP_CLASS, "w-56")}>
            {step === "day" ? (
              <>
                <p className="mb-1 text-xs font-medium">
                  Chọn thứ{" "}
                  <span className="font-normal text-muted-foreground">
                    (giữ Shift để chọn dãy)
                  </span>
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {WEEKDAY_SHORT.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => days.toggle(i, e.shiftKey)}
                      className={cn(GRID_CELL, days.selected.has(i) && SELECTED_CELL)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  disabled={days.list.length === 0}
                  onClick={() => setStep("hour")}
                >
                  Tiếp — {days.list.length} ngày →
                </Button>
              </>
            ) : (
              <>
                <p className="mb-1 text-xs font-medium">
                  {days.list.map((i) => WEEKDAY_SHORT[i]).join(", ")} — số giờ{" "}
                  <span className="font-normal text-muted-foreground">
                    (Shift để mỗi ngày một mức tăng dần)
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {HOUR_CHOICES.map((h, i) => (
                    <button
                      key={h}
                      type="button"
                      onClick={(e) => hours.toggle(i, e.shiftKey)}
                      className={cn(
                        GRID_CELL,
                        "tabular-nums",
                        hours.selected.has(i) && SELECTED_CELL
                      )}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                {hourVals.length > 1 ? (
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {preview
                      .map((r) => `${WEEKDAY_SHORT[r.dayIndex]} ${r.hours}h`)
                      .join(" · ")}
                  </p>
                ) : null}
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStep("day")}
                  >
                    ← Thứ
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={hourVals.length === 0}
                    onClick={() => {
                      onAddMany(preview)
                      setOpen(false)
                    }}
                  >
                    Lưu
                  </Button>
                </div>
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function OvertimeEditor({
  week,
  actor,
  editable,
  reason,
}: {
  week: ScheduleWeek
  actor: Actor
  editable: boolean
  reason: string | null
}) {
  async function applyRows(staffKey: string, rows: OtRow[]) {
    if (rows.length === 0) return
    const touched = new Set(rows.map((r) => r.dayIndex))
    const next = week.overtime.filter(
      (e) => !(e.staffKey === staffKey && touched.has(e.dayIndex))
    )
    for (const r of rows) {
      if (r.hours > 0) {
        next.push({
          id: `${staffKey}-${r.dayIndex}`,
          staffKey,
          dayIndex: r.dayIndex,
          hours: r.hours,
          note: "",
        })
      }
    }
    next.sort((a, b) =>
      a.staffKey === b.staffKey
        ? a.dayIndex - b.dayIndex
        : a.staffKey.localeCompare(b.staffKey)
    )
    const label = rows
      .map((r) => `${WEEKDAY_SHORT[r.dayIndex]} ${r.hours > 0 ? `${r.hours}h` : "bỏ"}`)
      .join(", ")
    try {
      await setOvertime(
        week,
        next,
        actor,
        `Giờ làm thêm ${staffName(staffKey)}: ${label}`,
        staffKey,
        reason
      )
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    }
  }

  const total = week.overtime.reduce((s, e) => s + (Number(e.hours) || 0), 0)

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Giờ làm thêm{total > 0 ? ` — tổng ${formatHours(total)}` : ""}
      </p>
      <ul className="flex flex-col gap-1.5">
        {SCHEDULE_STAFF.map((s) => {
          const mine = week.overtime
            .filter((e) => e.staffKey === s.key)
            .sort((a, b) => a.dayIndex - b.dayIndex)
          return (
            <li key={s.key} className="flex flex-wrap items-center gap-1">
              <span className="flex w-16 shrink-0 items-center gap-1.5 text-sm font-medium">
                <span
                  className={cn("size-2 rounded-full", staffTone(s.key).dot)}
                />
                {s.name}
              </span>
              {mine.map((e) => (
                <OvertimeChip
                  key={e.dayIndex}
                  dayIndex={e.dayIndex}
                  hours={e.hours}
                  tone={staffTone(s.key)}
                  editable={editable}
                  onSet={(h) => applyRows(s.key, [{ dayIndex: e.dayIndex, hours: h }])}
                  onRemove={() =>
                    applyRows(s.key, [{ dayIndex: e.dayIndex, hours: 0 }])
                  }
                />
              ))}
              {mine.length === 0 && !editable ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : null}
              {editable ? (
                <AddOvertime onAddMany={(rows) => applyRows(s.key, rows)} />
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// -------------------------------------------------------------- free note

function FreeNoteEditor({
  week,
  actor,
  editable,
  reason,
}: {
  week: ScheduleWeek
  actor: Actor
  editable: boolean
  reason: string | null
}) {
  const [value, setValue] = React.useState(week.freeNote)
  React.useEffect(() => {
    setValue(week.freeNote)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.weekId, week.updatedAtMs])

  async function commit() {
    if (value === week.freeNote) return
    try {
      await setFreeNote(week, value, actor, reason)
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
      setValue(week.freeNote)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Ghi chú tự do (note làm thêm giờ, đổi ca…)
      </p>
      {editable ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          rows={4}
          placeholder="VD: Duy T2:2h, T3:1h; Hà nghỉ chiều T6 nhờ Thương trực hộ…"
        />
      ) : (
        <p className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm whitespace-pre-wrap">
          {week.freeNote || (
            <span className="text-muted-foreground">Không có ghi chú.</span>
          )}
        </p>
      )}
    </div>
  )
}
