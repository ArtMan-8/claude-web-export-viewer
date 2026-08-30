import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Link, useParams } from '@tanstack/react-router'
import { FolderOpen, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { runSearch } from '~/lib/search'
import { displayNameOf } from '~/lib/display-name'
import { useArchive } from '~/store/archive-store'
import { useDebouncedValue } from '~/hooks/use-debounced-value'

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}

export function ConversationListPanel() {
  const { t } = useTranslation()
  const { archive, searchIndex } = useArchive()
  const params = useParams({ strict: false })
  const activeUuid = (params as { uuid?: string }).uuid

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 500)

  const results = useMemo(() => runSearch(searchIndex, debouncedQuery), [searchIndex, debouncedQuery])
  const matchByUuid = useMemo(() => new Map(results.map((r) => [r.conversationUuid, r.matchCount])), [results])

  const projectNameByConversation = useMemo(() => {
    if (!archive) return new Map<string, string>()
    const nameByProject = new Map(archive.projects.map((p) => [p.uuid, displayNameOf(p.name, t('common.untitled'))]))
    return new Map(
      archive.projectLinks
        .map((l): [string, string] | null => {
          const name = nameByProject.get(l.projectUuid)
          return name ? [l.conversationUuid, name] : null
        })
        .filter((entry): entry is [string, string] => entry !== null),
    )
  }, [archive, t])

  const rows = useMemo(() => {
    if (!archive) return []
    const nonEmpty = archive.conversations.filter((c) => !c.isEmpty)
    const base = debouncedQuery.trim() ? nonEmpty.filter((c) => matchByUuid.has(c.uuid)) : nonEmpty
    return [...base].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [archive, debouncedQuery, matchByUuid])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('conversation.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t('conversation.nothingFound')}</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((row) => {
              const conversation = rows[row.index]
              const matchCount = matchByUuid.get(conversation.uuid)
              const projectName = projectNameByConversation.get(conversation.uuid)

              return (
                <Link
                  key={conversation.uuid}
                  to="/conversations/$uuid"
                  params={{ uuid: conversation.uuid }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${row.start}px)` }}
                  className={`flex h-[72px] flex-col justify-center gap-1 border-b px-3 py-2 hover:bg-accent ${
                    activeUuid === conversation.uuid ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {displayNameOf(conversation.name, t('common.untitled'))}
                    </span>
                    {typeof matchCount === 'number' && debouncedQuery.trim() && (
                      <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                        {matchCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(conversation.createdAt)}</span>
                    <span>· {t('conversation.messagesCountShort', { count: conversation.messages.length })}</span>
                    {projectName && (
                      <span className="flex items-center gap-0.5 truncate">
                        <FolderOpen className="size-3 shrink-0" /> {projectName}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
