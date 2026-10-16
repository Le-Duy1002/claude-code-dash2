"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { createCskhDebtor } from "../services/cskh-service"
import {
  CSKH_STAFF,
  ISO_DATE,
  ISO_MONTH,
  PAYMENT_KIND_LABELS,
  defaultDebtMonth,
  formatDm,
  formatMoney,
  formatMonth,
  outstanding,
  paidTotal,
  suggestPaymentKind,
  vnDateOf,
  type CskhCustomer,
  type CskhCustomerPatch,
  type CskhPaymentKind,
} from "../types"

/**
 * Shared pieces for entering money on the Chăm sóc khách hàng tab: the
 * payments panel ("Thêm lần nhận tiền"), the staff picker, and the form that
 * adds an old customer's debt payment.
 */

export const NO_STAFF = "none"
export const STAFF_ITEMS = [
  ...CSKH_STAFF.map((s) => ({ value: s.key, label: s.name })),
  { value: NO_STAFF, label: "Chưa gán" },
]

/** "1.250.000" / "1250000" / "1 250 000" → 1250000; empty → null. */
export function parseMoney(text: string): number | null {
  const digits = text.replace(/\D/g, "")
  return digits ? Number(digits) : null
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function StaffSelect({
  value,
  onChange,
  className,
}: {
  value: string | null
  onChange: (next: string | null) => void
  className?: string
}) {
  return (
    <Select
      items={STAFF_ITEMS}
      value={value ?? NO_STAFF}
      onValueChange={(v) => onChange(!v || v === NO_STAFF ? null : String(v))}
    >
      <SelectTrigger size="sm" className={cn("w-28", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {STAFF_ITEMS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function KindToggle({
  value,
  onChange,
}: {
  value: CskhPaymentKind
  onChange: (next: CskhPaymentKind) => void
}) {
  return (
    <div className="flex rounded-md border p-0.5">
      {(Object.keys(PAYMENT_KIND_LABELS) as CskhPaymentKind[]).map((kind) => (
        <Button
          key={kind}
          type="button"
          size="sm"
          variant={value === kind ? "secondary" : "ghost"}
          className="h-6 flex-1 px-2 text-xs"
          onClick={() => onChange(kind)}
        >
          {PAYMENT_KIND_LABELS[kind]}
        </Button>
      ))}
    </div>
  )
}

/**
 * One customer's payments and the "Thêm lần nhận tiền" form: amount, the
 * day the money came in, and whether it was paid at the close or pays off a
 * debt (of which month) — what Thống kê doanh thu sums.
 */
export function PaymentsPanel({
  customer,
  onSave,
  showTitle = true,
}: {
  customer: CskhCustomer
  onSave: (patch: CskhCustomerPatch) => Promise<void>
  /** off when the surrounding dialog already titles it */
  showTitle?: boolean
}) {
  const today = vnDateOf(Date.now())
  const [amount, setAmount] = React.useState("")
  const [date, setDate] = React.useState(today)
  const [kind, setKind] = React.useState<CskhPaymentKind>(() =>
    suggestPaymentKind(customer, today)
  )
  const [kindTouched, setKindTouched] = React.useState(false)
  const [debtMonth, setDebtMonth] = React.useState(
    () => defaultDebtMonth(customer) ?? today.slice(0, 7)
  )
  const [busy, setBusy] = React.useState(false)
  const total = paidTotal(customer)
  const due = outstanding(customer)

  async function add() {
    const value = parseMoney(amount)
    if (!value) return toast.error("Nhập số tiền khách trả")
    if (!ISO_DATE.test(date)) return toast.error("Chọn ngày nhận tiền")
    if (kind === "no" && !ISO_MONTH.test(debtMonth)) {
      return toast.error("Chọn nợ của tháng nào")
    }
    setBusy(true)
    try {
      await onSave({
        payments: [
          ...customer.payments,
          {
            id: newId(),
            amount: value,
            date,
            kind,
            debtMonth: kind === "no" ? debtMonth : null,
          },
        ],
      })
      setAmount("")
      setKindTouched(false)
    } catch {
      /* the caller already toasted */
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await onSave({ payments: customer.payments.filter((p) => p.id !== id) })
    } catch {
      /* the caller already toasted */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col">
      {showTitle ? (
        <p className="text-sm font-medium">
          Thanh toán · {customer.customerName}
        </p>
      ) : null}
      <p className="mb-2 text-xs text-muted-foreground">
        Giá bản luận {formatMoney(customer.price)} · đã trả {formatMoney(total)}
        {due != null ? ` · còn nợ ${formatMoney(due)}` : ""}
      </p>
      {customer.payments.length ? (
        <div className="mb-3 flex flex-col gap-1 text-sm">
          {[...customer.payments]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-muted-foreground tabular-nums">
                  {formatDm(p.date)}/{p.date.slice(0, 4)}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    p.kind === "no" &&
                      "border-amber-500/40 text-amber-700 dark:text-amber-400"
                  )}
                >
                  {p.kind === "no"
                    ? `Trả nợ ${formatMonth(p.debtMonth)}`
                    : "Khách chốt trả"}
                </Badge>
                <span className="ml-auto tabular-nums">
                  {formatMoney(p.amount)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  onClick={() => remove(p.id)}
                  title="Xoá lần trả này"
                >
                  <XIcon />
                </Button>
              </div>
            ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 border-t pt-2">
        <KindToggle
          value={kind}
          onChange={(next) => {
            setKind(next)
            setKindTouched(true)
          }}
        />
        <div className="flex items-end gap-1.5">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Số tiền
            <Input
              inputMode="numeric"
              value={amount}
              placeholder={due ? formatMoney(due) : "0"}
              onChange={(e) => setAmount(e.target.value)}
              className="h-7 text-right tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Ngày nhận
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                if (!kindTouched && ISO_DATE.test(e.target.value)) {
                  setKind(suggestPaymentKind(customer, e.target.value))
                }
              }}
              className="h-7 w-36"
            />
          </label>
        </div>
        {kind === "no" ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Nợ của tháng
            <Input
              type="month"
              value={debtMonth}
              onChange={(e) => setDebtMonth(e.target.value)}
              className="h-7 w-40"
            />
          </label>
        ) : null}
        <Button size="sm" disabled={busy} onClick={add}>
          Thêm lần nhận tiền
        </Button>
      </div>
    </div>
  )
}

/** The "Đã trả" cell of a customer row: total paid, opens `PaymentsPanel`. */
export function PaymentsEditor({
  customer,
  onSave,
}: {
  customer: CskhCustomer
  onSave: (patch: CskhCustomerPatch) => Promise<void>
}) {
  const total = paidTotal(customer)
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 tabular-nums"
          />
        }
      >
        {total > 0 ? formatMoney(total) : <PlusIcon className="size-3.5" />}
        {customer.payments.length > 1 ? (
          <span className="text-muted-foreground">
            ({customer.payments.length} lần)
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="end" className="z-50">
          <Popover.Popup className="z-50 w-96 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <PaymentsPanel customer={customer} onSave={onSave} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * First debt payment of an old customer (closed before tracking, so not in
 * the app yet) — creates their record. Linked to the Pancake conversation
 * when one was found, so the same customer is never added twice.
 */
export function NewDebtForm({
  customerName: initialName,
  conversationId,
  staffKey: initialStaff,
  onCreated,
}: {
  customerName: string
  conversationId: string | null
  staffKey: string | null
  onCreated: (customer: CskhCustomer) => void
}) {
  const today = vnDateOf(Date.now())
  const [name, setName] = React.useState(initialName)
  const [staffKey, setStaffKey] = React.useState<string | null>(initialStaff)
  const [debtMonth, setDebtMonth] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [date, setDate] = React.useState(today)
  const [price, setPrice] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function submit() {
    const value = parseMoney(amount)
    if (!name.trim()) return toast.error("Nhập tên khách")
    if (!ISO_MONTH.test(debtMonth)) return toast.error("Chọn nợ của tháng nào")
    if (!value) return toast.error("Nhập số tiền khách trả")
    if (!ISO_DATE.test(date)) return toast.error("Chọn ngày nhận tiền")
    setBusy(true)
    try {
      const customer = await createCskhDebtor({
        customerName: name.trim(),
        conversation: conversationId,
        staffKey,
        debtMonth,
        price: parseMoney(price),
        amount: value,
        date,
      })
      toast.success("Đã thêm lần nhận tiền")
      onCreated(customer)
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Khách chốt trước khi app bắt đầu theo dõi — khoản này tính là{" "}
        <strong>trả nợ</strong>, vào doanh thu của ngày nhận tiền.
      </p>
      {conversationId ? null : (
        <label className="flex flex-col gap-1">
          Tên khách
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          Nhân viên
          <StaffSelect value={staffKey} onChange={setStaffKey} className="w-full" />
        </label>
        <label className="flex flex-col gap-1">
          Nợ của tháng
          <Input
            type="month"
            value={debtMonth}
            onChange={(e) => setDebtMonth(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Số tiền
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-right tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1">
          Ngày nhận
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          Giá bản luận{" "}
          <span className="text-xs text-muted-foreground">
            (không bắt buộc — có thì app tính được còn nợ)
          </span>
          <Input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="text-right tabular-nums"
          />
        </label>
      </div>
      <Button disabled={busy} onClick={submit}>
        {busy ? "Đang lưu…" : "Thêm lần nhận tiền"}
      </Button>
    </div>
  )
}
