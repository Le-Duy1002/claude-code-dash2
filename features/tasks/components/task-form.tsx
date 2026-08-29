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
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from "../types"

const EMPTY_VALUES: TaskInput = {
  title: "",
  name: "",
  startDate: "",
  endDate: "",
  status: "todo",
  priority: "medium",
}

/**
 * Shared task form for the add and update dialogs. It owns its field state and
 * validation; `onSubmit` performs the persistence and should reject on failure
 * so the form can surface the error and re-enable itself.
 */
export function TaskForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  defaultValues?: TaskInput
  submitLabel: string
  onSubmit: (values: TaskInput) => Promise<void>
}) {
  const [values, setValues] = React.useState<TaskInput>(
    defaultValues ?? EMPTY_VALUES
  )
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  function set<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const title = values.title.trim()
    const name = values.name.trim()
    if (!title) {
      setError("Vui lòng nhập tên công việc.")
      return
    }
    if (!name) {
      setError("Vui lòng nhập họ và tên.")
      return
    }
    if (!values.startDate || !values.endDate) {
      setError("Vui lòng chọn ngày bắt đầu và ngày kết thúc.")
      return
    }
    if (values.endDate < values.startDate) {
      setError("Ngày kết thúc phải sau ngày bắt đầu.")
      return
    }

    setError(null)
    setPending(true)
    try {
      await onSubmit({ ...values, title, name })
    } catch {
      setError("Đã có lỗi xảy ra. Vui lòng thử lại.")
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="task-title">Tên công việc</Label>
        <Input
          id="task-title"
          value={values.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="Thiết kế giao diện trang chủ"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="task-name">Họ và tên</Label>
        <Input
          id="task-name"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="Nguyễn Văn A"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="task-start">Ngày bắt đầu</Label>
          <Input
            id="task-start"
            type="date"
            value={values.startDate}
            onChange={(event) => set("startDate", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="task-end">Ngày kết thúc</Label>
          <Input
            id="task-end"
            type="date"
            value={values.endDate}
            onChange={(event) => set("endDate", event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="task-status">Trạng thái</Label>
          <Select
            items={TASK_STATUS_OPTIONS}
            value={values.status}
            onValueChange={(value) => set("status", value as TaskStatus)}
          >
            <SelectTrigger id="task-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TASK_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="task-priority">Mức độ ưu tiên</Label>
          <Select
            items={TASK_PRIORITY_OPTIONS}
            value={values.priority}
            onValueChange={(value) => set("priority", value as TaskPriority)}
          >
            <SelectTrigger id="task-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

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
