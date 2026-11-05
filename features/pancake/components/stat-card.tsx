"use client"

import * as React from "react"
import { AlertTriangleIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function formatInt(n: number): string {
  return n.toLocaleString("vi-VN")
}

export function formatPct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`
}

export function StatCard({
  label,
  value,
  sub,
  estimated,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** some days in range have no Pancake figure yet — value includes a self-estimated part */
  estimated?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
        {estimated ? (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
          >
            <AlertTriangleIcon className="size-3" />
            Một phần ước tính
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}
