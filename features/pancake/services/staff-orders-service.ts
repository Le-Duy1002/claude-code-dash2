import { auth } from "@/lib/firebase"

import type { RangeKey } from "../types"

/** Closed orders per staff member, as Pancake's own "Nhân viên" table counts them. */
export type StaffOrdersReport = {
  /** staff key -> page id -> closed orders */
  orders: Record<string, Record<string, number>>
  warnings: string[]
}

export async function fetchStaffOrders(
  params: {
    range: RangeKey
    from?: string | null
    to?: string | null
    hourFrom?: number
    hourTo?: number
  },
  signal?: AbortSignal
): Promise<StaffOrdersReport> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")

  const q = new URLSearchParams()
  q.set("range", params.range)
  if (params.from) q.set("from", params.from)
  if (params.to) q.set("to", params.to)
  if (params.hourFrom != null) q.set("hourFrom", String(params.hourFrom))
  if (params.hourTo != null) q.set("hourTo", String(params.hourTo))

  const response = await fetch(`/api/pancake/staff-orders?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
  return body as StaffOrdersReport
}
