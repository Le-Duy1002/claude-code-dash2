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

/**
 * Write client for the "Dự án" area — a second OAuth identity that owns the
 * projects parent folder (`GOOGLE_OAUTH_PROJECTS_*`, falls back to
 * `GOOGLE_OAUTH_*`). `drive.file` only writes into folders THIS identity
 * created, hence a dedicated parent folder created via
 * `scripts/create-projects-folder.mjs`.
 */
function projectsWriteClient() {
  const clientId =
    process.env.GOOGLE_OAUTH_PROJECTS_CLIENT_ID ??
    process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_OAUTH_PROJECTS_CLIENT_SECRET ??
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken =
    process.env.GOOGLE_OAUTH_PROJECTS_REFRESH_TOKEN ??
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_OAUTH_PROJECTS_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN"
    )
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({
    refresh_token: refreshToken,
    scope: WRITE_SCOPES.join(" "),
  })
  return google.drive({ version: "v3", auth })
}

export const PROJECTS_PARENT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_PROJECTS_FOLDER_ID ?? ""

/** Creates a subfolder for one project inside the "Dự án" parent folder. */
export async function createProjectFolder(
  name: string
): Promise<{ id: string; webViewLink: string }> {
  if (!PROJECTS_PARENT_FOLDER_ID) {
    throw new Error("GOOGLE_DRIVE_PROJECTS_FOLDER_ID chưa cấu hình")
  }
  const drive = projectsWriteClient()
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [PROJECTS_PARENT_FOLDER_ID],
    },
    fields: "id, webViewLink",
  })
  return {
    id: res.data.id ?? "",
    webViewLink: res.data.webViewLink ?? "",
  }
}

/** Renames a project folder (e.g. when the project is renamed). */
export async function renameProjectFolder(
  folderId: string,
  name: string
): Promise<void> {
  const drive = projectsWriteClient()
  await drive.files.update({ fileId: folderId, requestBody: { name } })
}

/** Uploads a file into a project folder, owned by the projects OAuth account. */
export async function uploadFileToProjectFolder(params: {
  folderId: string
  name: string
  mimeType: string
  buffer: Buffer
}): Promise<DriveFile> {
  const drive = projectsWriteClient()
  const response = await drive.files.create({
    requestBody: { name: params.name, parents: [params.folderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: DRIVE_FIELDS,
  })
  return mapFile(response.data)
}

/** Renames a file in a project folder. */
export async function renameProjectFile(
  fileId: string,
  name: string
): Promise<DriveFile> {
  const drive = projectsWriteClient()
  const response = await drive.files.update({
    fileId,
    requestBody: { name },
    fields: DRIVE_FIELDS,
  })
  return mapFile(response.data)
}

// ---------------------------------------------- Drive push notifications (watch)

/** A page token to start a `changes.watch` / `changes.list` from. */
export async function getChangesStartPageToken(): Promise<string> {
  const drive = readClient()
  const res = await drive.changes.getStartPageToken({
    supportsAllDrives: true,
  })
  return res.data.startPageToken ?? ""
}

/**
 * Subscribes a web-hook to the read account's Drive change feed (which only
 * contains what has been shared with it — i.e. the "Dự án" folder subtree).
 * Any change there pings `address`.
 */
export async function watchChanges(params: {
  channelId: string
  address: string
  token: string
  pageToken: string
}): Promise<{ resourceId: string; expiration: number }> {
  const drive = readClient()
  const res = await drive.changes.watch({
    pageToken: params.pageToken,
    supportsAllDrives: true,
    requestBody: {
      id: params.channelId,
      type: "web_hook",
      address: params.address,
      token: params.token,
    },
  })
  return {
    resourceId: res.data.resourceId ?? "",
    expiration: Number(res.data.expiration ?? 0),
  }
}

/** Stops a previously opened watch channel. */
export async function stopChannel(
  channelId: string,
  resourceId: string
): Promise<void> {
  const drive = readClient()
  await drive.channels.stop({ requestBody: { id: channelId, resourceId } })
}

/** Deletes a file in a project folder. */
export async function deleteProjectFile(fileId: string): Promise<void> {
  const drive = projectsWriteClient()
  await drive.files.delete({ fileId })
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

export type DriveTreeItem = DriveFile & {
  /** Drive id of the immediate parent folder */
  parentId: string
  isFolder: boolean
}

const FOLDER_MIME = "application/vnd.google-apps.folder"

/**
 * Walks `rootId` breadth-first and returns every folder + file under it
 * (each item carries its immediate `parentId`). Bounded by `maxDepth` and
 * `maxItems` so a pathological tree can't stall the request.
 */
export async function listFolderTree(
  rootId: string,
  { maxDepth = 6, maxItems = 800 }: { maxDepth?: number; maxItems?: number } = {}
): Promise<DriveTreeItem[]> {
  const drive = readClient()
  const out: DriveTreeItem[] = []
  let queue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }]

  while (queue.length > 0 && out.length < maxItems) {
    const next: typeof queue = []
    for (const { id, depth } of queue) {
      let pageToken: string | undefined
      do {
        const response = await drive.files.list({
          q: `'${id}' in parents and trashed = false`,
          fields: `nextPageToken, files(${DRIVE_FIELDS}, lastModifyingUser(displayName))`,
          pageSize: 1000,
          orderBy: "folder,name",
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
        for (const file of response.data.files ?? []) {
          if (!file.id || out.length >= maxItems) continue
          const isFolder = file.mimeType === FOLDER_MIME
          out.push({
            ...mapFile(file),
            lastModifyingUser: file.lastModifyingUser?.displayName ?? undefined,
            parentId: id,
            isFolder,
          })
          if (isFolder && depth + 1 < maxDepth) {
            next.push({ id: file.id, depth: depth + 1 })
          }
        }
        pageToken = response.data.nextPageToken ?? undefined
      } while (pageToken)
    }
    queue = next
  }
  return out
}
