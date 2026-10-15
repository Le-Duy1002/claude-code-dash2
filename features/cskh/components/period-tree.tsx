"use client"

import * as React from "react"
import { ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { buildPeriodTree, type CskhPeriod } from "../types"

function flatten(
  nodes: CskhPeriod[],
  expanded: Set<string>,
  depth = 0
): { node: CskhPeriod; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(expanded.has(node.id) ? flatten(node.children, expanded, depth + 1) : []),
  ])
}

/**
 * Month → week → day rows over `dates`, months open by default. Shared by
 * the Thống kê chi tiết and Thống kê doanh thu tables.
 */
export function usePeriodTree(dates: string[]) {
  const tree = React.useMemo(() => buildPeriodTree(dates), [dates])
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(tree.map((m) => m.id))
  )
  React.useEffect(() => {
    setExpanded(new Set(tree.map((m) => m.id)))
  }, [tree])

  const allIds = React.useMemo(
    () => tree.flatMap((m) => [m.id, ...m.children.map((w) => w.id)]),
    [tree]
  )
  const toggle = React.useCallback(
    (id: string) =>
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    []
  )
  return {
    tree,
    rows: flatten(tree, expanded),
    expanded,
    toggle,
    expandAll: () => setExpanded(new Set(allIds)),
    collapseAll: () => setExpanded(new Set()),
  }
}

export function PeriodExpandButtons({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void
  onCollapseAll: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={onExpandAll}>
        Mở hết từng ngày
      </Button>
      <Button size="sm" variant="ghost" onClick={onCollapseAll}>
        Thu gọn theo tháng
      </Button>
    </div>
  )
}

/** The sticky "Thời gian" cell of a period row, with its expand chevron. */
export function PeriodLabelCell({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: CskhPeriod
  depth: number
  expanded: boolean
  onToggle: () => void
}) {
  const canExpand = node.children.length > 0
  return (
    <td
      className={cn(
        "sticky left-0 z-10 px-2 py-1.5 whitespace-nowrap",
        node.level === "month" ? "bg-muted" : "bg-card"
      )}
    >
      <button
        type="button"
        disabled={!canExpand}
        onClick={onToggle}
        className="flex items-center gap-1 text-left disabled:cursor-default"
        style={{ paddingLeft: depth * 16 }}
      >
        {canExpand ? (
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {node.label}
      </button>
    </td>
  )
}

export function periodRowClass(node: CskhPeriod): string {
  return cn(
    "border-b last:border-b-0 hover:bg-muted/40",
    node.level === "month" && "bg-muted/20 font-semibold",
    node.level === "week" && "font-medium"
  )
}
