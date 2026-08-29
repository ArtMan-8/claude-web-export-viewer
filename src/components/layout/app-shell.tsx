import type { ReactNode } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, MessageSquare, FolderOpen, UserRound, RotateCcw } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from './theme-toggle'
import { useArchive } from '@/store/archive-store'

const NAV_ITEMS = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/conversations', label: 'Беседы', icon: MessageSquare },
  { to: '/projects', label: 'Проекты', icon: FolderOpen },
  { to: '/account', label: 'Аккаунт', icon: UserRound },
] as const

export function AppShell({ children }: { children?: ReactNode }) {
  const { reset } = useArchive()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    // По умолчанию у SidebarProvider min-h-svh (растягивается по контенту, скроллит вся
    // страница). Нам нужен зафиксированный по высоте app-shell, где скроллят только
    // внутренние панели — иначе они «уезжают» из вьюпорта вместе с остальной страницей.
    <SidebarProvider className="h-svh">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="text-sm font-semibold">Архив Claude</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={reset} tooltip="Загрузить другой архив">
                <RotateCcw />
                <span>Другой архив</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <div className="flex-1 overflow-hidden">{children ?? <Outlet />}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
