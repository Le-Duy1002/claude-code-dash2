"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadCloudIcon,
  HammerIcon,
  LockIcon,
  UnlockIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/components/auth-provider"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

import { syncPancakeRange } from "@/features/pancake/services/work-tracking-service"

import {
  buildPeriod,
  setLock,
  subscribeToPeriod,
} from "../services/payroll-service"
import {
  MONTH_LABELS,
  PAYROLL_STATUS_LABELS,
  formatDateTime,
  isOngoingMonth,
  periodId,
  type PayrollPeriod,
} from "../types"
import { PayrollTable } from "./payroll-table"
import { PayslipDialog } from "./payslip-dialog"

function shiftMonth(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

export function PayrollView() {
  const { user } = useAuth()

  const nowVn = React.useMemo(
    () => new Date(Date.now() + 7 * 60 * 60 * 1000),
    []
  )
  const [year, setYear] = React.useState(nowVn.getUTCFullYear())
  const [month, setMonth] = React.useState(nowVn.getUTCMonth() + 1)
  const id = periodId(year, month)
  const ongoing = isOngoingMonth(year, month)

  const [period, setPeriod] = React.useState<PayrollPeriod | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [denied, setDenied] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [syncing, setSyncing] = React.useState<string | null>(null)

  const [openStaff, setOpenStaff] = React.useState<string | null>(null)
  const [slipOpen, setSlipOpen] = React.useState(false)
  const [lockOpen, setLockOpen] = React.useState(false)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const [unlockReason, setUnlockReason] = React.useState("")

  React.useEffect(() => {
    if (!user) return
    setLoading(true)
    setDenied(false)
    setPeriod(null)
    const unsub = subscribeToPeriod(
      id,
      (next) => {
        setPeriod(next)
        setLoading(false)
      },
      (error) => {
        setLoading(false)
        if (error.message.toLowerCase().includes("permission")) setDenied(true)
        else toast.error(error.message)
      }
    )
    return unsub
  }, [user, id])

  async function run(fn: () => Promise<unknown>, okMessage: string) {
    setBusy(true)
    try {
      await fn()
      toast.success(okMessage)
    } catch (e) {
      const msg = (e as Error).message
      if (msg.toLowerCase().includes("forbidden")) setDenied(true)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  /** Sync Pancake for the whole period, then (re)build the payroll draft. */
  async function syncAndBuild() {
    const pad = (n: number) => String(n).padStart(2, "0")
    const fromISO = `${year}-${pad(month)}-01`
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const todayISO = new Date(Date.now() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const monthEndISO = `${year}-${pad(month)}-${pad(lastDay)}`
    const toISO = monthEndISO < todayISO ? monthEndISO : todayISO

    setSyncing("Đang đồng bộ Pancake…")
    setBusy(true)
    try {
      const result = await syncPancakeRange(fromISO, toISO, {
        onProgress: (done, total) =>
          setSyncing(`Đồng bộ Pancake ${done}/${total} ngày…`),
      })
      setSyncing("Đang dựng bảng lương…")
      await buildPeriod(id)
      if (result.incomplete.length > 0) {
        toast.warning(
          `Đã dựng bảng lương, nhưng ${result.incomplete.length} ngày trong kỳ còn dữ liệu Pancake chưa lấy hết (giai đoạn quá xa/quá nhiều hội thoại) — bấm "Dựng bảng lương" lại để lấy tiếp và cập nhật số liệu.`
        )
      } else {
        toast.success("Đã đồng bộ và dựng bảng lương")
      }
    } catch (e) {
      const msg = (e as Error).message
      if (msg.toLowerCase().includes("forbidden")) setDenied(true)
      toast.error(`Lỗi: ${msg}`)
    } finally {
      setSyncing(null)
      setBusy(false)
    }
  }

  const yearOptions = React.useMemo(() => {
    const base = nowVn.getUTCFullYear()
    return [...new Set([base - 1, base, base + 1, year])]
      .sort((a, b) => a - b)
      .map((y) => ({ value: String(y), label: String(y) }))
  }, [nowVn, year])

  const locked = period?.status === "locked"

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Bảng lương</h1>
          <p className="text-sm text-muted-foreground">
            Dựng từ Lịch làm việc và Thống kê công việc của kỳ. Nhập tay doanh
            thu demo và số lần nộp báo cáo trễ; duyệt thưởng cố định. Bấm{" "}
            <strong>Chốt lương</strong> khi đã rà xong.
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
            items={MONTH_LABELS.map((l, i) => ({ value: String(i + 1), label: l }))}
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
        </div>
      </div>

      {denied ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Chỉ tài khoản quản lý mới xem và chỉnh được bảng lương.
          </span>
        </div>
      ) : loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {period ? (
              <Badge variant={locked ? "default" : "outline"}>
                {PAYROLL_STATUS_LABELS[period.status]}
              </Badge>
            ) : (
              <Badge variant="outline">Chưa dựng</Badge>
            )}
            {period?.partial ? (
              <Badge
                variant="outline"
                className="text-amber-600 dark:text-amber-500"
              >
                dựng thử
              </Badge>
            ) : null}
            {period ? (
              <span className="text-xs text-muted-foreground">
                Dựng {formatDateTime(period.builtAtMs)} · {period.builtByName}
                {locked && period.lockedAtMs
                  ? ` — chốt ${formatDateTime(period.lockedAtMs)} · ${period.lockedByName}`
                  : ""}
              </span>
            ) : null}

            <span className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || locked}
                onClick={syncAndBuild}
              >
                <DownloadCloudIcon data-icon="inline-start" />
                {syncing ?? "Đồng bộ Pancake cả kỳ + dựng"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || locked}
                onClick={() =>
                  run(
                    () => buildPeriod(id),
                    ongoing ? "Đã dựng thử bảng lương" : "Đã dựng bảng lương"
                  )
                }
              >
                <HammerIcon data-icon="inline-start" />
                {period
                  ? "Dựng lại (không đồng bộ)"
                  : ongoing
                    ? "Dựng thử"
                    : "Dựng bảng lương"}
              </Button>
              {period && !locked ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setLockOpen(true)}
                >
                  <LockIcon data-icon="inline-start" />
                  Chốt lương
                </Button>
              ) : null}
              {period && locked ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setUnlockReason("")
                    setUnlockOpen(true)
                  }}
                >
                  <UnlockIcon data-icon="inline-start" />
                  Bỏ chốt
                </Button>
              ) : null}
            </span>
          </div>

          {period?.warnings?.length ? (
            <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
              {period.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          ) : null}

          {period ? (
            <PayrollTable
              period={period}
              onOpen={(staffKey) => {
                setOpenStaff(staffKey)
                setSlipOpen(true)
              }}
            />
          ) : (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Chưa có bảng lương cho kỳ này. Bấm{" "}
              <strong>{ongoing ? "Dựng thử" : "Dựng bảng lương"}</strong> để tạo.
            </p>
          )}

          {locked ? (
            <p className="text-xs text-muted-foreground">
              Bảng đã chốt — mở phiếu lương từng người và nhập lý do để điều
              chỉnh, hoặc bấm “Bỏ chốt”.
            </p>
          ) : null}
        </>
      )}

      {period ? (
        <PayslipDialog
          period={period}
          staffKey={openStaff}
          open={slipOpen}
          onOpenChange={setSlipOpen}
        />
      ) : null}

      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Chốt bảng lương {month}/{year}?
            </DialogTitle>
            <DialogDescription>
              Sau khi chốt, số liệu thành chỉ-đọc. Muốn sửa phải mở phiếu từng
              người và nhập lý do điều chỉnh.
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
                  await setLock(id, true)
                  setLockOpen(false)
                }, "Đã chốt bảng lương")
              }
            >
              Chốt lương
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bỏ chốt bảng lương</DialogTitle>
            <DialogDescription>
              Nhập lý do — sẽ ghi vào lịch sử điều chỉnh.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
            placeholder="VD: bổ sung doanh thu demo của Hà bị vào sổ muộn"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUnlockOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={busy || !unlockReason.trim()}
              onClick={() =>
                run(async () => {
                  await setLock(id, false, unlockReason)
                  setUnlockOpen(false)
                }, "Đã bỏ chốt")
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
