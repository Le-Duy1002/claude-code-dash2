import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"

import {
  mapPresence,
  type PresenceFocus,
  type SchedulePresence,
} from "../types"

/**
 * `schedulePresence/{tabId}` — one doc per open Lịch làm tab: who, which
 * month, what they have open, last heartbeat. Ephemeral: a tab deletes its
 * doc when it closes, and a doc whose heartbeat stopped (tab killed) is
 * ignored by readers and eventually deleted by whoever sees it.
 */
const PRESENCE = "schedulePresence"

/** Every open tab's presence (the collection stays tiny). */
export function subscribeToPresence(
  onData: (rows: SchedulePresence[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, PRESENCE),
    (snap) =>
      onData(
        snap.docs.map((d) => ({
          // "estimate": this tab's own pending heartbeat isn't read as 0
          ...mapPresence(d.id, d.data({ serverTimestamps: "estimate" })),
          pending: d.metadata.hasPendingWrites,
        }))
      ),
    (error) => onError?.(error)
  )
}

/** Write this tab's presence (also the heartbeat). */
export async function publishPresence(
  tabId: string,
  data: { uid: string; name: string; month: string; focus: PresenceFocus | null }
): Promise<void> {
  await setDoc(doc(db, PRESENCE, tabId), {
    ...data,
    seenAt: serverTimestamp(),
  })
}

/** Remove a tab's presence — this tab closing, or a dead tab's leftover. */
export async function clearPresence(tabId: string): Promise<void> {
  await deleteDoc(doc(db, PRESENCE, tabId))
}
