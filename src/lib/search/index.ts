import type { Conversation, Project, ProjectLink } from '@/lib/archive/model'
import { compileTextMatcher, parseQuery } from './query'

export type SearchBlockKind = 'text' | 'thinking' | 'tool'

export interface SearchEntry {
  conversationUuid: string
  messageUuid: string
  createdAt: string
  blockKind: SearchBlockKind
  toolName: string | null
  text: string
}

/** Индекс строится по content-блокам (не по беседам целиком) — беседы бывают под мегабайт весом. */
export function buildSearchIndex(conversations: Conversation[]): SearchEntry[] {
  const entries: SearchEntry[] = []

  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      for (const block of message.blocks) {
        if (block.kind === 'text') {
          entries.push({
            conversationUuid: conversation.uuid,
            messageUuid: message.uuid,
            createdAt: message.createdAt,
            blockKind: 'text',
            toolName: null,
            text: block.text,
          })
        } else if (block.kind === 'thinking') {
          entries.push({
            conversationUuid: conversation.uuid,
            messageUuid: message.uuid,
            createdAt: message.createdAt,
            blockKind: 'thinking',
            toolName: null,
            text: block.summaries.join(' ') || block.text,
          })
        } else if (block.kind === 'tool') {
          entries.push({
            conversationUuid: conversation.uuid,
            messageUuid: message.uuid,
            createdAt: message.createdAt,
            blockKind: 'tool',
            toolName: block.name,
            text: block.resultText,
          })
        }
      }
    }
  }

  return entries
}

export interface SearchScope {
  thinking: boolean
  toolResults: boolean
}

export interface SearchOptions {
  scope: SearchScope
  regexMode: boolean
}

export const DEFAULT_SEARCH_SCOPE: SearchScope = { thinking: false, toolResults: false }

export interface SearchResult {
  conversationUuid: string
  matchCount: number
}

export interface SearchOutcome {
  results: SearchResult[]
  regexError: string | null
}

function toTimestamp(value: string, endOfDay: boolean): number | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}Z` : value
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? null : parsed
}

function conversationHasBlock(conversation: Conversation, predicate: (blockKind: string, extra: unknown) => boolean): boolean {
  return conversation.messages.some((message) =>
    message.blocks.some((block) => predicate(block.kind, block)),
  )
}

/**
 * Выполняет поиск по беседам: свободный текст (или regex) + префиксные
 * фильтры tool/, from:, to:, in:, has:. Фильтры по дате/проекту/наличию
 * работают на уровне беседы, текстовый матчинг — на уровне блока, с учётом
 * выбранной области поиска.
 */
export function runSearch(
  conversations: Conversation[],
  projects: Project[],
  projectLinks: ProjectLink[],
  index: SearchEntry[],
  queryString: string,
  options: SearchOptions,
): SearchOutcome {
  const parsed = parseQuery(queryString)
  const matcher = compileTextMatcher(parsed.text, options.regexMode)
  if (matcher.error) return { results: [], regexError: matcher.error }

  const projectNameByUuid = new Map(projects.map((p) => [p.uuid, p.name]))
  const projectUuidByConversation = new Map(projectLinks.map((l) => [l.conversationUuid, l.projectUuid]))

  const fromTs = parsed.from ? toTimestamp(parsed.from, false) : null
  const toTs = parsed.to ? toTimestamp(parsed.to, true) : null

  const eligible = new Set<string>()
  for (const conversation of conversations) {
    const createdTs = Date.parse(conversation.createdAt)

    if (fromTs !== null && (Number.isNaN(createdTs) || createdTs < fromTs)) continue
    if (toTs !== null && (Number.isNaN(createdTs) || createdTs > toTs)) continue

    if (parsed.projectName) {
      const projectUuid = projectUuidByConversation.get(conversation.uuid)
      const name = projectUuid ? projectNameByUuid.get(projectUuid) : null
      if (!name || !name.toLowerCase().includes(parsed.projectName.toLowerCase())) continue
    }

    if (parsed.has.has('tools') && !conversationHasBlock(conversation, (kind) => kind === 'tool')) continue
    if (
      parsed.has.has('thinking') &&
      !conversationHasBlock(
        conversation,
        (kind, block) => kind === 'thinking' && ((block as { summaries: string[] }).summaries.length > 0),
      )
    )
      continue
    if (
      parsed.has.has('sources') &&
      !conversationHasBlock(
        conversation,
        (kind, block) => kind === 'tool' && (block as { sources: unknown[] }).sources.length > 0,
      )
    )
      continue

    eligible.add(conversation.uuid)
  }

  const counts = new Map<string, number>()
  for (const entry of index) {
    if (!eligible.has(entry.conversationUuid)) continue

    if (parsed.tool) {
      if (entry.blockKind !== 'tool' || entry.toolName !== parsed.tool) continue
    } else {
      if (entry.blockKind === 'thinking' && !options.scope.thinking) continue
      if (entry.blockKind === 'tool' && !options.scope.toolResults) continue
    }

    if (!matcher.test(entry.text)) continue
    counts.set(entry.conversationUuid, (counts.get(entry.conversationUuid) ?? 0) + 1)
  }

  const noTextCondition = !parsed.text && !parsed.tool
  const results: SearchResult[] = noTextCondition
    ? [...eligible].map((uuid) => ({ conversationUuid: uuid, matchCount: counts.get(uuid) ?? 0 }))
    : [...counts].map(([conversationUuid, matchCount]) => ({ conversationUuid, matchCount }))

  return { results, regexError: null }
}
