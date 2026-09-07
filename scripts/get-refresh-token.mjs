// One-time helper: obtain a Google OAuth refresh token for Drive writes.
//   1. put GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in .env.local
//   2. node --env-file=.env.local scripts/get-refresh-token.mjs [ENV_VAR_NAME]
//   3. open the printed URL, sign in as the folder owner, allow access
//   4. paste the printed line into .env.local
//
// Pass an env-var name to label the output for a second Drive identity, e.g.
//   node --env-file=.env.local scripts/get-refresh-token.mjs GOOGLE_OAUTH_PROJECTS_REFRESH_TOKEN
import http from "node:http"
import { google } from "googleapis"

const OUT_VAR = process.argv[2] || "GOOGLE_OAUTH_REFRESH_TOKEN"
const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const PORT = 5555
const redirectUri = `http://localhost:${PORT}/callback`

if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local first."
  )
  process.exit(1)
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive.file"],
})

console.log("\n1. Open this URL and sign in as the Drive folder owner:\n")
console.log(authUrl)
console.log(`\n2. Waiting for the redirect on ${redirectUri} ...\n`)

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith("/callback")) {
    res.statusCode = 404
    res.end()
    return
  }
  const code = new URL(req.url, redirectUri).searchParams.get("code")
  if (!code) {
    res.end("Missing ?code")
    return
  }
  try {
    const { tokens } = await oauth2.getToken(code)
    res.end("Done — you can close this tab and go back to the terminal.")
    if (tokens.refresh_token) {
      console.log("\n--- copy into .env.local ---")
      console.log(`${OUT_VAR}=${tokens.refresh_token}`)
      console.log("----------------------------\n")
    } else {
      console.error(
        "No refresh_token returned. Revoke the app's access at " +
          "https://myaccount.google.com/permissions and run this again."
      )
    }
  } catch (error) {
    res.end("Token exchange failed: " + error.message)
    console.error(error)
  } finally {
    server.close()
  }
})

server.listen(PORT)
