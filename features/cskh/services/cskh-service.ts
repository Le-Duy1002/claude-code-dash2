import { auth } from "@/lib/firebase"
import type { RangeKey } from "@/features/pancake/types"

import type {
  CskhCustomer,
  CskhCustomerPatch,
  CskhReport,
  CskhSyncResult,
} from "../types"

/**
 * Client access for the "Chăm sóc khách hàng" tab. Everything goes through
 * `/api/cskh/*` (Admin SDK on the server), never Firestore directly.
 */

async function idToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")
  return token
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Lỗi ${response.status}`)
  }
  return body as T
}

export async function fetchCskhReport(
  params: { range: RangeKey; from?: string | null; to?: string | null },
  signal?: AbortSignal
): Promise<CskhReport> {
  const q = new URLSearchParams({ range: params.range })
  if (params.from) q.set("from", params.from)
  if (params.to) q.set("to", params.to)
  const response = await fetch(`/api/cskh/report?${q}`, {
    headers: { Authorization: `Bearer ${await idToken()}` },
    signal,
  })
  return readJson<CskhReport>(response)
}

/** Re-reads Pancake for conversations touched in the last `days` days. */
export async function syncCskh(days: number): Promise<CskhSyncResult> {
  const response = await fetch(`/api/cskh/sync?days=${days}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await idToken()}` },
  })
  return readJson<CskhSyncResult>(response)
}

export async function updateCskhCustomer(
  id: string,
  patch: CskhCustomerPatch
): Promise<CskhCustomer> {
  const response = await fetch(`/api/cskh/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${await idToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  })
  const body = await readJson<{ customer: CskhCustomer }>(response)
  return body.customer
}
