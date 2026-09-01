// Creates (or finds) the shared library folder OWNED BY THE OAUTH APP.
//
// The `drive.file` scope only lets the app write into folders it created, so the
// library folder must be created here rather than reusing an existing one.
// After running, share the printed folder with the service account (Viewer) and
// the team, then put its id in GOOGLE_DRIVE_FOLDER_ID.
//
//   node --env-file=.env.local scripts/create-drive-folder.mjs
import { google } from "googleapis"

const FOLDER_NAME = process.argv[2] ?? "Hẻm Tài liệu"

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET
)
auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN })
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
console.log(`GOOGLE_DRIVE_FOLDER_ID=${folder.id}`)
console.log(
  `NEXT_PUBLIC_DRIVE_FOLDER_URL=https://drive.google.com/drive/folders/${folder.id}`
)
console.log("----------------------------------------")
console.log(
  `\nOpen ${folder.webViewLink}\nand Share it with the Firebase service account ` +
    `(FIREBASE_ADMIN_CLIENT_EMAIL, Viewer) and with your team.`
)
