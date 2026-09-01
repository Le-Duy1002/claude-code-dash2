/**
 * A team document. The file lives in the shared Google Drive folder; this
 * record (Firestore `documents/{driveFileId}`) is a read-only mirror kept in
 * sync by `POST /api/drive/sync`. `uploadedByName` is Drive's last-modifying
 * user; `webViewLink` opens the file in Drive.
 */
export interface DocumentItem {
  id: string
  name: string
  description: string
  fileName: string
  size: number
  contentType: string
  driveFileId: string
  webViewLink: string
  driveModifiedTime: string
  uploadedByName: string
  source: string
  createdAt: number
  updatedAt: number
}

export type DocumentKind =
  | "image"
  | "pdf"
  | "doc"
  | "sheet"
  | "slide"
  | "archive"
  | "text"
  | "file"

/** Coarse file category, used to pick an icon. */
export function documentKind(
  item: Pick<DocumentItem, "contentType" | "fileName">
): DocumentKind {
  const type = item.contentType.toLowerCase()
  const ext = item.fileName.split(".").pop()?.toLowerCase() ?? ""

  if (type.startsWith("image/")) return "image"
  if (type === "application/pdf" || ext === "pdf") return "pdf"
  if (
    type.includes("word") ||
    type.includes("document") ||
    ["doc", "docx", "odt", "rtf"].includes(ext)
  ) {
    return "doc"
  }
  if (
    type.includes("sheet") ||
    type.includes("excel") ||
    ["xls", "xlsx", "ods", "csv"].includes(ext)
  ) {
    return "sheet"
  }
  if (
    type.includes("presentation") ||
    type.includes("powerpoint") ||
    ["ppt", "pptx", "odp"].includes(ext)
  ) {
    return "slide"
  }
  if (
    type.includes("zip") ||
    type.includes("compressed") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  ) {
    return "archive"
  }
  if (type.startsWith("text/") || ["txt", "md", "json"].includes(ext)) {
    return "text"
  }
  return "file"
}

/** `1536` -> `"1.5 KB"`. */
export function formatFileSize(bytes: number): string {
  if (!bytes) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exp = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  const value = bytes / 1024 ** exp
  const rounded = value >= 10 || exp === 0 ? Math.round(value) : value.toFixed(1)
  return `${rounded} ${units[exp]}`
}

/** ISO string or epoch ms -> `"14:05 · 09/06/2026"`. */
export function formatDateTime(value: number | string): string {
  const date = typeof value === "number" ? new Date(value) : new Date(value)
  if (!value || Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}
