import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useArchive } from '~/store/archive-store'

export const Route = createFileRoute('/artifacts/')({
  component: ArtifactsIndexRoute,
})

function ArtifactsIndexRoute() {
  const { t } = useTranslation()
  const { archive } = useArchive()
  const hasArtifacts = (archive?.artifacts.length ?? 0) > 0
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {hasArtifacts ? t('artifact.selectPrompt') : t('artifact.noArtifacts')}
    </div>
  )
}
