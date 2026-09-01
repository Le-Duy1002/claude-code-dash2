"use client"

import {
  ExternalLinkIcon,
  FileArchiveIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PencilIcon,
  PresentationIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  documentKind,
  formatDateTime,
  formatFileSize,
  type DocumentItem,
  type DocumentKind,
} from "../types"
import { DeleteDocumentDialog } from "./delete-document-dialog"

const COLUMN_COUNT = 5

const KIND_ICON: Record<DocumentKind, typeof FileIcon> = {
  image: FileImageIcon,
  pdf: FileTextIcon,
  doc: FileTextIcon,
  sheet: FileSpreadsheetIcon,
  slide: PresentationIcon,
  archive: FileArchiveIcon,
  text: FileTextIcon,
  file: FileIcon,
}

export function DocumentList({
  documents,
  loading,
  onEdit,
}: {
  documents: DocumentItem[]
  loading: boolean
  onEdit: (document: DocumentItem) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Tài liệu</TableHead>
            <TableHead>Kích thước</TableHead>
            <TableHead>Cập nhật bởi</TableHead>
            <TableHead>Cập nhật lúc</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="h-24 text-center text-muted-foreground">
                Đang tải...
              </TableCell>
            </TableRow>
          ) : documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="h-24 text-center text-muted-foreground">
                Chưa có tài liệu nào. Đính kèm tệp hoặc thêm vào thư mục Drive
                chung.
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => {
              const Icon = KIND_ICON[documentKind(document)]
              const fromWeb = document.source === "web"
              return (
                <TableRow key={document.id}>
                  <TableCell className="max-w-xs">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {document.name}
                          </span>
                          {!fromWeb && (
                            <Badge variant="outline" className="shrink-0">
                              Drive
                            </Badge>
                          )}
                        </span>
                        {document.description && (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {document.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatFileSize(document.size)}</TableCell>
                  <TableCell>{document.uploadedByName}</TableCell>
                  <TableCell>
                    {formatDateTime(
                      document.driveModifiedTime || document.updatedAt
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        render={
                          <a
                            href={document.webViewLink || "#"}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <ExternalLinkIcon />
                        <span className="sr-only">Mở trong Google Drive</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => onEdit(document)}
                      >
                        <PencilIcon />
                        <span className="sr-only">Sửa tài liệu</span>
                      </Button>
                      {fromWeb && (
                        <DeleteDocumentDialog
                          documentId={document.id}
                          documentName={document.name}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
