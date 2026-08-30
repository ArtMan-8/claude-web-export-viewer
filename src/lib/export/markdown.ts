import i18next from 'i18next'
import type { Block, Citation, Conversation, Project } from '@/lib/archive/model'
import { displayNameOf } from '@/lib/display-name'

export interface MarkdownExportOptions {
  /** Показывать блоки инструментов (tool_use/tool_result) — по умолчанию скрыты, это ~90% объёма архива */
  includeTools: boolean
  /** Показывать размышления Claude (thinking-блоки) — по умолчанию показаны */
  includeThinking?: boolean
  project?: Project | null
}

function formatDate(iso: string): string {
  if (!iso) return ''
  return iso.replace('T', ' ').slice(0, 16)
}

function yamlString(value: string): string {
  return JSON.stringify(value) // валидный YAML flow-scalar с экранированием
}

function renderTool(block: Extract<Block, { kind: 'tool' }>): string {
  const parts: string[] = []
  const label = block.label ?? i18next.t(`tools.${block.name}`, block.name)
  const summary = block.isError ? `⚠️ ${label} (${i18next.t('common.error')})` : label

  parts.push(`<details>\n<summary>${summary}</summary>\n`)

  if (block.rawInput !== undefined) {
    parts.push('\n```json\n' + JSON.stringify(block.rawInput, null, 2) + '\n```\n')
  }

  const result = block.result
  if (result.kind === 'sources') {
    parts.push(
      '\n' +
        result.sources
          .map((s) => `- [${s.title || s.url || i18next.t('common.source')}](${s.url})${s.snippet ? ` — ${s.snippet}` : ''}`)
          .join('\n') +
        '\n',
    )
  } else if (result.kind === 'command') {
    parts.push('\n```\n' + [result.stdout, result.stderr].filter(Boolean).join('\n') + '\n```\n')
  } else if (result.kind === 'files') {
    parts.push('\n' + result.files.map((f) => `- ${f.path}`).join('\n') + '\n')
  } else if (result.kind === 'text' && result.text) {
    parts.push('\n```\n' + result.text + '\n```\n')
  }

  parts.push('\n</details>')
  return parts.join('')
}

function renderUnknown(block: Extract<Block, { kind: 'unknown' }>): string {
  return (
    `<details>\n<summary>${i18next.t('common.unknownBlock', { type: block.blockType })}</summary>\n\n` +
    '```json\n' +
    JSON.stringify(block.raw, null, 2) +
    '\n```\n\n</details>'
  )
}

/**
 * Рендерит беседу в Markdown с YAML-frontmatter. Цитаты выносятся в сноски в
 * конце документа, а не вклеиваются по индексам символов — offset-ы в
 * citations считаются по исходному тексту Claude, который может не совпадать
 * посимвольно после нормализации, поэтому вклейка по индексу ненадёжна.
 */
export function conversationToMarkdown(conversation: Conversation, options: MarkdownExportOptions): string {
  const footnotes: string[] = []
  const seenUrls = new Map<string, number>()

  function footnoteRefs(citations: Citation[]): string {
    if (citations.length === 0) return ''
    const refs = citations.map((c) => {
      let index = seenUrls.get(c.url)
      if (index === undefined) {
        footnotes.push(c.url)
        index = footnotes.length
        seenUrls.set(c.url, index)
      }
      return `[^${index}]`
    })
    return ' ' + refs.join('')
  }

  const conversationTitle = displayNameOf(conversation.name, i18next.t('common.untitled'))

  const lines: string[] = []
  lines.push('---')
  lines.push(`uuid: ${conversation.uuid}`)
  lines.push(`title: ${yamlString(conversationTitle)}`)
  if (options.project) {
    lines.push(`project: ${yamlString(displayNameOf(options.project.name, i18next.t('common.untitled')))}`)
  }
  lines.push(`created_at: ${conversation.createdAt}`)
  lines.push(`updated_at: ${conversation.updatedAt}`)
  lines.push(`message_count: ${conversation.messages.length}`)
  lines.push('---')
  lines.push('')
  lines.push(`# ${conversationTitle}`)
  lines.push('')

  for (const message of conversation.messages) {
    const speaker = message.sender === 'human' ? i18next.t('export.speakerHuman') : i18next.t('export.speakerClaude')
    lines.push(`## ${speaker} · ${formatDate(message.createdAt)}`)
    lines.push('')

    if (message.isEmpty) {
      lines.push(i18next.t('export.emptyMessage'))
      lines.push('')
      continue
    }

    for (const block of message.blocks) {
      switch (block.kind) {
        case 'text':
          lines.push(block.text + footnoteRefs(block.citations))
          lines.push('')
          break
        case 'thinking': {
          if (options.includeThinking === false) break
          const summary = block.summaries.join(' ') || block.text
          if (summary) {
            lines.push(i18next.t('export.thinkingSummary', { summary }))
            lines.push('')
          }
          break
        }
        case 'tool':
          if (options.includeTools) {
            lines.push(renderTool(block))
            lines.push('')
          }
          break
        case 'unknown':
          if (options.includeTools) {
            lines.push(renderUnknown(block))
            lines.push('')
          }
          break
      }
    }
  }

  if (footnotes.length > 0) {
    lines.push('---')
    lines.push('')
    footnotes.forEach((url, i) => lines.push(`[^${i + 1}]: ${url}`))
    lines.push('')
  }

  return lines.join('\n')
}
