"use client"

import * as React from "react"
import { ArrowLeftIcon, Loader2Icon, PlusIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { searchCskh, updateCskhCustomer } from "../services/cskh-service"
import {
  cskhStaffName,
  formatDmy,
  formatMoney,
  formatMonth,
  outstanding,
  parseConversationRef,
  vnDateOf,
  type CskhCustomer,
  type CskhSearchHit,
} from "../types"
import { NewDebtForm, PaymentsPanel } from "./cskh-payments"

type Picked =
  | { kind: "record"; customer: CskhCustomer }
  | {
      kind: "new"
      customerName: string
      conversationId: string | null
      staffKey: string | null
    }

function HitRow({
  hit,
  onPick,
}: {
  hit: CskhSearchHit
  onPick: (picked: Picked) => void
}) {
  if (hit.kind === "record") {
    const c = hit.customer
    const due = outstanding(c)
    return (
      <button
        type="button"
        // keep the input focused so the list doesn't close before the click
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick({ kind: "record", customer: c })}
        className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
      >
        <span className="flex w-full items-center gap-2">
          <span className="truncate font-medium">{c.customerName}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {cskhStaffName(c.staffKey)}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {c.legacy
            ? `Khách cũ · nợ ${formatMonth(c.debtMonth)}`
            : `Chốt ${formatDmy(c.closedDate)}`}
          {" · "}
          {c.price == null ? (
            "chưa nhập giá"
          ) : due ? (
            <span className="text-destructive">còn nợ {formatMoney(due)}</span>
          ) : (
            "đã trả đủ"
          )}
        </span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() =>
        onPick({
          kind: "new",
          customerName: hit.customerName,
          conversationId: hit.conversationId,
          staffKey: hit.staffKey,
        })
      }
      className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
    >
      <span className="flex w-full items-center gap-2">
        <span className="truncate font-medium">{hit.customerName}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {hit.staffKey ? cskhStaffName(hit.staffKey) : "chưa có tag NV"}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">
        Trên Pancake, chưa có trong app
        {hit.updatedAtMs ? ` · hoạt động ${formatDmy(vnDateOf(hit.updatedAtMs))}` : ""}
        {hit.tags.length ? ` · ${hit.tags.join(", ")}` : ""}
      </span>
    </button>
  )
}

/**
 * "Tìm khách": type a name or paste a Pancake conversation link, pick the
 * right person from the list (names repeat), and land straight on "Thêm lần
 * nhận tiền" for them. A customer not in the app yet (closed before tracking)
 * gets the old-customer debt form instead. `inline` keeps all of it in place,
 * for use inside a dialog.
 */
export function CskhCustomerSearch({
  onChange,
  inline = false,
  defaultStaffKey = null,
  defaultDate,
}: {
  /** a record was saved or created */
  onChange: (next: CskhCustomer) => void
  inline?: boolean
  /** staff of a new old-customer record whose conversation has no name tag */
  defaultStaffKey?: string | null
  /** the day "Ngày nhận" starts on, today if unset */
  defaultDate?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [query, setQuery] = React.useState("")
  const [hits, setHits] = React.useState<CskhSearchHit[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [listOpen, setListOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<Picked | null>(null)

  const text = query.trim()
  const isLink = Boolean(parseConversationRef(text))
  const searchable = isLink || text.length >= 2

  React.useEffect(() => {
    if (!searchable) {
      setHits(null)
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      searchCskh(text, ctrl.signal)
        .then(setHits)
        .catch((error) => {
          if ((error as Error).name !== "AbortError") {
            toast.error(`Không tìm được: ${(error as Error).message}`)
          }
        })
        .finally(() => setLoading(false))
    }, 350)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [text, searchable])

  function pick(next: Picked) {
    setPicked(
      next.kind === "new"
        ? { ...next, staffKey: next.staffKey ?? defaultStaffKey }
        : next
    )
    setListOpen(false)
  }

  function backToSearch() {
    setPicked(null)
    setListOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function saveRecord(customer: CskhCustomer, patch: Parameters<typeof updateCskhCustomer>[1]) {
    try {
      const next = await updateCskhCustomer(customer.id, patch)
      setPicked({ kind: "record", customer: next })
      onChange(next)
      toast.success("Đã lưu")
    } catch (error) {
      toast.error(`Không lưu được: ${(error as Error).message}`)
      throw error
    }
  }

  const title =
    picked?.kind === "record"
      ? `Thanh toán · ${picked.customer.customerName}`
      : picked
        ? `Khách cũ trả nợ${picked.customerName ? ` · ${picked.customerName}` : ""}`
        : ""

  const pickedForm =
    picked?.kind === "record" ? (
      <PaymentsPanel
        key={picked.customer.id}
        customer={picked.customer}
        showTitle={false}
        defaultDate={defaultDate}
        onSave={(patch) => saveRecord(picked.customer, patch)}
      />
    ) : picked ? (
      <NewDebtForm
        key={picked.conversationId ?? picked.customerName}
        customerName={picked.customerName}
        conversationId={picked.conversationId}
        staffKey={picked.staffKey}
        defaultDate={defaultDate}
        onCreated={(customer) => {
          setPicked({ kind: "record", customer })
          onChange(customer)
        }}
      />
    ) : null
  const backButton = (
    <Button
      variant="ghost"
      size="sm"
      className="self-start"
      onClick={backToSearch}
    >
      <ArrowLeftIcon data-icon="inline-start" />
      Tìm khách khác
    </Button>
  )

  if (inline && picked) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{title}</p>
        {pickedForm}
        {backButton}
      </div>
    )
  }

  return (
    <div className={cn("relative w-full", !inline && "sm:w-96")}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setListOpen(true)
          }}
          onFocus={() => setListOpen(true)}
          onBlur={() => setListOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setListOpen(false)
          }}
          placeholder="Tìm tên khách hoặc dán link hội thoại Pancake…"
          className="pl-8"
        />
        {loading ? (
          <Loader2Icon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {(inline || listOpen) && searchable ? (
        <div
          className={cn(
            "overflow-y-auto rounded-lg border p-1",
            inline
              ? "mt-2 max-h-72"
              : "absolute top-full right-0 z-50 mt-1 max-h-96 w-full bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 sm:w-[28rem]"
          )}
        >
          {hits == null ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Đang tìm…</p>
          ) : hits.length === 0 ? (
            <div className="flex flex-col gap-2 px-2 py-3 text-sm">
              <span className="text-muted-foreground">
                Không tìm thấy {isLink ? "hội thoại này" : `“${text}”`}.
              </span>
              {isLink ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    pick({
                      kind: "new",
                      customerName: text,
                      conversationId: null,
                      staffKey: null,
                    })
                  }
                >
                  <PlusIcon data-icon="inline-start" />
                  Thêm khách cũ tên “{text}” (không có link)
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
                Bấm đúng người để nhập lần nhận tiền
              </p>
              {hits.map((hit) => (
                <HitRow
                  key={
                    hit.kind === "record" ? hit.customer.id : hit.conversationId
                  }
                  hit={hit}
                  onPick={pick}
                />
              ))}
            </>
          )}
        </div>
      ) : null}

      {inline ? null : (
        <Dialog
          open={picked != null}
          onOpenChange={(open) => !open && setPicked(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={cn("pr-6")}>{title}</DialogTitle>
            </DialogHeader>
            {pickedForm}
            {backButton}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
