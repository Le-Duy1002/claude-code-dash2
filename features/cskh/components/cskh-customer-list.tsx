"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { ExternalLinkIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { cn } from "@/lib/utils"
import { pancakeConvLink } from "@/features/pancake/types"

import { createCskhDebtor, updateCskhCustomer } from "../services/cskh-service"
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

const NO_STAFF = "none"
const STAFF_ITEMS = [
  ...CSKH_STAFF.map((s) => ({ value: s.key, label: s.name })),
  { value: NO_STAFF, label: "Chưa gán" },
]

/** "1.250.000" / "1250000" / "1 250 000" → 1250000; empty → null. */
function parseMoney(text: string): number | null {
  const digits = text.replace(/\D/g, "")
  return digits ? Number(digits) : null
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function StaffSelect({
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

function PriceInput({
  value,
  onCommit,
}: {
  value: number | null
  onCommit: (next: number | null) => void
}) {
  const [text, setText] = React.useState(value == null ? "" : formatMoney(value))
  React.useEffect(() => {
    setText(value == null ? "" : formatMoney(value))
  }, [value])
  const commit = () => {
    const next = parseMoney(text)
    if (next !== value) onCommit(next)
    else setText(value == null ? "" : formatMoney(value))
  }
  return (
    <Input
      inputMode="numeric"
      value={text}
      placeholder="Nhập giá"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
      className="h-7 w-28 text-right tabular-nums"
    />
  )
}

/**
 * Each payment of one customer, and a form to add one: amount, the day the
 * money came in, and whether it was paid at the close or pays off a debt (of
 * which month) — what Thống kê doanh thu sums.
 */
function PaymentsEditor({
  customer,
  onSave,
}: {
  customer: CskhCustomer
  onSave: (patch: CskhCustomerPatch) => Promise<void>
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
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await onSave({ payments: customer.payments.filter((p) => p.id !== id) })
    } finally {
      setBusy(false)
    }
  }

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
            <p className="text-sm font-medium">
              Thanh toán · {customer.customerName}
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Giá bản luận {formatMoney(customer.price)} · đã trả{" "}
              {formatMoney(total)}
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * "Thêm khách trả nợ": an old customer (closed before tracking started) pays
 * off a debt. Only counts as debt revenue, never as khách chốt.
 */
function AddDebtorDialog({ onAdd }: { onAdd: (c: CskhCustomer) => void }) {
  const today = vnDateOf(Date.now())
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [conversation, setConversation] = React.useState("")
  const [staffKey, setStaffKey] = React.useState<string | null>(null)
  const [debtMonth, setDebtMonth] = React.useState("")
  const [price, setPrice] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [date, setDate] = React.useState(today)
  const [busy, setBusy] = React.useState(false)

  function reset() {
    setName("")
    setConversation("")
    setStaffKey(null)
    setDebtMonth("")
    setPrice("")
    setAmount("")
    setDate(today)
  }

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
        conversation: conversation.trim() || null,
        staffKey,
        debtMonth,
        price: parseMoney(price),
        amount: value,
        date,
      })
      onAdd(customer)
      toast.success("Đã thêm khoản trả nợ")
      reset()
      setOpen(false)
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <PlusIcon data-icon="inline-start" />
        Thêm khách trả nợ
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm khách trả nợ</DialogTitle>
          <DialogDescription>
            Dành cho khách chốt trước khi app bắt đầu theo dõi. Khoản này tính
            vào doanh thu trả nợ của ngày nhận tiền, không tính là khách chốt
            mới.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Tên khách
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            Link hội thoại Pancake{" "}
            <span className="text-xs text-muted-foreground">
              (không bắt buộc — dán link để mở lại được hội thoại)
            </span>
            <Input
              value={conversation}
              placeholder="https://pancake.vn/…?c_id=…"
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
              Nợ của tháng
              <Input
                type="month"
                value={debtMonth}
                onChange={(e) => setDebtMonth(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              Số tiền trả
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The editable customer rows — ngày chốt, staff, giá bản luận, payments.
 * Used by the full list below and by the per-staff cell dialog of the
 * Thống kê chi tiết table.
 */
export function CskhCustomerTable({
  customers,
  onChange,
}: {
  customers: CskhCustomer[]
  /** a record was saved */
  onChange: (next: CskhCustomer) => void
}) {
  async function save(customer: CskhCustomer, patch: CskhCustomerPatch) {
    try {
      onChange(await updateCskhCustomer(customer.id, patch))
      toast.success("Đã lưu")
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
      throw error
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            <th className="px-2 py-2 text-left font-medium">Ngày chốt</th>
            <th className="px-2 py-2 text-left font-medium">Khách</th>
            <th className="px-2 py-2 text-left font-medium">Nhân viên</th>
            <th className="px-2 py-2 text-right font-medium">Giá bản luận</th>
            <th className="px-2 py-2 text-right font-medium">Đã trả</th>
            <th className="px-2 py-2 text-right font-medium">Còn nợ</th>
            <th className="px-2 py-2 text-left font-medium">Tag</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const due = outstanding(c)
            const link = pancakeConvLink(
              c.pageId,
              /^\d+_\d+$/.test(c.id) ? c.id : null
            )
            return (
              <tr
                key={c.id}
                className={cn(
                  "border-b last:border-b-0",
                  c.tagRemoved && "opacity-60"
                )}
              >
                <td className="px-2 py-1">
                  {c.legacy ? (
                    <span className="text-xs text-muted-foreground">
                      Khách cũ · nợ {formatMonth(c.debtMonth)}
                    </span>
                  ) : (
                    <Input
                      type="date"
                      value={c.closedDate}
                      onChange={(e) => {
                        const next = e.target.value
                        // typing a year digit by digit passes through
                        // "0002-…" etc. — only save a plausible date
                        if (
                          ISO_DATE.test(next) &&
                          next >= "2020-01-01" &&
                          next !== c.closedDate
                        ) {
                          void save(c, { closedDate: next }).catch(() => {})
                        }
                      }}
                      className="h-7 w-36"
                    />
                  )}
                </td>
                <td className="max-w-56 px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">
                      {c.customerName}
                    </span>
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        title="Mở hội thoại trên Pancake"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLinkIcon className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                  {c.tagRemoved ? (
                    <Badge variant="outline" className="mt-0.5">
                      đã gỡ tag Chốt sale
                    </Badge>
                  ) : null}
                </td>
                <td className="px-2 py-1">
                  <StaffSelect
                    value={c.staffKey}
                    onChange={(next) => {
                      if (next !== c.staffKey) {
                        void save(c, { staffKey: next }).catch(() => {})
                      }
                    }}
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <div className="flex justify-end">
                    <PriceInput
                      value={c.price}
                      onCommit={(price) =>
                        void save(c, { price }).catch(() => {})
                      }
                    />
                  </div>
                </td>
                <td className="px-2 py-1 text-right">
                  <PaymentsEditor
                    customer={c}
                    onSave={(patch) => save(c, patch)}
                  />
                </td>
                <td
                  className={cn(
                    "px-2 py-1 text-right tabular-nums",
                    due ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {formatMoney(due)}
                </td>
                <td className="max-w-64 truncate px-2 py-1 text-xs text-muted-foreground">
                  {c.tags.join(", ")}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Customers relevant to the range (closed in it, paid in it, or still owing):
 * where giá bản luận and each received payment (date, kind, debt month) are
 * entered — Thống kê doanh thu sums these.
 */
export function CskhCustomerList({
  customers,
  onChange,
}: {
  customers: CskhCustomer[]
  /** a record was saved or added */
  onChange: (next: CskhCustomer) => void
}) {
  const [staff, setStaff] = React.useState<string>("all")

  const visible = customers.filter((c) =>
    staff === "all"
      ? true
      : staff === NO_STAFF
        ? !c.staffKey
        : c.staffKey === staff
  )
  const missingPrice = customers.filter(
    (c) => c.price == null && !c.tagRemoved && !c.legacy
  ).length
  const noStaff = customers.filter((c) => !c.staffKey && !c.tagRemoved).length

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            Khách chốt & thanh toán
          </CardTitle>
          <AddDebtorDialog onAdd={onChange} />
        </div>
        <p className="text-xs text-muted-foreground">
          Nhập giá bản luận và từng lần nhận tiền: số tiền, ngày nhận, là khách
          chốt trả hay trả nợ (nợ của tháng nào). Thống kê doanh thu tự cộng từ
          đây. Danh sách gồm khách chốt trong khoảng đã chọn, khách trả tiền
          trong khoảng và khách còn nợ.
          {missingPrice > 0 ? (
            <span className="text-amber-600 dark:text-amber-400">
              {" "}
              {missingPrice} khách chưa nhập giá.
            </span>
          ) : null}
          {noStaff > 0 ? (
            <span className="text-amber-600 dark:text-amber-400">
              {" "}
              {noStaff} khách chưa có tag tên nhân viên — chưa được tính vào
              bảng chi tiết, chọn nhân viên để tính.
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[{ value: "all", label: "Tất cả" }, ...STAFF_ITEMS].map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={staff === o.value ? "default" : "outline"}
              onClick={() => setStaff(o.value)}
            >
              {o.label}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {visible.length} khách
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có khách nào. Khách được gắn tag &quot;Chốt sale&quot; trên
            Pancake sẽ tự hiện ở đây sau khi đồng bộ; khách cũ trả nợ thì bấm
            &quot;Thêm khách trả nợ&quot;.
          </p>
        ) : (
          <CskhCustomerTable customers={visible} onChange={onChange} />
        )}
      </CardContent>
    </Card>
  )
}
