import { useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { FileText, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { runProjectSearch } from '@/lib/search'
import { displayNameOf } from '@/lib/display-name'
import { useArchive } from '@/store/archive-store'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

export function ProjectListPanel() {
  const { t } = useTranslation()
  const { archive, docIndex } = useArchive()
  const params = useParams({ strict: false })
  const activeUuid = (params as { uuid?: string }).uuid
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 500)

  const allProjects = useMemo(() => (archive?.projects ?? []).filter((p) => !p.isEmpty), [archive])
  const results = useMemo(() => runProjectSearch(allProjects, docIndex, debouncedQuery), [allProjects, docIndex, debouncedQuery])
  const matchByUuid = useMemo(() => new Map(results.map((r) => [r.projectUuid, r.matchCount])), [results])

  const projects = debouncedQuery.trim() ? allProjects.filter((p) => matchByUuid.has(p.uuid)) : allProjects

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('project.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {debouncedQuery.trim() ? t('conversation.nothingFound') : t('project.noProjects')}
          </p>
        ) : (
          projects.map((project) => {
            const matchCount = matchByUuid.get(project.uuid)
            return (
              <Link
                key={project.uuid}
                to="/projects/$uuid"
                params={{ uuid: project.uuid }}
                className={`flex flex-col gap-1 border-b px-3 py-3 hover:bg-accent ${
                  activeUuid === project.uuid ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{displayNameOf(project.name, t('common.untitled'))}</span>
                  {debouncedQuery.trim() && !!matchCount && (
                    <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                      {t('project.matchesCount', { count: matchCount })}
                    </Badge>
                  )}
                </div>
                {project.description && <span className="line-clamp-2 text-xs text-muted-foreground">{project.description}</span>}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="size-3" /> {t('project.docsCount', { count: project.docs.length })}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
