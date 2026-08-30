import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ProjectView } from '~/components/project/project-view'
import { useArchive } from '~/store/archive-store'

export const Route = createFileRoute('/projects/$uuid')({
  component: ProjectRoute,
})

function ProjectRoute() {
  const { t } = useTranslation()
  const { uuid } = Route.useParams()
  const { archive } = useArchive()
  const project = archive?.projects.find((p) => p.uuid === uuid)

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('project.notFound')}
      </div>
    )
  }

  return <ProjectView project={project} />
}
