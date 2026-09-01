import "server-only"

import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

/**
 * Firebase Admin singletons for server code (API routes). Credentials come from
 * a service-account key downloaded from
 * Firebase console → Project settings → Service accounts → Generate new private key.
 * `FIREBASE_ADMIN_PRIVATE_KEY` keeps its `\n` escaped in the env var and is
 * un-escaped here.
 *
 * Initialization is lazy so importing this module never throws at build time —
 * the env vars only need to be present when a route actually runs.
 */
let app: App | undefined

function getAdminApp(): App {
  if (app) return app
  if (getApps().length) {
    app = getApps()[0]
    return app
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY"
    )
  }

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
  return app
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp())
}
