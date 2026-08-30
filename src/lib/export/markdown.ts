import i18next from 'i18next'
import type { Block, Citation, Conversation, ConversationFile, Project, ToolCall, ToolResult } from '~/lib/archive/model'
import { displayNameOf } from '~/lib/display-name'

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

/** Приближение алгоритма GitHub для якорей заголовков — этого достаточно для ссылок внутри одного документа. */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

function fileLink(path: string, fileSlugs: Map<string, string>): string {
  return `[\`${path}\`](#${fileSlugs.get(path) ?? slugifyHeading(path)})`
}

function renderCall(call: ToolCall, fileSlugs: Map<string, string>): string {
  switch (call.kind) {
    case 'filePresent':
      return call.paths.map((path) => `- ${fileLink(path, fileSlugs)}`).join('\n')
    case 'fileEdit':
      return [`\`${call.path}\``, '', '```diff', `- ${call.oldText}`, `+ ${call.newText}`, '```'].join('\n')
    case 'fileWrite':
      // Q17: содержимое печатается только в разделе «Файлы» — здесь якорь, а не тело, иначе дубль
      return `${fileLink(call.path, fileSlugs)}`
    case 'command':
      return '```' + (call.language ?? '') + '\n' + call.command + '\n```'
    case 'fetch':
      return call.url
    case 'query':
      return call.query
    case 'fileRead':
      return `\`${call.path}\`` + (call.range ? ` (${call.range[0]}–${call.range[1]})` : '')
    case 'raw':
      return '```json\n' + JSON.stringify(call.input, null, 2) + '\n```'
    case 'none':
      return ''
  }
}

function renderResult(result: ToolResult, fileSlugs: Map<string, string>): string {
  switch (result.kind) {
    case 'command': {
      const parts = [i18next.t('export.exitCode', { code: result.exitCode ?? '—' })]
      if (result.stdout) parts.push('```\n' + result.stdout + '\n```')
      if (result.stderr) parts.push('```\n' + result.stderr + '\n```')
      return parts.join('\n\n')
    }
    case 'sources':
      return result.sources
        .map((s) => `- [${s.title || s.url || i18next.t('common.source')}](${s.url})${s.publishedAt ? ` — ${s.publishedAt}` : ''}`)
        .join('\n')
    case 'files':
      return result.files.map((f) => `- ${fileLink(f.path, fileSlugs)}`).join('\n')
    case 'text':
      return result.text ? '```\n' + result.text + '\n```' : ''
    case 'none':
      return ''
  }
}

function renderTool(block: Extract<Block, { kind: 'tool' }>, fileSlugs: Map<string, string>): string {
  const parts: string[] = []
  const label = block.label ?? i18next.t(`tools.${block.name}`, block.name)
  const summary = block.isError ? `⚠️ ${label} (${i18next.t('common.error')})` : label

  parts.push(`<details>\n<summary>${summary}</summary>\n`)

  const callBody = renderCall(block.call, fileSlugs)
  if (callBody) parts.push('\n' + callBody + '\n')

  const resultBody = renderResult(block.result, fileSlugs)
  if (resultBody) parts.push('\n' + resultBody + '\n')

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

/** Раздел «Файлы» в конце документа — всегда, полное содержимое без усечения (§5.3 плана). */
function renderFilesSection(files: ConversationFile[]): string[] {
  if (files.length === 0) return []

  const lines: string[] = ['---', '', `## ${i18next.t('export.filesHeading')}`, '']
  for (const file of files) {
    lines.push(`### ${file.path}`, '')
    lines.push(i18next.t('export.fileMeta', { revisions: file.revisions.length, size: file.finalSize ?? 0 }), '')
    if (file.content !== null) {
      lines.push('```' + (file.language ?? ''), file.content, '```', '')
    } else {
      lines.push(i18next.t(`conversation.fileError.${file.reconstructionError}`), '')
    }
  }
  return lines
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
  const fileSlugs = new Map(conversation.files.map((f) => [f.path, slugifyHeading(f.path)]))

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
            lines.push(renderTool(block, fileSlugs))
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

  lines.push(...renderFilesSection(conversation.files))

  return lines.join('\n')
}
