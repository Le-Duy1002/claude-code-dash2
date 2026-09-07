"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import {
  CheckIcon,
  LockIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  UnlockIcon,
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
  formatHours,
  getCell,
  registeredHours,
  staffName,
  weekDates,
  weekEndDate,
  weekLabel,
  type ScheduleWeek,
  type ShiftId,
} from "../types"

const NONE = "__none__"
const CELL_OPTIONS = [
  { value: NONE, label: "— trống —" },
  ...SCHEDULE_STAFF.map((s) => ({ value: s.key, label: s.name })),
]
const HOUR_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const POPUP_CLASS =
  "z-50 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"

export function WeekGrid({ week, actor }: { week: ScheduleWeek; actor: Actor }) {
  const dates = weekDates(week.weekId)
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
    <div className="overflow-hidden rounded-lg border">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{weekLabel(week.weekId)}</span>
          <Badge variant={locked ? "default" : "outline"}>
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
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="[&>th]:border-b [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-center [&>th]:font-medium">
              <th className="w-24 text-left">Ca</th>
              {dates.map((date, i) => (
                <th key={i}>
                  <div>{WEEKDAY_LABELS[i]}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {date.slice(8)}/{date.slice(5, 7)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFT_IDS.map((shift) => (
              <tr
                key={shift}
                className="[&>td]:border-b [&>td]:px-1.5 [&>td]:py-1 last:[&>td]:border-b-0"
              >
                <td className="!px-2 text-left align-middle">
                  <div className="font-medium">{SHIFT_DEFS[shift].label}</div>
                  <div className="text-xs text-muted-foreground">
                    {SHIFT_DEFS[shift].range}
                  </div>
                </td>
                {dates.map((_, dayIndex) => (
                  <td key={dayIndex} className="text-center align-middle">
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
            ))}
          </tbody>
        </table>
      </div>

      {/* per-week hours */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Giờ đăng ký tuần:</span>
        {SCHEDULE_STAFF.map((s) => {
          const h = hours[s.key]
          const total = (h?.shiftHours ?? 0) + (h?.overtimeHours ?? 0)
          return (
            <span key={s.key}>
              {s.name} <span className="tabular-nums">{formatHours(total)}</span>
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

  React.useEffect(() => {
    if (noteOpen) {
      setNoteDraft(cell.note ?? "")
      setExcludeDraft(Boolean(cell.excludeFromScore))
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
        actor,
        reason
      )
      setNoteOpen(false)
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    }
  }

  const marker =
    cell.note || cell.excludeFromScore ? (
      <span
        className="block truncate px-1 text-[0.65rem] text-amber-600 dark:text-amber-400"
        title={cell.note || "Ca đổi/nhờ người"}
      >
        {cell.excludeFromScore ? "⇄ đổi ca " : ""}
        {cell.note}
      </span>
    ) : null

  if (!editable) {
    return (
      <div className="flex flex-col items-center gap-0.5 px-1 py-0.5">
        <span className={cn("text-sm", !cell.staff && "text-muted-foreground")}>
          {cell.staff ? staffName(cell.staff) : "—"}
        </span>
        {marker}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-0.5">
        <Select
          items={CELL_OPTIONS}
          value={cell.staff ?? NONE}
          onValueChange={(v) => commitStaff(!v || v === NONE ? null : v)}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              "w-full min-w-[5rem] justify-center",
              !cell.staff && "text-muted-foreground"
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CELL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
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
                    : "text-muted-foreground"
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
              <Popover.Popup className="z-50 w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
                <p className="mb-1.5 text-xs font-medium">
                  Ghi chú {SHIFT_DEFS[shift].label} · {WEEKDAY_LABELS[dayIndex]}
                </p>
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={2}
                  placeholder="VD: Hà trực hộ 3h"
                  className="text-sm"
                />
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs">
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
  editable,
  onSet,
  onRemove,
}: {
  dayIndex: number
  hours: number
  editable: boolean
  onSet: (hours: number) => void
  onRemove: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const label = `${WEEKDAY_SHORT[dayIndex]} · ${hours}h`

  if (!editable) {
    return <Badge variant="secondary">{label}</Badge>
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            className="inline-flex items-center rounded-md border bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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

function AddOvertime({
  onAdd,
}: {
  onAdd: (dayIndex: number, hours: number) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [day, setDay] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!open) setDay(null)
  }, [open])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={<Button size="icon-sm" variant="outline" className="shrink-0" />}
      >
        <PlusIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50">
          <Popover.Popup className={cn(POPUP_CLASS, "w-52")}>
            {day === null ? (
              <>
                <p className="mb-1 text-xs font-medium">Chọn thứ</p>
                <div className="grid grid-cols-4 gap-1">
                  {WEEKDAY_SHORT.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDay(i)}
                      className="h-8 rounded-md border text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mb-1 text-xs font-medium">
                  {WEEKDAY_LABELS[day]} — số giờ
                </p>
                <HoursGrid
                  onPick={(h) => {
                    onAdd(day, h)
                    setOpen(false)
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 w-full"
                  onClick={() => setDay(null)}
                >
                  ← Chọn thứ khác
                </Button>
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
  async function setHours(staffKey: string, dayIndex: number, hours: number) {
    const next = week.overtime.filter(
      (e) => !(e.staffKey === staffKey && e.dayIndex === dayIndex)
    )
    if (hours > 0) {
      next.push({ id: `${staffKey}-${dayIndex}`, staffKey, dayIndex, hours, note: "" })
    }
    next.sort((a, b) =>
      a.staffKey === b.staffKey
        ? a.dayIndex - b.dayIndex
        : a.staffKey.localeCompare(b.staffKey)
    )
    const who = `${staffName(staffKey)} ${WEEKDAY_LABELS[dayIndex]}`
    try {
      await setOvertime(
        week,
        next,
        actor,
        hours > 0
          ? `Giờ làm thêm: ${who} — ${hours}h`
          : `Bỏ giờ làm thêm: ${who}`,
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
              <span className="w-12 shrink-0 text-sm font-medium">{s.name}</span>
              {mine.map((e) => (
                <OvertimeChip
                  key={e.dayIndex}
                  dayIndex={e.dayIndex}
                  hours={e.hours}
                  editable={editable}
                  onSet={(h) => setHours(s.key, e.dayIndex, h)}
                  onRemove={() => setHours(s.key, e.dayIndex, 0)}
                />
              ))}
              {mine.length === 0 && !editable ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : null}
              {editable ? (
                <AddOvertime onAdd={(day, h) => setHours(s.key, day, h)} />
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
