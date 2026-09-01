"use client"

import * as React from "react"
import { FolderOpenIcon, SearchIcon } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DocumentList,
  EditDocumentDialog,
  SyncButton,
  UploadDocumentDialog,
  subscribeToDocuments,
  syncDocumentsFromDrive,
  type DocumentItem,
} from "@/features/documents"

const DRIVE_FOLDER_URL = process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL

export default function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = React.useState<DocumentItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  const runSync = React.useCallback(() => {
    syncDocumentsFromDrive().catch(() => {})
  }, [])

  React.useEffect(() => {
    if (!user) return
    setLoading(true)
    const unsubscribe = subscribeToDocuments(
      (next) => {
        setDocuments(next)
        setLoading(false)
      },
      () => setLoading(false)
    )
    // Pull the latest from Drive whenever the page is opened.
    runSync()
    return unsubscribe
  }, [user, runSync])

  const visibleDocuments = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return documents
    return documents.filter(
      (document) =>
        document.name.toLowerCase().includes(query) ||
        document.description.toLowerCase().includes(query) ||
        document.uploadedByName.toLowerCase().includes(query)
    )
  }, [documents, search])

  const editingDocument =
    documents.find((document) => document.id === editingId) ?? null

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-lg font-medium">Tài liệu</h1>
          <p className="text-sm text-muted-foreground">
            Đồng bộ với thư mục Google Drive chung — đính kèm tệp ở đây hoặc thêm
            thẳng trên Drive, hai bên tự cập nhật cho nhau.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {DRIVE_FOLDER_URL && (
            <Button
              variant="ghost"
              size="sm"
              render={
                <a href={DRIVE_FOLDER_URL} target="_blank" rel="noreferrer" />
              }
            >
              <FolderOpenIcon data-icon="inline-start" />
              Mở thư mục Drive
            </Button>
          )}
          <SyncButton />
          <UploadDocumentDialog onUploaded={runSync} />
        </div>
      </div>

      <div className="relative sm:max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo tên, mô tả hoặc người cập nhật..."
          className="pl-8"
        />
      </div>

      <DocumentList
        documents={visibleDocuments}
        loading={loading}
        onEdit={(document) => {
          setEditingId(document.id)
          setEditOpen(true)
        }}
      />

      <EditDocumentDialog
        document={editingDocument}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  )
}
