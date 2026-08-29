"use client"

import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  type TaskPriority,
  type TaskStatus,
} from "../types"

export type TaskFilters = {
  search: string
  status: TaskStatus | "all"
  priority: TaskPriority | "all"
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  search: "",
  status: "all",
  priority: "all",
}

const STATUS_ITEMS = [
  { value: "all", label: "Tất cả trạng thái" },
  ...TASK_STATUS_OPTIONS,
]

const PRIORITY_ITEMS = [
  { value: "all", label: "Tất cả mức độ" },
  ...TASK_PRIORITY_OPTIONS,
]

export function TaskFilterBar({
  filters,
  onChange,
}: {
  filters: TaskFilters
  onChange: (filters: TaskFilters) => void
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative sm:max-w-xs sm:flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
          placeholder="Tìm theo tên công việc hoặc người làm..."
          className="pl-8"
        />
      </div>

      <Select
        items={STATUS_ITEMS}
        value={filters.status}
        onValueChange={(value) =>
          onChange({ ...filters, status: (value ?? "all") as TaskFilters["status"] })
        }
      >
        <SelectTrigger size="sm" className="sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {STATUS_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        items={PRIORITY_ITEMS}
        value={filters.priority}
        onValueChange={(value) =>
          onChange({
            ...filters,
            priority: (value ?? "all") as TaskFilters["priority"],
          })
        }
      >
        <SelectTrigger size="sm" className="sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PRIORITY_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
