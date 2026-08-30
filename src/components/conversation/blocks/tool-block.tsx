import { useState } from 'react'
import { AlertCircle, ChevronRight, Eye, FileCode, FileEdit, Files, FolderSearch, Globe, Search, Terminal, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { Badge } from '~/components/ui/badge'
import type { Block, ToolCall } from '~/lib/archive/model'
import { ToolCallView } from './tool-call'
import { ToolResultView } from './tool-result'

const NAME_ICONS: Record<string, typeof Wrench> = {
  web_search: Globe,
  web_fetch: Globe,
  project_knowledge_search: FolderSearch,
  bash_tool: Terminal,
  view: Eye,
  artifacts: FileCode,
  create_file: FileCode,
  str_replace: FileEdit,
  present_files: Files,
}

const ICON_NAME_ICONS: Record<string, typeof Wrench> = {
  terminal: Terminal,
  search: Search,
  globe: Globe,
  file: FileCode,
}

const CALL_KIND_ICONS: Record<ToolCall['kind'], typeof Wrench> = {
  filePresent: Files,
  fileEdit: FileEdit,
  fileWrite: FileCode,
  command: Terminal,
  fetch: Globe,
  query: Search,
  fileRead: Eye,
  raw: Wrench,
  none: Wrench,
}

/** Иконка: по имени инструмента, затем по icon_name из архива, затем по форме вызова, иначе Wrench (§2.1 плана). */
function iconFor(block: Extract<Block, { kind: 'tool' }>): typeof Wrench {
  return NAME_ICONS[block.name] ?? (block.iconName ? ICON_NAME_ICONS[block.iconName] : undefined) ?? CALL_KIND_ICONS[block.call.kind] ?? Wrench
}

export function ToolBlock({ block }: { block: Extract<Block, { kind: 'tool' }> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const Icon = iconFor(block)
  const label = block.label ?? t(`tools.${block.name}`, block.name)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-muted/40">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{label}</span>
        {block.isError && (
          <Badge variant="destructive" className="ml-auto gap-1">
            <AlertCircle className="size-3" /> {t('common.error')}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3 text-sm">
        <ToolCallView call={block.call} />
        <ToolResultView result={block.result} />

        {!block.isPaired && (
          <p className="text-xs text-muted-foreground">
            {block.rawInput === undefined ? t('conversation.resultWithoutCall') : t('conversation.callWithoutResult')} —{' '}
            {t('conversation.incompleteData')}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
