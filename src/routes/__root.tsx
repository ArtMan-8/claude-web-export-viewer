import { useEffect } from 'react'
import { createRootRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppGate } from '@/components/layout/app-gate'
import { ArchiveProvider } from '@/store/archive-store'
import { SettingsProvider } from '@/store/settings-store'

export const Route = createRootRoute({
  component: RootLayout,
})

/** Держит document.lang/title в синхронизации с текущим языком интерфейса. */
function DocumentLocaleSync() {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = i18n.language
    document.title = t('app.title')
  }, [t, i18n.language])

  return null
}

function RootLayout() {
  return (
    <SettingsProvider>
      <ArchiveProvider>
        <TooltipProvider delayDuration={200}>
          <DocumentLocaleSync />
          <AppGate />
        </TooltipProvider>
      </ArchiveProvider>
    </SettingsProvider>
  )
}
