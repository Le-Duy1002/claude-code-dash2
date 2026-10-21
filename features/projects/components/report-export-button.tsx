"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import { ExportReportDialog } from "@/features/reports"

import { subscribeToProjects } from "../services/projects-service"
import { projectOptions, type Project } from "../types"

/**
 * "Xuất báo cáo" for pages outside a project (e.g. Chỉ số): choose any big
 * project, then one of its sub-projects or the big project itself; a
 * sub-project is the default when there is one.
 */
export function ReportExportButton({
  initialRange,
}: {
  initialRange?: { from: string; to: string }
}) {
  const { user } = useAuth()
  const [projects, setProjects] = React.useState<Project[]>([])

  React.useEffect(() => {
    if (!user) return
    return subscribeToProjects(setProjects, () => {})
  }, [user])

  const options = React.useMemo(() => projectOptions(projects), [projects])

  return (
    <ExportReportDialog
      targets={options}
      defaultTargetId={(options.find((o) => o.parentId) ?? options[0])?.id}
      initialRange={initialRange}
    />
  )
}
