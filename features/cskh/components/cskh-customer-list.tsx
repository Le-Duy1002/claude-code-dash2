"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { ExternalLinkIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

import { updateCskhCustomer } from "../services/cskh-service"
import {
  CSKH_STAFF,
  ISO_DATE,
  formatDm,
  formatMoney,
  outstanding,
  paidTotal,
  vnDateOf,
  type CskhCustomer,
  type CskhCustomerPatch,
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

function PaymentsEditor({
  customer,
  onSave,
}: {
  customer: CskhCustomer
  onSave: (patch: CskhCustomerPatch) => Promise<void>
}) {
  const [amount, setAmount] = React.useState("")
  const [date, setDate] = React.useState(() => vnDateOf(Date.now()))
  const [busy, setBusy] = React.useState(false)
  const total = paidTotal(customer)
  const due = outstanding(customer)

  async function add() {
    const value = parseMoney(amount)
    if (!value) return toast.error("Nhập số tiền khách trả")
    if (!ISO_DATE.test(date)) return toast.error("Chọn ngày trả")
    setBusy(true)
    try {
      await onSave({
        payments: [...customer.payments, { id: newId(), amount: value, date }],
      })
      setAmount("")
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
          <Popover.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
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
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {formatDm(p.date)}/{p.date.slice(0, 4)}
                      </span>
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
            <div className="flex items-end gap-1.5 border-t pt-2">
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
                Ngày trả
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-7 w-36"
                />
              </label>
              <Button size="sm" disabled={busy} onClick={add}>
                Thêm
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Closed customers relevant to the range (closed in it, paid in it, or still
 * owing): where giá bản luận and each payment (with its date) are entered.
 */
export function CskhCustomerList({
  customers,
  onChange,
}: {
  customers: CskhCustomer[]
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
    (c) => c.price == null && !c.tagRemoved
  ).length
  const noStaff = customers.filter((c) => !c.staffKey && !c.tagRemoved).length

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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Khách chốt & thanh toán
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Nhập giá bản luận và từng lần khách trả tiền (chọn ngày trả). Danh
          sách gồm khách chốt trong khoảng đã chọn, khách trả tiền trong khoảng
          và khách còn nợ.
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
              bảng, chọn nhân viên để tính.
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
            Chưa có khách chốt nào. Khách được gắn tag &quot;Chốt sale&quot; trên
            Pancake sẽ tự hiện ở đây sau khi đồng bộ.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-2 py-2 text-left font-medium">Ngày chốt</th>
                  <th className="px-2 py-2 text-left font-medium">Khách</th>
                  <th className="px-2 py-2 text-left font-medium">Nhân viên</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Giá bản luận
                  </th>
                  <th className="px-2 py-2 text-right font-medium">Đã trả</th>
                  <th className="px-2 py-2 text-right font-medium">Còn nợ</th>
                  <th className="px-2 py-2 text-left font-medium">Tag</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const due = outstanding(c)
                  const link = pancakeConvLink(c.pageId, c.id)
                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b last:border-b-0",
                        c.tagRemoved && "opacity-60"
                      )}
                    >
                      <td className="px-2 py-1">
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
                        <Select
                          items={STAFF_ITEMS}
                          value={c.staffKey ?? NO_STAFF}
                          onValueChange={(v) => {
                            const next = !v || v === NO_STAFF ? null : String(v)
                            if (next !== c.staffKey) {
                              void save(c, { staffKey: next }).catch(() => {})
                            }
                          }}
                        >
                          <SelectTrigger size="sm" className="w-28">
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
        )}
      </CardContent>
    </Card>
  )
}
