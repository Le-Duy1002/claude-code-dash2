import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore"

import { auth, db } from "@/lib/firebase"

import {
  PAYROLL_DEFAULT_PARAMS,
  emptyRowInput,
  type PayrollManualPatch,
  type PayrollPeriod,
  type PayrollRowInput,
} from "../types"

async function idToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Chưa đăng nhập")
  return token
}

function mapPeriod(id: string, data: Record<string, unknown>): PayrollPeriod {
  const rawRows = (data.rows ?? {}) as Record<string, Partial<PayrollRowInput>>
  const rows: Record<string, PayrollRowInput> = {}
  for (const [key, value] of Object.entries(rawRows)) {
    rows[key] = { ...emptyRowInput(), ...value }
  }
  return {
    periodId: id,
    year: Number(data.year) || 0,
    month: Number(data.month) || 0,
    status: data.status === "locked" ? "locked" : "draft",
    partial: Boolean(data.partial),
    builtAtMs: Number(data.builtAtMs) || 0,
    builtByName: (data.builtByName as string) || "—",
    lockedAtMs: (data.lockedAtMs as number) ?? null,
    lockedByName: (data.lockedByName as string) ?? null,
    paramsUsed: {
      ...PAYROLL_DEFAULT_PARAMS,
      ...((data.paramsUsed as object) ?? {}),
    },
    rows,
    updatedAtMs: Number(data.updatedAtMs) || 0,
    warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
  }
}

export function subscribeToPeriod(
  periodId: string,
  onData: (period: PayrollPeriod | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "payrollPeriods", periodId),
    (snap) => onData(snap.exists() ? mapPeriod(snap.id, snap.data()) : null),
    (error) => onError?.(error)
  )
}

async function call(
  path: string,
  init: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${await idToken()}`,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      (body as { error?: string }).error || `Lỗi ${response.status}`
    )
  }
  return body as Record<string, unknown>
}

export function buildPeriod(periodId: string): Promise<Record<string, unknown>> {
  return call(`/api/payroll/${periodId}/build`, { method: "POST" })
}

export function saveManual(
  periodId: string,
  staffKey: string,
  patch: PayrollManualPatch,
  reason?: string
): Promise<Record<string, unknown>> {
  return call(`/api/payroll/${periodId}/manual`, {
    method: "PATCH",
    body: JSON.stringify({ staffKey, patch, reason }),
  })
}

export function setLock(
  periodId: string,
  locked: boolean,
  reason?: string
): Promise<Record<string, unknown>> {
  return call(`/api/payroll/${periodId}/lock`, {
    method: "POST",
    body: JSON.stringify({ locked, reason }),
  })
}
