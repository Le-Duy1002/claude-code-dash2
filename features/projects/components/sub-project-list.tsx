"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLinkIcon, FolderTreeIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

import { PROJECT_STATUS_LABELS, staffName, type Project } from "../types"
import { CreateProjectDialog } from "./create-project-dialog"

/**
 * "Dự án con" of a big project: one card per sub-project (each has its own
 * Drive folder inside the big project's, where its reports are saved).
 */
export function SubProjectList({
  parent,
  subProjects,
  allProjects,
}: {
  parent: Project
  subProjects: Project[]
  allProjects: Project[]
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Dự án con{" "}
          <span className="text-muted-foreground">({subProjects.length})</span>
        </p>
        <CreateProjectDialog existing={allProjects} parent={parent} />
      </div>

      {subProjects.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Chưa có dự án con. Tạo dự án con để mỗi loại báo cáo / mỗi mảng có
          thư mục riêng, rồi bấm “Xuất báo cáo” và chọn dự án con để lưu.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {subProjects.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-1.5 rounded-md border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/du-an/${p.id}`} className="min-w-0 hover:underline">
                  <p className="font-mono text-xs text-muted-foreground">
                    {p.code}
                  </p>
                  <p className="truncate font-medium">{p.name}</p>
                </Link>
                <Badge variant="outline">{PROJECT_STATUS_LABELS[p.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.ownerKeys.map((k) => staffName(k)).join(", ") || "—"}
              </p>
              {p.driveFolderUrl ? (
                <a
                  href={p.driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <FolderTreeIcon className="size-3.5" />
                  Thư mục Drive
                  <ExternalLinkIcon className="size-3" />
                </a>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Đang tạo thư mục Drive…
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
