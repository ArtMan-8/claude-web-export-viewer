import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/projects/')({
  component: ProjectsIndexRoute,
})

function ProjectsIndexRoute() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {t('project.selectPrompt')}
    </div>
  )
}
