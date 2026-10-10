"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type NavSection = {
  label: string
  items: {
    title: string
    url: string
    icon?: React.ReactNode
  }[]
}

function isActivePath(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`)
}

/** Each section is one framed list, rows split by a rule, current page marked. */
export function NavMain({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname()
  // client-side navigation leaves the mobile sheet open — close it
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label} className="py-1">
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="overflow-hidden rounded-lg border border-sidebar-border bg-background/60">
              {section.items.map((item) => (
                <SidebarMenuItem
                  key={item.url}
                  className="border-b border-sidebar-border last:border-b-0"
                >
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActivePath(pathname, item.url)}
                    render={<Link href={item.url} />}
                    onClick={() => isMobile && setOpenMobile(false)}
                    className="relative h-9 rounded-none px-3 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary before:opacity-0 data-active:before:opacity-100 [&_svg]:text-sidebar-foreground/60 data-active:[&_svg]:text-sidebar-primary"
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
