import "server-only"

import { google } from "googleapis"

/**
 * Read-only Google Drive access for the document mirror.
 *
 * Auth: a Google service account. Reuse the Firebase Admin service-account key
 * (same GCP project) unless `GOOGLE_DRIVE_*` overrides are set, then:
 *   1. enable the Google Drive API on that GCP project, and
 *   2. share the team folder with the service account's email (Viewer).
 * No OAuth / consent screen is needed to *read* a folder shared with the account.
 */
const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

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

function driveClient() {
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
    scopes: SCOPES,
  })

  return google.drive({ version: "v3", auth })
}

/** Lists every non-folder file directly inside `folderId` (paged). */
export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const drive = driveClient()
  const files: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields:
        "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, md5Checksum, lastModifyingUser(displayName))",
      pageSize: 1000,
      orderBy: "modifiedTime desc",
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const file of response.data.files ?? []) {
      if (!file.id) continue
      files.push({
        id: file.id,
        name: file.name ?? "",
        mimeType: file.mimeType ?? "application/octet-stream",
        size: Number(file.size ?? 0),
        modifiedTime: file.modifiedTime ?? "",
        webViewLink: file.webViewLink ?? "",
        md5Checksum: file.md5Checksum ?? undefined,
        lastModifyingUser: file.lastModifyingUser?.displayName ?? undefined,
      })
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return files
}
