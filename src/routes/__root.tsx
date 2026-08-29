import { createRootRoute } from '@tanstack/react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppGate } from '@/components/layout/app-gate'
import { ArchiveProvider } from '@/store/archive-store'
import { SettingsProvider } from '@/store/settings-store'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <SettingsProvider>
      <ArchiveProvider>
        <TooltipProvider delayDuration={200}>
          <AppGate />
        </TooltipProvider>
      </ArchiveProvider>
    </SettingsProvider>
  )
}
