import { Link, useParams } from '@tanstack/react-router'
import { Frame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { displayNameOf } from '~/lib/display-name'
import { useArchive } from '~/store/archive-store'

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}

export function ArtifactListPanel() {
  const { t } = useTranslation()
  const { archive } = useArchive()
  const params = useParams({ strict: false })
  const activeId = (params as { id?: string }).id
  const artifacts = [...(archive?.artifacts ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r">
      <div className="flex-1 overflow-y-auto">
        {artifacts.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t('artifact.noArtifacts')}</p>
        ) : (
          artifacts.map((artifact) => {
            const latest = artifact.versions[0]
            return (
              <Link
                key={artifact.id}
                to="/artifacts/$id"
                params={{ id: artifact.id }}
                className={`flex flex-col gap-1 border-b px-3 py-3 hover:bg-accent ${activeId === artifact.id ? 'bg-accent' : ''}`}
              >
                <span className="truncate text-sm font-medium">{displayNameOf(artifact.title, t('common.untitled'))}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Frame className="size-3" /> {t('artifact.versionsCount', { count: artifact.versions.length })}
                  {latest && <span>· {formatDate(latest.createdAt)}</span>}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
