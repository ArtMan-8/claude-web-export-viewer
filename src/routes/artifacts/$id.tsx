import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArtifactView } from '~/components/artifact/artifact-view'
import { useArchive } from '~/store/archive-store'

export const Route = createFileRoute('/artifacts/$id')({
  component: ArtifactRoute,
})

function ArtifactRoute() {
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const { archive } = useArchive()
  const artifact = archive?.artifacts.find((a) => a.id === id)

  if (!artifact) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('artifact.notFound')}
      </div>
    )
  }

  return <ArtifactView artifact={artifact} />
}
