"use client"

import * as React from "react"
import { CornerDownRightIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/components/auth-provider"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  addComment,
  deleteCommentThread,
  subscribeToComments,
} from "../services/comments-service"
import {
  buildCommentTree,
  formatDateTime,
  type Task,
  type TaskComment,
  type TaskCommentNode,
} from "../types"

function CommentComposer({
  placeholder = "Viết bình luận...",
  autoFocus = false,
  onCancel,
  onSubmit,
}: {
  placeholder?: string
  autoFocus?: boolean
  onCancel?: () => void
  onSubmit: (content: string) => Promise<void>
}) {
  const [value, setValue] = React.useState("")
  const [pending, setPending] = React.useState(false)

  async function submit() {
    const content = value.trim()
    if (!content || pending) return
    setPending(true)
    try {
      await onSubmit(content)
      setValue("")
      onCancel?.()
    } catch {
      toast.error("Không gửi được bình luận. Vui lòng thử lại.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        autoFocus={autoFocus}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault()
            void submit()
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={onCancel}
          >
            Huỷ
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={pending || !value.trim()}
          onClick={() => void submit()}
        >
          {pending ? "Đang gửi..." : "Gửi"}
        </Button>
      </div>
    </div>
  )
}

function DeleteCommentButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon />
        Xoá
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá bình luận?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác. Bình luận này và toàn bộ câu trả
            lời bên trong sẽ bị xoá vĩnh viễn.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              toast.promise(onConfirm(), {
                loading: "Đang xoá...",
                success: "Đã xoá bình luận.",
                error: "Không thể xoá bình luận.",
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

function CommentItem({
  node,
  taskId,
  currentUid,
  descendantsOf,
}: {
  node: TaskCommentNode
  taskId: string
  currentUid: string
  descendantsOf: (id: string) => string[]
}) {
  const { user } = useAuth()
  const [replying, setReplying] = React.useState(false)

  return (
    <div className={cn(node.depth > 0 && "border-l pl-3 sm:pl-4")}>
      <div className="flex flex-col gap-1 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{node.createdByName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(node.createdAt)}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{node.content}</p>
        <div className="-ml-2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-muted-foreground"
            onClick={() => setReplying((open) => !open)}
          >
            <CornerDownRightIcon />
            Trả lời
          </Button>
          {node.createdByUid === currentUid && (
            <DeleteCommentButton
              onConfirm={() =>
                deleteCommentThread(taskId, [node.id, ...descendantsOf(node.id)])
              }
            />
          )}
        </div>
        {replying && user && (
          <div className="pt-1">
            <CommentComposer
              autoFocus
              placeholder={`Trả lời ${node.createdByName}...`}
              onCancel={() => setReplying(false)}
              onSubmit={(content) =>
                addComment(taskId, { content, parentId: node.id, user })
              }
            />
          </div>
        )}
      </div>

      {node.replies.map((child) => (
        <CommentItem
          key={child.id}
          node={child}
          taskId={taskId}
          currentUid={currentUid}
          descendantsOf={descendantsOf}
        />
      ))}
    </div>
  )
}

export function TaskCommentsDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const [comments, setComments] = React.useState<TaskComment[]>([])
  const [loading, setLoading] = React.useState(true)
  const taskId = task?.id ?? null

  React.useEffect(() => {
    if (!open || !taskId) return
    setLoading(true)
    setComments([])
    const unsubscribe = subscribeToComments(
      taskId,
      (next) => {
        setComments(next)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsubscribe
  }, [open, taskId])

  const tree = React.useMemo(() => buildCommentTree(comments), [comments])

  const childIdsByParent = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const comment of comments) {
      if (!comment.parentId) continue
      map.set(comment.parentId, [
        ...(map.get(comment.parentId) ?? []),
        comment.id,
      ])
    }
    return map
  }, [comments])

  const descendantsOf = React.useCallback(
    (id: string): string[] => {
      const result: string[] = []
      const stack = [...(childIdsByParent.get(id) ?? [])]
      while (stack.length > 0) {
        const next = stack.pop() as string
        result.push(next)
        stack.push(...(childIdsByParent.get(next) ?? []))
      }
      return result
    },
    [childIdsByParent]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bình luận</DialogTitle>
          <DialogDescription className="line-clamp-1">
            {task?.title ?? ""}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 max-h-[45vh] divide-y overflow-y-auto border-y px-6">
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">Đang tải...</p>
          ) : tree.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Chưa có bình luận nào. Hãy là người đầu tiên.
            </p>
          ) : (
            tree.map((node) => (
              <CommentItem
                key={node.id}
                node={node}
                taskId={taskId as string}
                currentUid={user?.uid ?? ""}
                descendantsOf={descendantsOf}
              />
            ))
          )}
        </div>

        {user && taskId ? (
          <CommentComposer
            onSubmit={(content) =>
              addComment(taskId, { content, parentId: null, user })
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Bạn cần đăng nhập để bình luận.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
