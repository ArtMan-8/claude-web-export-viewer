import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ChevronDown, Download, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LINK_CHIP_CLASS } from '@/components/common/link-chip'
import { buildThread, resolveDisplayPath } from '@/lib/archive/thread'
import type { Conversation } from '@/lib/archive/model'
import { conversationToMarkdown } from '@/lib/export/markdown'
import { conversationToJson } from '@/lib/export/json'
import { downloadText } from '@/lib/download'
import { useArchive } from '@/store/archive-store'
import { useSettings } from '@/store/settings-store'
import { MessageList } from './message-list'

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^\wа-яё0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'без-названия'
  )
}

export function ConversationView({ conversation }: { conversation: Conversation }) {
  const { archive } = useArchive()
  const { showTools } = useSettings()
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => setOverrides({}), [conversation.uuid])

  const thread = useMemo(() => buildThread(conversation.messages), [conversation.messages])
  const displayPath = useMemo(() => resolveDisplayPath(thread, overrides), [thread, overrides])
  // Пустые сообщения (сорвавшиеся генерации без единого блока контента) не показываем
  const visiblePath = useMemo(() => displayPath.filter((m) => !m.isEmpty), [displayPath])

  const project = useMemo(() => {
    if (!archive) return null
    const link = archive.projectLinks.find((l) => l.conversationUuid === conversation.uuid)
    if (!link) return null
    return archive.projects.find((p) => p.uuid === link.projectUuid) ?? null
  }, [archive, conversation.uuid])

  const handleSwitchBranch = (parentUuid: string, childUuid: string) => {
    setOverrides((prev) => ({ ...prev, [parentUuid]: childUuid }))
  }

  const fileBase = slugify(conversation.displayName)

  const handleExportMarkdown = () => {
    const markdown = conversationToMarkdown(conversation, { includeTools: showTools, project })
    downloadText(`${fileBase}.md`, markdown, 'text/markdown;charset=utf-8')
  }

  const handleExportCleanMarkdown = () => {
    const markdown = conversationToMarkdown(conversation, { includeTools: false, includeThinking: false, project })
    downloadText(`${fileBase}-clean.md`, markdown, 'text/markdown;charset=utf-8')
  }

  const handleExportJson = () => {
    const json = conversationToJson(conversation, { project })
    downloadText(`${fileBase}.json`, json, 'application/json;charset=utf-8')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{conversation.displayName}</h2>
          {project && (
            <Link to="/projects/$uuid" params={{ uuid: project.uuid }} className={`mt-1 ${LINK_CHIP_CLASS}`}>
              <FolderOpen className="size-3 shrink-0" /> {project.displayName}
            </Link>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="size-4" />
              Экспорт
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportMarkdown}>Markdown</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCleanMarkdown}>Markdown — только диалог</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJson}>JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {thread.warning && (
        <Alert className="m-3 mb-0" variant="destructive">
          <AlertTriangle />
          <AlertDescription>{thread.warning}</AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1">
        {conversation.isEmpty ? (
          <p className="p-6 text-sm text-muted-foreground">В этой беседе нет сообщений.</p>
        ) : (
          <MessageList path={visiblePath} thread={thread} showTools={showTools} onSwitchBranch={handleSwitchBranch} />
        )}
      </div>
    </div>
  )
}
