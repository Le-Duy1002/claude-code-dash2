"use client"

import * as React from "react"
import {
  ExternalLinkIcon,
  FileArchiveIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  documentKind,
  formatDateTime,
  formatFileSize,
  type DocumentItem,
  type DocumentKind,
} from "@/features/documents/types"

import {
  deleteProjectDocument,
  subscribeToProjectDocuments,
  syncProjectDocuments,
  uploadProjectDocument,
} from "../services/project-documents-service"

const KIND_ICON: Record<DocumentKind, React.ElementType> = {
  image: FileImageIcon,
  pdf: FileTextIcon,
  doc: FileTextIcon,
  sheet: FileSpreadsheetIcon,
  slide: PresentationIcon,
  archive: FileArchiveIcon,
  text: FileTextIcon,
  file: FileIcon,
}

export function ProjectDocuments({
  projectId,
  driveFolderUrl,
}: {
  projectId: string
  driveFolderUrl: string | null
}) {
  const [docs, setDocs] = React.useState<DocumentItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setLoading(true)
    const unsub = subscribeToProjectDocuments(
      projectId,
      (rows) => {
        setDocs(rows)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [projectId])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    let ok = 0
    for (const file of Array.from(files)) {
      try {
        await uploadProjectDocument(projectId, file)
        ok += 1
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`)
      }
    }
    if (ok > 0) toast.success(`Đã tải lên ${ok} tệp.`)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const r = await syncProjectDocuments(projectId)
      toast.success(
        `Đồng bộ xong: ${r.total} tệp (+${r.created} / ~${r.updated} / -${r.deleted}).`
      )
    } catch (e) {
      toast.error(`Đồng bộ lỗi: ${(e as Error).message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Tài liệu{" "}
          <span className="text-muted-foreground">({docs.length})</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {driveFolderUrl ? (
            <a
              href={driveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLinkIcon className="size-3.5" />
              Mở thư mục Drive
            </a>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={syncing}
            onClick={handleSync}
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={syncing ? "animate-spin" : undefined}
            />
            Đồng bộ Drive
          </Button>
          <Button
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            {uploading ? "Đang tải…" : "Tải lên"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Đang tải…
        </p>
      ) : docs.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Chưa có tài liệu. Bấm “Tải lên”, hoặc thả tệp vào thư mục Drive của dự
          án rồi bấm “Đồng bộ Drive”.
        </p>
      ) : (
        <ul className="flex flex-col divide-y text-sm">
          {docs.map((doc) => {
            const Icon = KIND_ICON[documentKind(doc)] ?? FileIcon
            return (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <a
                  href={doc.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {doc.name}
                </a>
                <Badge variant="outline">
                  {doc.source === "web" ? "tải lên" : "từ Drive"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(doc.size)} ·{" "}
                  {formatDateTime(doc.driveModifiedTime || doc.createdAt)} ·{" "}
                  {doc.uploadedByName}
                </span>
                <div className="ml-auto">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                        />
                      }
                    >
                      <Trash2Icon />
                      <span className="sr-only">Xoá</span>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xoá tài liệu?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {doc.source === "web"
                            ? `"${doc.name}" sẽ bị xoá khỏi Drive và dự án.`
                            : `"${doc.name}" được thêm thẳng vào Drive — chỉ gỡ khỏi danh sách, tệp trên Drive vẫn còn.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Huỷ</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            toast.promise(
                              deleteProjectDocument(projectId, doc.id),
                              {
                                loading: "Đang xoá…",
                                success: "Đã xoá.",
                                error: (e) => `Lỗi: ${(e as Error).message}`,
                              }
                            )
                          }
                        >
                          Xoá
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
