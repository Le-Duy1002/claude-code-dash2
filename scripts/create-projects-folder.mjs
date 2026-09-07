// Creates (or finds) the parent "Dự án" folder that holds one subfolder per
// project. It must be OWNED BY THE OAUTH ACCOUNT used for project writes
// (GOOGLE_OAUTH_PROJECTS_*), because the drive.file scope only lets the app
// write into folders it created — a folder made by hand in the Drive UI is
// invisible to it (404).
//
//   node --env-file=.env.local scripts/create-projects-folder.mjs ["Dự án"]
//
// After running: put the printed GOOGLE_DRIVE_PROJECTS_FOLDER_ID in .env.local,
// share the folder with the service account (FIREBASE_ADMIN_CLIENT_EMAIL,
// Viewer), and (optionally) move it wherever you want in the Drive UI — the
// app keeps write access after a move.
import { google } from "googleapis"

const FOLDER_NAME = process.argv[2] ?? "Dự án"

const clientId =
  process.env.GOOGLE_OAUTH_PROJECTS_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret =
  process.env.GOOGLE_OAUTH_PROJECTS_CLIENT_SECRET ??
  process.env.GOOGLE_OAUTH_CLIENT_SECRET
const refreshToken =
  process.env.GOOGLE_OAUTH_PROJECTS_REFRESH_TOKEN ??
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN

if (!clientId || !clientSecret || !refreshToken) {
  console.error(
    "Missing GOOGLE_OAUTH_PROJECTS_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN " +
      "(falls back to GOOGLE_OAUTH_* if unset)."
  )
  process.exit(1)
}

const auth = new google.auth.OAuth2(clientId, clientSecret)
auth.setCredentials({ refresh_token: refreshToken })
const drive = google.drive({ version: "v3", auth })

const existing = await drive.files.list({
  q: `name = '${FOLDER_NAME.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'me' in owners`,
  fields: "files(id, name, webViewLink)",
})

let folder = existing.data.files?.[0]
if (folder) {
  console.log("folder already exists:", folder.name, folder.id)
} else {
  const created = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, name, webViewLink",
  })
  folder = created.data
  console.log("folder created:", folder.name, folder.id)
}

console.log("\n--- copy into .env.local (and Vercel) ---")
console.log(`GOOGLE_DRIVE_PROJECTS_FOLDER_ID=${folder.id}`)
console.log("----------------------------------------")
console.log(
  `\nOpen ${folder.webViewLink}\n` +
    `Share it with the Firebase service account (FIREBASE_ADMIN_CLIENT_EMAIL, Viewer).`
)
