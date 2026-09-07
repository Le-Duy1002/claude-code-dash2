"use client"

import * as React from "react"
import {
  CheckIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UnlockIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
  cellOf,
  formatHours,
  registeredHours,
  staffName,
  weekDates,
  weekEndDate,
  weekLabel,
  type OvertimeEntry,
  type ScheduleWeek,
  type ShiftId,
} from "../types"

const NONE = "__none__"
const CELL_OPTIONS = [
  { value: NONE, label: "— trống —" },
  ...SCHEDULE_STAFF.map((s) => ({ value: s.key, label: s.name })),
]
const DAY_OPTIONS = WEEKDAY_LABELS.map((label, i) => ({
  value: String(i),
  label,
}))
const STAFF_OPTIONS = SCHEDULE_STAFF.map((s) => ({ value: s.key, label: s.name }))

function newOvertimeRow(): OvertimeEntry {
  return {
    id: Math.random().toString(36).slice(2, 10),
    staffKey: SCHEDULE_STAFF[0]?.key ?? "",
    dayIndex: 0,
    hours: 1,
    note: "",
  }
}

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

  async function commitCell(
    dayIndex: number,
    shift: ShiftId,
    staffKey: string | null
  ) {
    try {
      await setCell(week, dayIndex, shift, staffKey, actor, changeReason)
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    }
  }

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
                {dates.map((_, dayIndex) => {
                  const value = cellOf(week, dayIndex, shift)
                  return (
                    <td key={dayIndex} className="text-center align-middle">
                      {editable ? (
                        <Select
                          items={CELL_OPTIONS}
                          value={value ?? NONE}
                          onValueChange={(v) =>
                            commitCell(
                              dayIndex,
                              shift,
                              !v || v === NONE ? null : v
                            )
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className={cn(
                              "mx-auto w-full min-w-[5.5rem] justify-center",
                              !value && "text-muted-foreground"
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
                      ) : (
                        <span
                          className={cn(
                            "inline-block px-1",
                            !value && "text-muted-foreground"
                          )}
                        >
                          {value ? staffName(value) : "—"}
                        </span>
                      )}
                    </td>
                  )
                })}
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
  const [rows, setRows] = React.useState<OvertimeEntry[]>(week.overtime)
  const [busy, setBusy] = React.useState(false)
  // resync only when the stored week actually changes, not on every parent render
  React.useEffect(() => {
    setRows(week.overtime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.weekId, week.updatedAtMs])

  const dirty = JSON.stringify(rows) !== JSON.stringify(week.overtime)

  async function save() {
    setBusy(true)
    try {
      const clean = rows
        .map((r) => ({ ...r, hours: Number(r.hours) || 0 }))
        .filter((r) => r.staffKey && r.hours > 0)
      await setOvertime(
        week,
        clean,
        actor,
        `Cập nhật giờ làm thêm (${clean.length} dòng)`,
        clean.length === 1 ? clean[0].staffKey : null,
        reason
      )
      toast.success("Đã lưu giờ làm thêm")
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Giờ làm thêm (có cấu trúc)
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row, i) => (
            <li key={row.id} className="flex flex-wrap items-center gap-1">
              <Select
                items={STAFF_OPTIONS}
                value={row.staffKey}
                onValueChange={(v) =>
                  setRows((rs) =>
                    rs.map((r, j) => (j === i ? { ...r, staffKey: v ?? "" } : r))
                  )
                }
                disabled={!editable}
              >
                <SelectTrigger size="sm" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {STAFF_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                items={DAY_OPTIONS}
                value={String(row.dayIndex)}
                onValueChange={(v) =>
                  setRows((rs) =>
                    rs.map((r, j) =>
                      j === i ? { ...r, dayIndex: Number(v) } : r
                    )
                  )
                }
                disabled={!editable}
              >
                <SelectTrigger size="sm" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DAY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={row.hours}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((r, j) =>
                      j === i ? { ...r, hours: Number(e.target.value) } : r
                    )
                  )
                }
                disabled={!editable}
                className="h-7 w-16"
              />
              <span className="text-xs text-muted-foreground">giờ</span>
              <Input
                value={row.note}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((r, j) =>
                      j === i ? { ...r, note: e.target.value } : r
                    )
                  )
                }
                disabled={!editable}
                placeholder="ghi chú"
                className="h-7 flex-1 min-w-[6rem]"
              />
              {editable ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setRows((rs) => rs.filter((_, j) => j !== i))
                  }
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRows((rs) => [...rs, newOvertimeRow()])}
          >
            <PlusIcon data-icon="inline-start" />
            Thêm dòng
          </Button>
          {dirty ? (
            <Button size="sm" disabled={busy} onClick={save}>
              Lưu
            </Button>
          ) : null}
        </div>
      ) : null}
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
