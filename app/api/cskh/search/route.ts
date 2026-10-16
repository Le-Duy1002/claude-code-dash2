import { NextResponse } from "next/server"

import { searchCskhCustomers } from "@/lib/cskh"
import { getRequestUser } from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

/** "Tìm khách" — by name, or a pasted Pancake conversation link / id. */
export async function GET(request: Request) {
  if (!(await getRequestUser(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const q = new URL(request.url).searchParams.get("q") ?? ""
  try {
    return NextResponse.json({ hits: await searchCskhCustomers(q) })
  } catch (error) {
    return NextResponse.json(
      { error: "search_failed", detail: (error as Error).message },
      { status: 502 }
    )
  }
}
