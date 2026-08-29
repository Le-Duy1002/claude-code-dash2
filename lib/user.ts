import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import type { User } from "firebase/auth"

import { db } from "@/lib/firebase"

export type UserProfile = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  createdAt: unknown
  updatedAt: unknown
}

/**
 * Creates the user's Firestore profile document on first sign-in and
 * refreshes its mutable fields on subsequent sign-ins.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid)
  const snapshot = await getDoc(ref)

  const base = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    updatedAt: serverTimestamp(),
  }

  if (snapshot.exists()) {
    await setDoc(ref, base, { merge: true })
  } else {
    await setDoc(ref, { ...base, createdAt: serverTimestamp() })
  }
}
