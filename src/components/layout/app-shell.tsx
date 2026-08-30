import type { ReactNode } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Archive, LayoutDashboard, MessageSquare, FolderOpen, UserRound, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { GithubIcon } from '@/components/common/github-icon'
import { ThemeToggle } from './theme-toggle'
import { LanguageToggle } from './language-toggle'
import { useArchive } from '@/store/archive-store'

const AUTHOR_GITHUB_URL = 'https://github.com/ArtMan-8'

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/conversations', labelKey: 'nav.conversations', icon: MessageSquare },
  { to: '/projects', labelKey: 'nav.projects', icon: FolderOpen },
  { to: '/account', labelKey: 'nav.account', icon: UserRound },
] as const

export function AppShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const { reset } = useArchive()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    // По умолчанию у SidebarProvider min-h-svh (растягивается по контенту, скроллит вся
    // страница). Нам нужен зафиксированный по высоте app-shell, где скроллят только
    // внутренние панели — иначе они «уезжают» из вьюпорта вместе с остальной страницей.
    <SidebarProvider className="h-svh">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={t('app.title')}
                className="group-data-[collapsible=icon]:p-2!"
              >
                <Link to="/">
                  <Archive />
                  <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">{t('app.title')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
                  const label = t(item.labelKey)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={label}>
                        <Link to={item.to}>
                          <item.icon />
                          <span>{label}</span>
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
              <SidebarMenuButton onClick={reset} tooltip={t('nav.resetArchiveTooltip')}>
                <RotateCcw />
                <span>{t('nav.newArchive')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <Separator />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="text-muted-foreground" tooltip={t('nav.authorTooltip')}>
                <a href={AUTHOR_GITHUB_URL} target="_blank" rel="noreferrer">
                  <GithubIcon />
                  <span>{t('nav.author')}</span>
                </a>
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
          <LanguageToggle />
          <ThemeToggle />
        </header>
        <div className="flex-1 overflow-hidden">{children ?? <Outlet />}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
