"use client"

import * as React from "react"
import { ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { pancakeConvLink } from "@/features/pancake/types"

import { updateCskhCustomer } from "../services/cskh-service"
import {
  ISO_DATE,
  formatMoney,
  formatMonth,
  outstanding,
  type CskhCustomer,
  type CskhCustomerPatch,
} from "../types"
import { CskhCustomerSearch } from "./cskh-customer-search"
import {
  NO_STAFF,
  PaymentsEditor,
  STAFF_ITEMS,
  StaffSelect,
  parseMoney,
} from "./cskh-payments"

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
 * entered — Thống kê doanh thu sums these. "Tìm khách" in the header reaches
 * any customer, in range or not, and old customers on Pancake.
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
          <CskhCustomerSearch onChange={onChange} />
        </div>
        <p className="text-xs text-muted-foreground">
          Nhập giá bản luận và từng lần nhận tiền: số tiền, ngày nhận, là khách
          chốt trả hay trả nợ (nợ của tháng nào). Thống kê doanh thu tự cộng từ
          đây. Khách trả tiền mà không có trong danh sách (vd. khách cũ trả nợ)
          thì tìm tên hoặc dán link hội thoại Pancake ở ô tìm kiếm.
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
            Pancake sẽ tự hiện ở đây sau khi đồng bộ; khách cũ trả nợ thì tìm
            tên ở ô tìm kiếm.
          </p>
        ) : (
          <CskhCustomerTable customers={visible} onChange={onChange} />
        )}
      </CardContent>
    </Card>
  )
}
