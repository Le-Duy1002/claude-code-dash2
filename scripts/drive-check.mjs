// Quick diagnostic: can the service account see the shared folder?
//   node --env-file=.env.local scripts/drive-check.mjs
import { google } from "googleapis"

const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL ?? process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const key = (process.env.GOOGLE_DRIVE_PRIVATE_KEY ?? process.env.FIREBASE_ADMIN_PRIVATE_KEY)?.replace(/\\n/g, "\n")
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

console.log("service account:", email)
console.log("folder id:", folderId)

const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/drive.readonly"] })
const drive = google.drive({ version: "v3", auth })

try {
  const meta = await drive.files.get({ fileId: folderId, fields: "id,name,mimeType", supportsAllDrives: true })
  console.log("\nFolder visible to SA:", meta.data.name, `(${meta.data.mimeType})`)
} catch (e) {
  console.error("\nCANNOT SEE FOLDER:", e.errors?.[0]?.message ?? e.message)
  console.error("=> Share the folder with the service-account email above (Viewer).")
  process.exit(1)
}

const res = await drive.files.list({
  q: `'${folderId}' in parents and trashed = false`,
  fields: "files(id,name,mimeType,size,modifiedTime)",
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
})
const files = res.data.files ?? []
console.log(`\n${files.length} item(s) in folder:`)
for (const f of files) console.log(` - ${f.name}  [${f.mimeType}]  ${f.size ?? "-"}`)
