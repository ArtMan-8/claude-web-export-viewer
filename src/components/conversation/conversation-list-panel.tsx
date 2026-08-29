import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Link, useParams } from '@tanstack/react-router'
import { AlertCircle, FolderOpen, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DEFAULT_SEARCH_SCOPE, runSearch, type SearchScope } from '@/lib/search'
import { useArchive } from '@/store/archive-store'

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}

export function ConversationListPanel() {
  const { archive, searchIndex } = useArchive()
  const params = useParams({ strict: false })
  const activeUuid = (params as { uuid?: string }).uuid

  const [query, setQuery] = useState('')
  const [regexMode, setRegexMode] = useState(false)
  const [scope, setScope] = useState<SearchScope>(DEFAULT_SEARCH_SCOPE)

  const outcome = useMemo(() => {
    if (!archive) return { results: [], regexError: null }
    return runSearch(archive.conversations, archive.projects, archive.projectLinks, searchIndex, query, {
      scope,
      regexMode,
    })
  }, [archive, searchIndex, query, scope, regexMode])

  const matchByUuid = useMemo(() => new Map(outcome.results.map((r) => [r.conversationUuid, r.matchCount])), [outcome])

  const projectNameByConversation = useMemo(() => {
    if (!archive) return new Map<string, string>()
    const nameByProject = new Map(archive.projects.map((p) => [p.uuid, p.displayName]))
    return new Map(
      archive.projectLinks
        .map((l): [string, string] | null => {
          const name = nameByProject.get(l.projectUuid)
          return name ? [l.conversationUuid, name] : null
        })
        .filter((entry): entry is [string, string] => entry !== null),
    )
  }, [archive])

  const rows = useMemo(() => {
    if (!archive) return []
    const nonEmpty = archive.conversations.filter((c) => !c.isEmpty)
    const base = query.trim() ? nonEmpty.filter((c) => matchByUuid.has(c.uuid)) : nonEmpty
    return [...base].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [archive, query, matchByUuid])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder='tool/web_search from:2026-08-01 in:"проект"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant={regexMode ? 'secondary' : 'ghost'} onClick={() => setRegexMode((v) => !v)}>
                Regex
              </Button>
            </TooltipTrigger>
            <TooltipContent>Считать текст в строке поиска регулярным выражением, а не обычной подстрокой</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={scope.thinking ? 'secondary' : 'ghost'}
                onClick={() => setScope((s) => ({ ...s, thinking: !s.thinking }))}
              >
                Искать в размышлениях
              </Button>
            </TooltipTrigger>
            <TooltipContent>Дополнительно искать в кратких саммари размышлений Claude (thinking)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={scope.toolResults ? 'secondary' : 'ghost'}
                onClick={() => setScope((s) => ({ ...s, toolResults: !s.toolResults }))}
              >
                Искать в инструментах
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Дополнительно искать в результатах web_search, чтения страниц и других инструментов — это ~90% объёма
              архива, поэтому выключено по умолчанию
            </TooltipContent>
          </Tooltip>
        </div>
        {outcome.regexError && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" /> {outcome.regexError}
          </p>
        )}
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Ничего не найдено</p>
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
                    <span className="truncate text-sm font-medium">{conversation.displayName}</span>
                    {typeof matchCount === 'number' && query.trim() && (
                      <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                        {matchCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(conversation.createdAt)}</span>
                    <span>· {conversation.messages.length} сообщ.</span>
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
