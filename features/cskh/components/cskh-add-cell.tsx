"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

import {
  addCskhViewExtra,
  createCskhManualClose,
  deleteCskhViewExtra,
} from "../services/cskh-service"
import {
  ISO_DATE,
  cskhStaffName,
  formatDm,
  vnDateOf,
  type CskhCustomer,
  type CskhPeriod,
  type CskhViewExtra,
} from "../types"
import { CskhCustomerSearch } from "./cskh-customer-search"
import { StaffSelect, parseMoney } from "./cskh-payments"

/**
 * The "+" of the Khách xem and Khách chốt cells of Thống kê chi tiết: what
 * Pancake can't see, entered by hand. A row can span many days, so the forms
 * start on its last day and let any of its days be picked.
 */

const ADD_BUTTON_CLASS =
  "inline-flex size-5 shrink-0 items-center justify-center rounded align-middle text-muted-foreground hover:bg-foreground/10 hover:text-foreground"

function lastDate(period: CskhPeriod): string {
  return period.dates[period.dates.length - 1]
}

function AddViewsForm({
  staffKey,
  period,
  minDate,
  viewExtras,
  onAdded,
  onRemoved,
}: {
  staffKey: string
  period: CskhPeriod
  minDate: string
  viewExtras: CskhViewExtra[]
  onAdded: (extra: CskhViewExtra) => void
  onRemoved: (id: string) => void
}) {
  const maxDate = lastDate(period)
  const [date, setDate] = React.useState(maxDate)
  const [count, setCount] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const entries = viewExtras
    .filter((e) => e.staffKey === staffKey && period.dates.includes(e.date))
    .sort((a, b) => a.date.localeCompare(b.date))

  async function add(event: React.FormEvent) {
    event.preventDefault()
    const value = parseMoney(count)
    if (!value) return toast.error("Nhập số khách")
    if (!ISO_DATE.test(date) || date < minDate || date > maxDate) {
      return toast.error("Chọn ngày trong khoảng này")
    }
    setBusy(true)
    try {
      onAdded(await addCskhViewExtra({ date, staffKey, count: value }))
      setCount("")
      toast.success(`Đã cộng thêm ${value} khách xem`)
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await deleteCskhViewExtra(id)
      onRemoved(id)
    } catch (error) {
      toast.error(`Không xoá được: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div>
        <p className="font-medium">
          Cộng thêm khách xem · {cskhStaffName(staffKey)}
        </p>
        <p className="text-xs text-muted-foreground">{period.label}</p>
      </div>
      <form onSubmit={add} className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Thêm
          <Input
            autoFocus
            inputMode="numeric"
            value={count}
            placeholder="0"
            onChange={(e) => setCount(e.target.value)}
            className="h-7 w-20 text-right tabular-nums"
          />
          khách
        </label>
        {period.dates.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Ngày
            <Input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              className="h-7 w-36"
            />
          </label>
        ) : null}
        <Button type="submit" size="sm" disabled={busy}>
          Cộng thêm
        </Button>
      </form>
      {entries.length ? (
        <div className="flex flex-col gap-1 border-t pt-2">
          <p className="text-xs text-muted-foreground">Đã nhập tay</p>
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground tabular-nums">
                {formatDm(e.date)}
              </span>
              <span className="font-medium tabular-nums">+{e.count}</span>
              <span className="truncate text-muted-foreground">
                {e.createdByName}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                disabled={busy}
                onClick={() => remove(e.id)}
                title="Xoá lần nhập này"
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** The "+" of a Khách xem cell. */
export function AddViewsPopover(props: {
  staffKey: string
  period: CskhPeriod
  /** the first day this row can take an entry */
  minDate: string
  viewExtras: CskhViewExtra[]
  onAdded: (extra: CskhViewExtra) => void
  onRemoved: (id: string) => void
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <button
            type="button"
            title="Cộng thêm khách xem"
            aria-label="Cộng thêm khách xem"
            className={ADD_BUTTON_CLASS}
          />
        }
      >
        <PlusIcon className="size-3" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="end" className="z-50">
          <Popover.Popup className="z-50 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <AddViewsForm {...props} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** The "+" of a Khách chốt cell. */
export function AddClosedButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Nhập khách chốt / khách trả nợ"
      aria-label="Nhập khách chốt hoặc khách trả nợ"
      onClick={onClick}
      className={ADD_BUTTON_CLASS}
    >
      <PlusIcon className="size-3" />
    </button>
  )
}

function NewClosedForm({
  staffKey: initialStaff,
  defaultDate,
  minDate,
  onCreated,
}: {
  staffKey: string
  defaultDate: string
  minDate: string
  onCreated: (customer: CskhCustomer) => void
}) {
  const [name, setName] = React.useState("")
  const [conversation, setConversation] = React.useState("")
  const [staffKey, setStaffKey] = React.useState<string | null>(initialStaff)
  const [closedDate, setClosedDate] = React.useState(defaultDate)
  const [price, setPrice] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return toast.error("Nhập tên khách")
    if (!staffKey) return toast.error("Chọn nhân viên")
    if (!ISO_DATE.test(closedDate) || closedDate < minDate) {
      return toast.error(`Ngày chốt phải từ ${formatDm(minDate)} trở đi`)
    }
    setBusy(true)
    try {
      onCreated(
        await createCskhManualClose({
          customerName: name.trim(),
          conversation: conversation.trim() || null,
          staffKey,
          closedDate,
          price: parseMoney(price),
          amount: parseMoney(amount),
        })
      )
      toast.success("Đã thêm khách chốt")
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Khách chốt ngoài Pancake, cộng thêm vào số &quot;Chốt sale&quot;. Khách
        có tag &quot;Chốt sale&quot; trên Pancake thì app tự thêm, không cần
        nhập ở đây.
      </p>
      <label className="flex flex-col gap-1">
        Tên khách
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        Link hội thoại Pancake{" "}
        <span className="text-xs text-muted-foreground">(không bắt buộc)</span>
        <Input
          value={conversation}
          onChange={(e) => setConversation(e.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          Nhân viên
          <StaffSelect
            value={staffKey}
            onChange={setStaffKey}
            className="w-full"
          />
        </label>
        <label className="flex flex-col gap-1">
          Ngày chốt
          <Input
            type="date"
            value={closedDate}
            min={minDate}
            max={vnDateOf(Date.now())}
            onChange={(e) => setClosedDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Giá bản luận
          <Input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="text-right tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1">
          Khách trả lúc chốt
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-right tabular-nums"
          />
        </label>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Đang lưu…" : "Thêm khách chốt"}
      </Button>
    </form>
  )
}

export type AddClosedTarget = { staffKey: string; period: CskhPeriod }

type AddClosedTab = "closed" | "debt"

function AddClosedBody({
  target,
  minDate,
  onCustomerChange,
  onDone,
}: {
  target: AddClosedTarget
  minDate: string
  onCustomerChange: (next: CskhCustomer) => void
  onDone: () => void
}) {
  const [tab, setTab] = React.useState<AddClosedTab>("closed")
  const date = lastDate(target.period)
  return (
    <>
      <div className="flex rounded-md border p-0.5">
        {(
          [
            ["closed", "Khách chốt"],
            ["debt", "Khách trả nợ"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={tab === key ? "secondary" : "ghost"}
            className="flex-1"
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "closed" ? (
        <NewClosedForm
          staffKey={target.staffKey}
          defaultDate={date}
          minDate={minDate}
          onCreated={(customer) => {
            onCustomerChange(customer)
            onDone()
          }}
        />
      ) : (
        <CskhCustomerSearch
          inline
          defaultStaffKey={target.staffKey}
          defaultDate={date}
          onChange={onCustomerChange}
        />
      )}
    </>
  )
}

/** Opened by the "+" of a Khách chốt cell: a new close, or a debt payment. */
export function AddClosedDialog({
  target,
  closedTrackedFrom,
  onClose,
  onCustomerChange,
}: {
  target: AddClosedTarget | null
  closedTrackedFrom: string | null
  onClose: () => void
  onCustomerChange: (next: CskhCustomer) => void
}) {
  return (
    <Dialog open={target != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        {target ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {cskhStaffName(target.staffKey)} · {target.period.label}
              </DialogTitle>
              <DialogDescription>
                Nhập khách chốt mới, hoặc tìm khách để ghi tiền trả nợ.
              </DialogDescription>
            </DialogHeader>
            <AddClosedBody
              key={`${target.staffKey}-${target.period.id}`}
              target={target}
              minDate={closedTrackedFrom ?? target.period.dates[0]}
              onCustomerChange={onCustomerChange}
              onDone={onClose}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
