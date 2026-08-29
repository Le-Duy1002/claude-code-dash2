"use client"

import { useEffect } from "react"

import { getFirebaseAnalytics } from "@/lib/firebase"

/**
 * Initializes Firebase Analytics on the client after hydration.
 * Renders nothing.
 */
export function FirebaseAnalytics() {
  useEffect(() => {
    getFirebaseAnalytics().catch(() => {
      // Analytics is best-effort; ignore unsupported environments.
    })
  }, [])

  return null
}
