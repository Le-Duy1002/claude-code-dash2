"use client"

import * as React from "react"
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FolderIcon,
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
import { cn } from "@/lib/utils"
import {
  documentKind,
  formatDateTime,
  formatFileSize,
  type DocumentKind,
} from "@/features/documents/types"

import {
  deleteProjectDocument,
  subscribeToProjectDocuments,
  syncProjectDocuments,
  uploadProjectDocument,
  type ProjectDocItem,
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

function sortItems(a: ProjectDocItem, b: ProjectDocItem): number {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
  return a.name.localeCompare(b.name, "vi")
}

function TreeNode({
  item,
  childrenOf,
  depth,
  projectId,
}: {
  item: ProjectDocItem
  childrenOf: Map<string, ProjectDocItem[]>
  depth: number
  projectId: string
}) {
  const [open, setOpen] = React.useState(depth === 0)
  const kids = (childrenOf.get(item.id) ?? []).slice().sort(sortItems)
  const pad = { paddingLeft: `${depth * 1.1 + 0.25}rem` }

  if (item.isFolder) {
    return (
      <>
        <div
          className="flex items-center gap-1 py-1.5 text-sm"
          style={pad}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 font-medium hover:underline"
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-90"
              )}
            />
            <FolderIcon className="size-4 shrink-0 text-amber-500" />
            {item.name}
          </button>
          <span className="text-xs text-muted-foreground">
            ({kids.length})
          </span>
          <a
            href={item.webViewLink}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title="Mở trên Drive"
          >
            <ExternalLinkIcon className="size-3" />
          </a>
        </div>
        {open
          ? kids.map((kid) => (
              <TreeNode
                key={kid.id}
                item={kid}
                childrenOf={childrenOf}
                depth={depth + 1}
                projectId={projectId}
              />
            ))
          : null}
      </>
    )
  }

  const Icon = KIND_ICON[documentKind(item)] ?? FileIcon
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 text-sm"
      style={pad}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <a
        href={item.webViewLink}
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:underline"
      >
        {item.name}
      </a>
      <Badge variant="outline">
        {item.source === "web" ? "tải lên" : "từ Drive"}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {formatFileSize(item.size)} ·{" "}
        {formatDateTime(item.driveModifiedTime || item.createdAt)}
      </span>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-7 text-muted-foreground hover:text-destructive"
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
              {item.source === "web"
                ? `"${item.name}" sẽ bị xoá khỏi Drive và dự án.`
                : `"${item.name}" được thêm thẳng vào Drive — chỉ gỡ khỏi danh sách, tệp trên Drive vẫn còn.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toast.promise(deleteProjectDocument(projectId, item.id), {
                  loading: "Đang xoá…",
                  success: "Đã xoá.",
                  error: (e) => `Lỗi: ${(e as Error).message}`,
                })
              }
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function ProjectDocuments({
  projectId,
  driveFolderUrl,
}: {
  projectId: string
  driveFolderUrl: string | null
}) {
  const [docs, setDocs] = React.useState<ProjectDocItem[]>([])
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

  const { roots, childrenOf, fileCount } = React.useMemo(() => {
    const byParent = new Map<string, ProjectDocItem[]>()
    for (const d of docs) {
      const key = d.parentId || ""
      const list = byParent.get(key) ?? []
      list.push(d)
      byParent.set(key, list)
    }
    // re-key folder children under the folder's own id
    const childrenOf = new Map<string, ProjectDocItem[]>()
    for (const d of docs) {
      if (!d.isFolder) continue
      childrenOf.set(d.id, byParent.get(d.id) ?? [])
    }
    return {
      roots: (byParent.get("") ?? []).slice().sort(sortItems),
      childrenOf,
      fileCount: docs.filter((d) => !d.isFolder).length,
    }
  }, [docs])

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
        `Đồng bộ xong: ${r.total} mục (+${r.created} / ~${r.updated} / -${r.deleted}).`
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
          Tài liệu <span className="text-muted-foreground">({fileCount})</span>
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
      ) : roots.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Chưa có tài liệu. Bấm “Tải lên”, hoặc thả tệp / thư mục vào thư mục
          Drive của dự án rồi bấm “Đồng bộ Drive”.
        </p>
      ) : (
        <div className="divide-y">
          {roots.map((item) => (
            <TreeNode
              key={item.id}
              item={item}
              childrenOf={childrenOf}
              depth={0}
              projectId={projectId}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Tệp tải lên qua nút “Tải lên” nằm ở thư mục gốc của dự án. Muốn xếp vào
        thư mục con thì kéo trên Drive rồi bấm “Đồng bộ Drive”.
      </p>
    </div>
  )
}
