import "server-only"

import { randomUUID } from "node:crypto"

import { FieldValue } from "firebase-admin/firestore"

import type { DriveCheck, ProjectDriveCheck } from "@/features/projects/types"

import { adminDb } from "./firebase-admin"
import {
  GOOGLE_SHEET_MIME,
  createProjectFolder,
  createProjectSubfolder,
  deleteProjectFile,
  getChangesStartPageToken,
  getProjectFolder,
  listFolderTree,
  projectsWriteAccount,
  readerCanSee,
  readerEmail,
  shareWithReader,
  stopChannel,
  uploadFileToProjectFolder,
  uploadSpreadsheetToProjectFolder,
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
 * folder / upload / sync routes so folder creation lives in one place. A
 * sub-project (`parentId`) gets its folder inside its parent project's.
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

  const parentId = (data.parentId as string | null) ?? null
  const folder = parentId
    ? await createProjectSubfolder(
        (await ensureProjectDriveFolder(parentId)).id,
        displayName
      )
    : await createProjectFolder(displayName)
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

/**
 * "Kiểm tra Drive": can the app really write into this project's folder?
 * Checks the write account, that the folder still exists, writes and deletes
 * a test file, and that the mirror's service account can read the folder.
 * With `repair`, a deleted folder is replaced by a new one and a folder the
 * service account can't read is shared with it.
 */
export async function checkProjectDrive(
  projectId: string,
  { repair = false }: { repair?: boolean } = {}
): Promise<ProjectDriveCheck> {
  const ref = adminDb().collection("projects").doc(projectId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError("Không tìm thấy dự án", 404)
  const checks: DriveCheck[] = []
  let repairable = false
  const done = (folderId: string | null, folderUrl: string | null) => ({
    ok: checks.every((c) => c.ok),
    folderId,
    folderUrl,
    checks,
    repairable,
  })

  try {
    const email = await projectsWriteAccount()
    checks.push({ key: "account", label: "Tài khoản Google ghi file", ok: true, detail: email })
  } catch (error) {
    checks.push({
      key: "account",
      label: "Tài khoản Google ghi file",
      ok: false,
      detail: `Không đăng nhập được Google (${(error as Error).message}). Cần cấp quyền lại bằng scripts/get-refresh-token.mjs rồi cập nhật GOOGLE_OAUTH_PROJECTS_REFRESH_TOKEN.`,
    })
    return done(null, null)
  }

  // the folder: still there for the write account?
  let folderId = (snap.get("driveFolderId") as string | null) ?? null
  let folderUrl = (snap.get("driveFolderUrl") as string | null) ?? null
  const current = folderId ? await getProjectFolder(folderId) : null
  if (current && !current.trashed) {
    checks.push({ key: "folder", label: "Thư mục dự án trên Drive", ok: true, detail: current.name })
  } else if (repair) {
    await ref.update({
      driveFolderId: null,
      driveFolderUrl: null,
      updatedAt: FieldValue.serverTimestamp(),
    })
    const created = await ensureProjectDriveFolder(projectId)
    folderId = created.id
    folderUrl = created.url
    checks.push({
      key: "folder",
      label: "Thư mục dự án trên Drive",
      ok: true,
      detail: `Đã tạo thư mục mới "${created.name}".`,
    })
  } else {
    repairable = true
    checks.push({
      key: "folder",
      label: "Thư mục dự án trên Drive",
      ok: false,
      detail: !folderId
        ? "Dự án chưa có thư mục Drive."
        : current?.trashed
          ? "Thư mục đang nằm trong thùng rác Drive."
          : "Thư mục không còn trên Drive (đã bị xoá hoặc không thuộc tài khoản ghi file).",
    })
    return done(folderId, folderUrl)
  }

  // write + delete a test file
  try {
    const test = await uploadFileToProjectFolder({
      folderId: folderId!,
      name: "Kiểm tra kết nối (tự xoá).txt",
      mimeType: "text/plain",
      buffer: Buffer.from(`Kiểm tra lúc ${new Date().toISOString()}`),
    })
    await deleteProjectFile(test.id)
    checks.push({ key: "write", label: "Ghi file vào thư mục", ok: true, detail: "Ghi và xoá thử một tệp thành công." })
  } catch (error) {
    checks.push({
      key: "write",
      label: "Ghi file vào thư mục",
      ok: false,
      detail: `Không ghi được: ${(error as Error).message}`,
    })
  }

  // the mirror (Đồng bộ Drive / Tài liệu) reads as the service account
  let visible = await readerCanSee(folderId!)
  if (!visible && repair) {
    await shareWithReader(folderId!)
    visible = await readerCanSee(folderId!)
  }
  if (!visible) repairable = true
  checks.push({
    key: "mirror",
    label: "App đọc được để đồng bộ tài liệu",
    ok: visible,
    detail: visible
      ? readerEmail()
      : `Thư mục chưa chia sẻ cho ${readerEmail()}.`,
  })

  return done(folderId, folderUrl)
}

/**
 * Saves an exported report (.xlsx) into the project's Drive folder as a
 * Google Sheet and records it in the project's document mirror right away.
 */
export async function saveProjectReport(
  projectId: string,
  report: {
    name: string
    buffer: Buffer
    kind: string
    from: string
    to: string
  },
  actorName: string
): Promise<{ id: string; name: string; webViewLink: string }> {
  const folder = await ensureProjectDriveFolder(projectId)
  const file = await uploadSpreadsheetToProjectFolder({
    folderId: folder.id,
    name: report.name,
    buffer: report.buffer,
  })
  await adminDb()
    .collection("projects")
    .doc(projectId)
    .collection("documents")
    .doc(file.id)
    .set({
      name: file.name,
      fileName: file.name,
      size: file.size,
      contentType: GOOGLE_SHEET_MIME,
      driveFileId: file.id,
      webViewLink: file.webViewLink,
      driveModifiedTime: file.modifiedTime,
      parentId: "",
      isFolder: false,
      uploadedByName: actorName,
      source: "web",
      report: { kind: report.kind, from: report.from, to: report.to },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  return { id: file.id, name: file.name, webViewLink: file.webViewLink }
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
/**
 * ms before expiry at which the renewal cron re-registers a channel. The
 * renew workflow runs every 12 h and GitHub starts scheduled runs hours late
 * (the 12-min sync ran every 3–4 h, 20–21/10/2026), so a 20-min margin was
 * almost always missed and the channel lapsed until the next run.
 */
const RENEW_MARGIN_MS = 36 * 60 * 60 * 1000
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
