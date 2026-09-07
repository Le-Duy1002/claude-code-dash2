"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { PROJECT_STAFF, type ProjectInput } from "../types"

const EMPTY: ProjectInput = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  ownerKeys: [],
}

export function ProjectForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  defaultValues?: ProjectInput
  submitLabel: string
  onSubmit: (values: ProjectInput) => Promise<void>
}) {
  const [values, setValues] = React.useState<ProjectInput>(
    defaultValues ?? EMPTY
  )
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  function toggleOwner(key: string) {
    setValues((v) => ({
      ...v,
      ownerKeys: v.ownerKeys.includes(key)
        ? v.ownerKeys.filter((k) => k !== key)
        : [...v.ownerKeys, key],
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = values.name.trim()
    if (!name) {
      setError("Vui lòng nhập tên dự án.")
      return
    }
    if (values.ownerKeys.length === 0) {
      setError("Vui lòng chọn ít nhất một người phụ trách.")
      return
    }
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      setError("Ngày kết thúc phải sau ngày bắt đầu.")
      return
    }
    setError(null)
    setPending(true)
    try {
      await onSubmit({ ...values, name, description: values.description.trim() })
    } catch {
      setError("Đã có lỗi xảy ra. Vui lòng thử lại.")
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-name">Tên dự án</Label>
        <Input
          id="project-name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="Chiến dịch Tết 2027"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="project-desc">Mô tả</Label>
        <Textarea
          id="project-desc"
          rows={2}
          value={values.description}
          onChange={(e) =>
            setValues((v) => ({ ...v, description: e.target.value }))
          }
          placeholder="Mục tiêu, phạm vi dự án…"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-start">Ngày bắt đầu</Label>
          <Input
            id="project-start"
            type="date"
            value={values.startDate}
            onChange={(e) =>
              setValues((v) => ({ ...v, startDate: e.target.value }))
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-end">Ngày kết thúc</Label>
          <Input
            id="project-end"
            type="date"
            value={values.endDate}
            onChange={(e) =>
              setValues((v) => ({ ...v, endDate: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Người phụ trách</Label>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_STAFF.map((s) => {
            const on = values.ownerKeys.includes(s.key)
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleOwner(s.key)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-sm transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {s.name}
              </button>
            )
          })}
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
