"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  PROJECT_STAFF,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  type ProjectTaskInput,
  type TaskPriority,
  type TaskStatus,
} from "../types"

const EMPTY: ProjectTaskInput = {
  title: "",
  assigneeKey: "",
  status: "todo",
  priority: "medium",
  startDate: "",
  endDate: "",
}

const STAFF_ITEMS = PROJECT_STAFF.map((s) => ({ value: s.key, label: s.name }))

/** `projectEndDate` — cảnh báo (không chặn) khi hạn công việc trễ hơn hạn dự án. */
export function ProjectTaskForm({
  defaultValues,
  projectEndDate,
  submitLabel,
  onSubmit,
}: {
  defaultValues?: ProjectTaskInput
  projectEndDate?: string
  submitLabel: string
  onSubmit: (values: ProjectTaskInput) => Promise<void>
}) {
  const [values, setValues] = React.useState<ProjectTaskInput>(
    defaultValues ?? EMPTY
  )
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  function set<K extends keyof ProjectTaskInput>(
    key: K,
    value: ProjectTaskInput[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const lateVsProject =
    projectEndDate && values.endDate && values.endDate > projectEndDate

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const title = values.title.trim()
    if (!title) {
      setError("Vui lòng nhập tên công việc.")
      return
    }
    if (!values.assigneeKey) {
      setError("Vui lòng chọn người đảm nhiệm.")
      return
    }
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      setError("Ngày kết thúc phải sau ngày bắt đầu.")
      return
    }
    setError(null)
    setPending(true)
    try {
      await onSubmit({ ...values, title })
    } catch {
      setError("Đã có lỗi xảy ra. Vui lòng thử lại.")
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pt-title">Tên công việc</Label>
        <Input
          id="pt-title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Soạn kịch bản livestream"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pt-assignee">Người đảm nhiệm</Label>
        <Select
          items={STAFF_ITEMS}
          value={values.assigneeKey}
          onValueChange={(v) => set("assigneeKey", v ?? "")}
        >
          <SelectTrigger id="pt-assignee" className="w-full">
            <SelectValue placeholder="Chọn nhân viên" />
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pt-start">Ngày bắt đầu</Label>
          <Input
            id="pt-start"
            type="date"
            value={values.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pt-end">Ngày kết thúc</Label>
          <Input
            id="pt-end"
            type="date"
            value={values.endDate}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pt-status">Trạng thái</Label>
          <Select
            items={TASK_STATUS_OPTIONS}
            value={values.status}
            onValueChange={(v) => set("status", v as TaskStatus)}
          >
            <SelectTrigger id="pt-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TASK_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pt-priority">Mức độ ưu tiên</Label>
          <Select
            items={TASK_PRIORITY_OPTIONS}
            value={values.priority}
            onValueChange={(v) => set("priority", v as TaskPriority)}
          >
            <SelectTrigger id="pt-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TASK_PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {lateVsProject ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Hạn công việc trễ hơn hạn dự án.
        </p>
      ) : null}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DialogClose
          render={<Button type="button" variant="outline" />}
          disabled={pending}
        >
          Huỷ
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
