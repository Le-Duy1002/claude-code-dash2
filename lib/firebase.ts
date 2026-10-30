import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { type Analytics, getAnalytics, isSupported } from "firebase/analytics"

/**
 * Where Google sign-in runs its helper pages (`/__/auth/*`). On the deployed
 * site that is the site itself — next.config.ts proxies them to
 * firebaseapp.com — because mobile browsers partition storage by site and,
 * with the helper on another domain, lose the sign-in state ("Unable to
 * process request due to missing initial state"). Each such domain needs
 * `https://<domain>/__/auth/handler` as a redirect URI on the Google OAuth
 * client. Plain-http dev (localhost) keeps the firebaseapp.com helper.
 */
function authDomain(): string | undefined {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return window.location.host
  }
  return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
}

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: authDomain(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)

export const googleProvider = new GoogleAuthProvider()

/**
 * Analytics only works in the browser and only on supported environments,
 * so it is loaded lazily and never during SSR.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null
  if (!(await isSupported())) return null
  return getAnalytics(firebaseApp)
}
