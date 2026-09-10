import "server-only"

import { randomUUID } from "node:crypto"

import { FieldValue } from "firebase-admin/firestore"

import { adminDb } from "./firebase-admin"
import {
  createProjectFolder,
  createProjectSubfolder,
  getChangesStartPageToken,
  listFolderTree,
  stopChannel,
  uploadFileToProjectFolder,
  watchChanges,
} from "./google-drive"

export type ProjectFolder = { id: string; url: string; name: string }

class HttpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

/**
 * Returns the project's Drive folder, creating it on first call. Shared by the
 * folder / upload / sync routes so folder creation lives in one place.
 */
export async function ensureProjectDriveFolder(
  projectId: string
): Promise<ProjectFolder> {
  const ref = adminDb().collection("projects").doc(projectId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError("Không tìm thấy dự án", 404)

  const data = snap.data() as Record<string, unknown>
  const displayName = `${(data.code as string) ?? "PRJ"} ${(data.name as string) ?? ""}`
    .trim()
    .slice(0, 120)

  if (data.driveFolderId) {
    return {
      id: data.driveFolderId as string,
      url: (data.driveFolderUrl as string) ?? "",
      name: displayName,
    }
  }

  const folder = await createProjectFolder(displayName)
  await ref.update({
    driveFolderId: folder.id,
    driveFolderUrl: folder.webViewLink,
    driveFolderPending: false,
    updatedAt: FieldValue.serverTimestamp(),
  })
  // make sure the change-feed webhook is live now that there is a folder to
  // watch (no-op locally / until PROJECT_DRIVE_WEBHOOK_URL is set)
  registerDriveWatch().catch(() => {})
  return { id: folder.id, url: folder.webViewLink, name: displayName }
}

/**
 * Creates a subfolder or an empty named file inside a project's Drive folder
 * (directly at the root, or under an existing subfolder via `parentId`), and
 * records the mirror doc. Used by the "Tạo thư mục" / "Tạo tệp" actions on the
 * documents tree, so a project's structure can be built entirely from the web.
 */
export async function createProjectItem(
  projectId: string,
  input: { parentId: string; name: string; isFolder: boolean },
  actorName: string
): Promise<{ id: string }> {
  const name = input.name.trim()
  if (!name) throw new HttpError("Tên không được để trống", 400)
  if (name.length > 200) throw new HttpError("Tên quá dài", 400)

  const folder = await ensureProjectDriveFolder(projectId)
  const driveParentId = input.parentId || folder.id
  const collection = adminDb()
    .collection("projects")
    .doc(projectId)
    .collection("documents")

  if (input.isFolder) {
    const created = await createProjectSubfolder(driveParentId, name)
    if (!created.id) throw new HttpError("Không tạo được thư mục trên Drive", 502)
    await collection.doc(created.id).set({
      name,
      fileName: name,
      size: 0,
      contentType: "application/vnd.google-apps.folder",
      driveFileId: created.id,
      webViewLink: created.webViewLink,
      driveModifiedTime: new Date().toISOString(),
      parentId: input.parentId,
      isFolder: true,
      uploadedByName: actorName,
      source: "web",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { id: created.id }
  }

  const drive = await uploadFileToProjectFolder({
    folderId: driveParentId,
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(""),
  })
  await collection.doc(drive.id).set({
    name: drive.name,
    fileName: drive.name,
    size: drive.size,
    contentType: drive.mimeType,
    driveFileId: drive.id,
    webViewLink: drive.webViewLink,
    driveModifiedTime: drive.modifiedTime,
    parentId: input.parentId,
    isFolder: false,
    uploadedByName: actorName,
    source: "web",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return { id: drive.id }
}

export type SyncResult = {
  total: number
  created: number
  updated: number
  deleted: number
}

/**
 * Reconciles `projects/{id}/documents` with the current contents of the
 * project's Drive folder tree. Shared by the per-project sync route, the
 * sync-all cron, and the Drive webhook.
 */
export async function reconcileProjectDocuments(
  projectId: string
): Promise<SyncResult> {
  const folder = await ensureProjectDriveFolder(projectId)
  const items = await listFolderTree(folder.id)

  const db = adminDb()
  const collection = db
    .collection("projects")
    .doc(projectId)
    .collection("documents")
  const snapshot = await collection.get()
  const existing = new Map(snapshot.docs.map((d) => [d.id, d]))

  const writer = db.bulkWriter()
  const seen = new Set<string>()
  let created = 0
  let updated = 0
  let deleted = 0

  for (const file of items) {
    seen.add(file.id)
    const prev = existing.get(file.id)
    const parentId = file.parentId === folder.id ? "" : file.parentId
    const data = {
      name: file.name,
      fileName: file.name,
      size: file.size,
      contentType: file.mimeType,
      driveFileId: file.id,
      webViewLink: file.webViewLink,
      driveModifiedTime: file.modifiedTime,
      parentId,
      isFolder: file.isFolder,
      uploadedByName:
        prev?.get("uploadedByName") ?? file.lastModifyingUser ?? "Google Drive",
      source: prev?.get("source") ?? "drive",
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (!prev) {
      void writer.set(collection.doc(file.id), {
        ...data,
        createdAt: FieldValue.serverTimestamp(),
      })
      created += 1
    } else if (
      prev.get("driveModifiedTime") !== file.modifiedTime ||
      prev.get("name") !== file.name ||
      (prev.get("parentId") ?? "") !== parentId ||
      Boolean(prev.get("isFolder")) !== file.isFolder
    ) {
      void writer.set(collection.doc(file.id), data, { merge: true })
      updated += 1
    }
  }

  for (const [id, doc] of existing) {
    if (!seen.has(id)) {
      void writer.delete(doc.ref)
      deleted += 1
    }
  }

  await writer.close()
  return { total: items.length, created, updated, deleted }
}

/** Reconcile every project that has a Drive folder. */
export async function reconcileAllProjectDocuments(): Promise<{
  projects: number
  warnings: string[]
}> {
  const snap = await adminDb().collection("projects").get()
  const ids = snap.docs.filter((d) => d.get("driveFolderId")).map((d) => d.id)
  const warnings: string[] = []
  for (const id of ids) {
    try {
      await reconcileProjectDocuments(id)
    } catch (error) {
      warnings.push(`${id}: ${(error as Error).message}`)
    }
  }
  return { projects: ids.length, warnings }
}

// ------------------------------------------------ Drive watch (near-realtime)

const watchDoc = () =>
  adminDb().collection("projectDriveMeta").doc("driveWatch")

/** Requested channel lifetime — Drive may grant less; see `watchChanges`. */
const REQUEST_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000
/** ms before expiry at which the renewal cron re-registers a channel. */
const RENEW_MARGIN_MS = 20 * 60 * 1000
/** ignore webhook pings that land within this window of the last sync. */
export const WEBHOOK_DEBOUNCE_MS = 20 * 1000

/**
 * Registers (or renews) the Drive change-feed web-hook for the "Dự án" subtree.
 * No-op when `PROJECT_DRIVE_WEBHOOK_URL` is unset (local / pre-deploy).
 */
export async function registerDriveWatch(force = false): Promise<{
  registered: boolean
  expiresAt: number
  reason?: string
}> {
  const address = process.env.PROJECT_DRIVE_WEBHOOK_URL
  if (!address) {
    return {
      registered: false,
      expiresAt: 0,
      reason: "PROJECT_DRIVE_WEBHOOK_URL chưa cấu hình",
    }
  }
  const token = process.env.CRON_SECRET ?? ""
  const ref = watchDoc()
  const current = (await ref.get()).data()

  if (
    !force &&
    typeof current?.expirationMs === "number" &&
    current.expirationMs - Date.now() > RENEW_MARGIN_MS
  ) {
    return {
      registered: false,
      expiresAt: current.expirationMs,
      reason: "kênh còn hiệu lực",
    }
  }

  const channelId = randomUUID()
  const pageToken = await getChangesStartPageToken()
  const { resourceId, expiration } = await watchChanges({
    channelId,
    address,
    token,
    pageToken,
    expirationMs: Date.now() + REQUEST_EXPIRATION_MS,
  })

  if (current?.channelId && current?.resourceId) {
    try {
      await stopChannel(current.channelId, current.resourceId)
    } catch {
      /* old channel may already be gone */
    }
  }

  const expirationMs = expiration || Date.now() + 6 * 24 * 60 * 60 * 1000
  await ref.set(
    {
      channelId,
      resourceId,
      expirationMs,
      address,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
  return { registered: true, expiresAt: expirationMs }
}

/** Records that a webhook-triggered sync just ran (for debouncing). */
export async function markWebhookSync(): Promise<void> {
  await watchDoc().set({ lastSyncMs: Date.now() }, { merge: true })
}

/** True if a webhook sync ran within the debounce window. */
export async function webhookRecentlySynced(): Promise<boolean> {
  const data = (await watchDoc().get()).data()
  return (
    typeof data?.lastSyncMs === "number" &&
    Date.now() - data.lastSyncMs < WEBHOOK_DEBOUNCE_MS
  )
}

/** Verifies the token Drive echoes back in `X-Goog-Channel-Token`. */
export function isValidWebhookToken(token: string | null): boolean {
  const expected = process.env.CRON_SECRET
  return Boolean(expected) && token === expected
}
