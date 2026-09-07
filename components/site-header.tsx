"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const TITLES: Record<string, string> = {
  "/": "Trang chủ",
  "/dashboard": "Bảng điều khiển",
  "/dashboard/task": "Công việc",
  "/lich-lam-viec": "Lịch làm việc",
  "/theo-doi-cong-viec": "Theo dõi công việc",
  "/nhat-ky-ai": "Nhật ký AI theo ngày",
  "/documents": "Tài liệu",
}

function titleFromPathname(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname]
  const last = pathname.split("/").filter(Boolean).pop() ?? "Trang chủ"
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{titleFromPathname(pathname)}</h1>
      </div>
    </header>
  )
}
