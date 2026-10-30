import type { NextConfig } from "next"

// Firebase Auth's sign-in helper pages, served from the app's own domain
// (see authDomain in lib/firebase.ts)
const firebaseAuthHost = `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "googleapis"],
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: `${firebaseAuthHost}/__/auth/:path*`,
      },
    ]
  },
}

export default nextConfig
