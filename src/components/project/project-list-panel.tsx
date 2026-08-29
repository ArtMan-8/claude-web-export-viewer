import { Link, useParams } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { displayNameOf } from '@/lib/display-name'
import { useArchive } from '@/store/archive-store'

export function ProjectListPanel() {
  const { t } = useTranslation()
  const { archive } = useArchive()
  const params = useParams({ strict: false })
  const activeUuid = (params as { uuid?: string }).uuid

  const projects = (archive?.projects ?? []).filter((p) => !p.isEmpty)

  return (
    <div className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-r">
      {projects.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t('project.noProjects')}</p>
      ) : (
        projects.map((project) => (
          <Link
            key={project.uuid}
            to="/projects/$uuid"
            params={{ uuid: project.uuid }}
            className={`flex flex-col gap-1 border-b px-3 py-3 hover:bg-accent ${
              activeUuid === project.uuid ? 'bg-accent' : ''
            }`}
          >
            <span className="truncate text-sm font-medium">{displayNameOf(project.name, t('common.untitled'))}</span>
            {project.description && <span className="line-clamp-2 text-xs text-muted-foreground">{project.description}</span>}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="size-3" /> {t('project.docsCount', { count: project.docs.length })}
            </span>
          </Link>
        ))
      )}
    </div>
  )
}
