"use client"

import * as React from "react"
import { AlertTriangleIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import {
  PAYROLL_STAFF,
  computeRow,
  formatHours,
  formatPct,
  formatVnd,
  type PayrollPeriod,
} from "../types"

export function PayrollTable({
  period,
  onOpen,
}: {
  period: PayrollPeriod
  onOpen: (staffKey: string) => void
}) {
  const rows = PAYROLL_STAFF.map((s) => {
    const input = period.rows[s.key]
    return { staff: s, input, computed: input && computeRow(input, period.paramsUsed) }
  })

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[880px]">
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Nhân viên</TableHead>
            <TableHead className="text-right">Giờ thực tế</TableHead>
            <TableHead className="text-right">Lương giờ</TableHead>
            <TableHead className="text-right">Thưởng</TableHead>
            <TableHead className="text-right">% trừ</TableHead>
            <TableHead className="text-right">Hệ số</TableHead>
            <TableHead className="text-right">Tiền phạt</TableHead>
            <TableHead className="text-right">Thực lĩnh</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ staff, input, computed }) => {
            if (!input || !computed) {
              return (
                <TableRow key={staff.key}>
                  <TableCell className="font-medium">{staff.name}</TableCell>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Chưa có dữ liệu — bấm “Dựng bảng lương”.
                  </TableCell>
                </TableRow>
              )
            }
            const bonus = computed.demoBonus + computed.fixedBonus
            return (
              <TableRow
                key={staff.key}
                onClick={() => onOpen(staff.key)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {staff.name}
                    {computed.pending.length > 0 ? (
                      <Badge
                        variant="outline"
                        className="gap-1 text-amber-600 dark:text-amber-500"
                      >
                        <AlertTriangleIcon className="size-3" />
                        chờ
                      </Badge>
                    ) : null}
                    {input.ratingIsExcellent && !input.fixedBonusApproved ? (
                      <Badge
                        variant="outline"
                        className="text-emerald-600 dark:text-emerald-400"
                      >
                        gợi ý thưởng CĐ
                      </Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {input.hasSchedule ? formatHours(input.paidHours) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatVnd(computed.hourPay)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {bonus > 0 ? formatVnd(bonus) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    computed.totalDeductPct > 0 && "text-destructive"
                  )}
                >
                  {formatPct(computed.totalDeductPct)}
                  {computed.totalDeductPctRaw > computed.totalDeductPct ? " *" : ""}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPct(computed.coefficientPct)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    computed.penalty.total > 0 && "text-destructive"
                  )}
                >
                  {computed.penalty.total > 0
                    ? formatVnd(computed.penalty.total)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatVnd(computed.netPay)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
