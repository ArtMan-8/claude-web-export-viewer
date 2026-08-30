import type { Conversation, Project } from '@/lib/archive/model'
import { matchesQuery, normalizeQuery } from './query'

export interface SearchEntry {
  conversationUuid: string
  messageUuid: string
  createdAt: string
  text: string
}

/** Индекс строится по text-блокам диалога (Q21) — размышления и результаты инструментов не индексируются. */
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
            text: block.text,
          })
        }
      }
    }
  }

  return entries
}

export interface SearchResult {
  conversationUuid: string
  matchCount: number
}

/** Ищет по тексту диалога: беседа попадает в результат, если хотя бы один её text-блок совпал. */
export function runSearch(index: SearchEntry[], query: string): SearchResult[] {
  const needle = normalizeQuery(query)
  if (!needle) return []

  const counts = new Map<string, number>()
  for (const entry of index) {
    if (!matchesQuery(entry.text, needle)) continue
    counts.set(entry.conversationUuid, (counts.get(entry.conversationUuid) ?? 0) + 1)
  }

  return [...counts].map(([conversationUuid, matchCount]) => ({ conversationUuid, matchCount }))
}

export interface DocSearchEntry {
  projectUuid: string
  docUuid: string
  filename: string
  text: string
}

export function buildDocIndex(projects: Project[]): DocSearchEntry[] {
  const entries: DocSearchEntry[] = []
  for (const project of projects) {
    for (const doc of project.docs) {
      entries.push({ projectUuid: project.uuid, docUuid: doc.uuid, filename: doc.filename, text: doc.content })
    }
  }
  return entries
}

export interface ProjectSearchResult {
  projectUuid: string
  /** Число совпавших документов — не считает совпадение по имени/описанию проекта */
  matchCount: number
}

/**
 * Ищет проекты по имени, описанию и содержимому документов (U3) — тем же
 * матчером, что и беседы. Проект попадает в результат при совпадении по
 * любому из трёх, но счётчик на карточке отражает только документы.
 */
export function runProjectSearch(projects: Project[], docIndex: DocSearchEntry[], query: string): ProjectSearchResult[] {
  const needle = normalizeQuery(query)
  if (!needle) return []

  const docMatchCounts = new Map<string, number>()
  for (const entry of docIndex) {
    if (!matchesQuery(entry.filename, needle) && !matchesQuery(entry.text, needle)) continue
    docMatchCounts.set(entry.projectUuid, (docMatchCounts.get(entry.projectUuid) ?? 0) + 1)
  }

  const results: ProjectSearchResult[] = []
  for (const project of projects) {
    const matchCount = docMatchCounts.get(project.uuid) ?? 0
    const matchesProjectItself = matchesQuery(project.name, needle) || matchesQuery(project.description, needle)
    if (matchCount > 0 || matchesProjectItself) results.push({ projectUuid: project.uuid, matchCount })
  }
  return results
}
