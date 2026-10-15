"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import { NavMain, type NavSection } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { FolderIcon, FolderOpenIcon, CameraIcon, FileTextIcon, ClipboardListIcon, GaugeIcon, CalendarClockIcon, CalendarDaysIcon, BanknoteIcon, LineChartIcon } from "lucide-react"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navSections: [
    {
      label: "Theo dõi",
      items: [
        {
          title: "Chỉ số",
          url: "/thong-ke-trang",
          icon: <LineChartIcon />,
        },
        {
          title: "Lịch làm",
          url: "/lich-lam-viec",
          icon: <CalendarDaysIcon />,
        },
        {
          title: "Rà soát công việc",
          url: "/theo-doi-cong-viec",
          icon: <GaugeIcon />,
        },
        {
          title: "Chi tiết cá nhân",
          url: "/nhat-ky-ai",
          icon: <CalendarClockIcon />,
        },
      ],
    },
    {
      label: "Làm việc",
      items: [
        {
          title: "Dự án",
          url: "/du-an",
          icon: <FolderIcon />,
        },
        {
          title: "Công việc",
          url: "/dashboard/task",
          icon: <ClipboardListIcon />,
        },
        {
          title: "Tài liệu chung",
          url: "/documents",
          icon: <FolderOpenIcon />,
        },
      ],
    },
    {
      label: "Nhân sự",
      items: [
        {
          title: "Bảng lương",
          url: "/bang-luong",
          icon: <BanknoteIcon />,
        },
      ],
    },
  ] satisfies NavSection[],
  navClouds: [
    {
      title: "Capture",
      icon: (
        <CameraIcon
        />
      ),
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
}
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <Image
                src="/logohem.png"
                alt="Hẻm"
                width={20}
                height={20}
                className="size-5!"
              />
              <span className="text-base font-semibold">Hẻm - Product</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={data.navSections} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
