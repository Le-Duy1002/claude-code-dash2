import "server-only"

import { Readable } from "node:stream"

import { google } from "googleapis"

/**
 * Google Drive access for the document library.
 *
 * Reads (the mirror) use a **service account** — reuse the Firebase Admin key
 * (same GCP project) unless `GOOGLE_DRIVE_*` overrides are set — after enabling
 * the Drive API and sharing the team folder with the account's email (Viewer).
 *
 * Writes (upload / rename / delete from the web) use **OAuth** as the folder
 * owner (`GOOGLE_OAUTH_*`), because a service account has no storage quota and
 * cannot own files in a non-Workspace Drive. Scope `drive.file` only grants
 * access to files this app creates, which is all the write path needs.
 */
const READ_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
const WRITE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]

const DRIVE_FIELDS =
  "id, name, mimeType, size, modifiedTime, webViewLink, md5Checksum"

export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID ?? ""

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  webViewLink: string
  md5Checksum?: string
  lastModifyingUser?: string
}

function readClient() {
  const clientEmail =
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL ??
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = (
    process.env.GOOGLE_DRIVE_PRIVATE_KEY ?? process.env.FIREBASE_ADMIN_PRIVATE_KEY
  )?.replace(/\\n/g, "\n")

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google Drive service-account credentials")
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: READ_SCOPES,
  })

  return google.drive({ version: "v3", auth })
}

function writeClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN"
    )
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken, scope: WRITE_SCOPES.join(" ") })
  return google.drive({ version: "v3", auth })
}

function mapFile(file: {
  id?: string | null
  name?: string | null
  mimeType?: string | null
  size?: string | null
  modifiedTime?: string | null
  webViewLink?: string | null
  md5Checksum?: string | null
}): DriveFile {
  return {
    id: file.id ?? "",
    name: file.name ?? "",
    mimeType: file.mimeType ?? "application/octet-stream",
    size: Number(file.size ?? 0),
    modifiedTime: file.modifiedTime ?? new Date().toISOString(),
    webViewLink: file.webViewLink ?? "",
    md5Checksum: file.md5Checksum ?? undefined,
  }
}

/** Uploads a new file into `folderId`, owned by the OAuth account. */
export async function uploadFileToDrive(params: {
  folderId: string
  name: string
  mimeType: string
  buffer: Buffer
}): Promise<DriveFile> {
  const drive = writeClient()
  const response = await drive.files.create({
    requestBody: { name: params.name, parents: [params.folderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: DRIVE_FIELDS,
  })
  return mapFile(response.data)
}

export async function renameDriveFile(
  fileId: string,
  name: string
): Promise<DriveFile> {
  const drive = writeClient()
  const response = await drive.files.update({
    fileId,
    requestBody: { name },
    fields: DRIVE_FIELDS,
  })
  return mapFile(response.data)
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const drive = writeClient()
  await drive.files.delete({ fileId })
}

/** Lists every non-folder file directly inside `folderId` (paged). */
export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const drive = readClient()
  const files: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: `nextPageToken, files(${DRIVE_FIELDS}, lastModifyingUser(displayName))`,
      pageSize: 1000,
      orderBy: "modifiedTime desc",
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const file of response.data.files ?? []) {
      if (!file.id) continue
      files.push({
        ...mapFile(file),
        lastModifyingUser: file.lastModifyingUser?.displayName ?? undefined,
      })
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return files
}
