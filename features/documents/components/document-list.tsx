"use client"

import {
  ExternalLinkIcon,
  FileArchiveIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
} from "lucide-react"

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
}: {
  documents: DocumentItem[]
  loading: boolean
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
            <TableHead className="text-right">Mở</TableHead>
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
                Chưa có tài liệu nào trong thư mục Drive chung.
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => {
              const Icon = KIND_ICON[documentKind(document)]
              return (
                <TableRow key={document.id}>
                  <TableCell className="max-w-xs">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {document.name}
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
                    <div className="flex items-center justify-end">
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
