"use client"

import { Trash2Icon } from "lucide-react"
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
import { Button } from "@/components/ui/button"

import { deleteDocument } from "../services/documents-service"

export function DeleteDocumentDialog({
  documentId,
  documentName,
}: {
  documentId: string
  documentName: string
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon />
        <span className="sr-only">Xoá tài liệu</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá tài liệu?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác.{" "}
            <span className="font-medium text-foreground">{documentName}</span>{" "}
            sẽ bị xoá khỏi thư viện và khỏi thư mục Google Drive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              toast.promise(deleteDocument(documentId), {
                loading: "Đang xoá...",
                success: "Đã xoá tài liệu.",
                error: "Không thể xoá tài liệu.",
              })
            }}
          >
            Xoá
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
