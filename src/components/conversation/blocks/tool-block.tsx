import { useState } from 'react'
import { AlertCircle, ChevronRight, Eye, FileCode, FolderSearch, Globe, Terminal, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import type { Block } from '@/lib/archive/model'

const TOOL_ICONS: Record<string, typeof Wrench> = {
  web_search: Globe,
  web_fetch: Globe,
  project_knowledge_search: FolderSearch,
  bash_tool: Terminal,
  view: Eye,
  artifacts: FileCode,
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function inputSummary(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const value = record.query ?? record.url ?? record.command ?? record.path ?? record.description
  return typeof value === 'string' ? value : null
}

function resultTextOf(block: Extract<Block, { kind: 'tool' }>): string {
  const result = block.result
  if (result.kind === 'command') return [result.stdout, result.stderr].filter(Boolean).join('\n')
  if (result.kind === 'text') return result.text
  if (result.kind === 'files') return result.files.map((f) => f.path).join('\n')
  return ''
}

export function ToolBlock({ block }: { block: Extract<Block, { kind: 'tool' }> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const Icon = TOOL_ICONS[block.name] ?? Wrench
  const summary = inputSummary(block.rawInput)
  const sources = block.result.kind === 'sources' ? block.result.sources : []
  const resultText = resultTextOf(block)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-muted/40">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{t(`tools.${block.name}`, block.name)}</span>
        {summary && <span className="truncate text-muted-foreground">— {summary}</span>}
        {block.isError && (
          <Badge variant="destructive" className="ml-auto gap-1">
            <AlertCircle className="size-3" /> {t('common.error')}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-3 pb-3 text-sm">
        {block.rawInput !== undefined && (
          <pre className="overflow-x-auto rounded bg-background p-2 text-xs">
            {JSON.stringify(block.rawInput, null, 2)}
          </pre>
        )}

        {sources.length > 0 ? (
          <ul className="space-y-1.5">
            {sources.map((source, i) => (
              <li key={`${source.url}-${i}`} className="text-sm">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {source.title || hostnameOf(source.url) || t('common.source')}
                </a>
                {source.domain && <span className="ml-1.5 text-xs text-muted-foreground">{source.domain}</span>}
                {source.snippet && <p className="text-xs text-muted-foreground">{source.snippet}</p>}
              </li>
            ))}
          </ul>
        ) : (
          resultText && (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">{resultText}</pre>
          )
        )}

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
