"use client";

import * as React from "react";
import {
  GalleryVerticalEnd,
  FolderOpen,
  Building2,
  LogOut,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { LogoutButton } from "@/components/logout-button";



export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCollection = searchParams.get('collection');

  // Update the brands URL to preserve collection parameter
  const brandsUrl = selectedCollection 
    ? `/dashboard/collections/brands?collection=${encodeURIComponent(selectedCollection)}`
    : '/dashboard/collections/brands';

  // Update data with dynamic brands URL
  const data = {
    navMain: [
      {
        title: "Collections",
        url: "/dashboard/collections",
        icon: FolderOpen,
        items: selectedCollection ? [{ 
          title: "Brands", 
          url: brandsUrl, 
          icon: Building2 
        }] : [],
      },
    ],
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">AI Engine Dashboard</span>
                  <span className="">v1.0.0</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => {
              const isMainActive = pathname === item.url;
              const isChildActive = item.items?.some(subItem => pathname === subItem.url);
              const shouldShowChildren = isMainActive || isChildActive;
              
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isMainActive || isChildActive}>
                    <a href={item.url} className="font-medium">
                      {item.icon && <item.icon className="size-4" />}
                      {item.title}
                    </a>
                  </SidebarMenuButton>
                  {item.items?.length && shouldShowChildren ? (
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === subItem.url}
                          >
                            <a href={subItem.url}>{subItem.title}</a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <LogoutButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
