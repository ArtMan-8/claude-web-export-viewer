import type { Archive } from './model'

export interface ToolUsage {
  name: string
  count: number
}

export interface ArchiveStats {
  conversationCount: number
  /** Пустые беседы без учёта удалённых — те считаются отдельно */
  emptyConversationCount: number
  messageCount: number
  dateRange: { from: string; to: string } | null
  topTools: ToolUsage[]
  projectCount: number
  docCount: number
  docsCharacters: number
  fileCount: number
  /** Удалённые записи (§4.1 плана 2026-09): скелеты без содержимого, показываются только на дашборде */
  deletedConversationCount: number
  deletedMessageCount: number
  deletedProjectCount: number
  deletedDocCount: number
}

export function computeStats(archive: Archive): ArchiveStats {
  let messageCount = 0
  let minDate: string | null = null
  let maxDate: string | null = null
  let fileCount = 0
  let conversationCount = 0
  let emptyConversationCount = 0
  let deletedConversationCount = 0
  let deletedMessageCount = 0
  const toolCounts = new Map<string, number>()

  // Удалённые записи не входят в основные счётчики: читалка их не показывает,
  // а их сообщения и документы — пустые скелеты. Они считаются отдельно.
  for (const conversation of archive.conversations) {
    if (conversation.isDeleted) {
      deletedConversationCount += 1
      deletedMessageCount += conversation.messages.length
      continue
    }
    conversationCount += 1
    if (conversation.isEmpty) emptyConversationCount += 1
    messageCount += conversation.messages.length
    fileCount += conversation.files.length

    for (const date of [conversation.createdAt, conversation.updatedAt]) {
      if (!date) continue
      if (minDate === null || date < minDate) minDate = date
      if (maxDate === null || date > maxDate) maxDate = date
    }

    for (const message of conversation.messages) {
      for (const block of message.blocks) {
        if (block.kind === 'tool') {
          toolCounts.set(block.name, (toolCounts.get(block.name) ?? 0) + 1)
        }
      }
    }
  }

  const topTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  let projectCount = 0
  let docCount = 0
  let docsCharacters = 0
  let deletedProjectCount = 0
  let deletedDocCount = 0
  for (const project of archive.projects) {
    if (project.isDeleted) {
      deletedProjectCount += 1
      deletedDocCount += project.rawDocCount
      continue
    }
    projectCount += 1
    docCount += project.docs.length
    for (const doc of project.docs) docsCharacters += doc.content.length
  }

  return {
    conversationCount,
    emptyConversationCount,
    messageCount,
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    topTools,
    projectCount,
    docCount,
    docsCharacters,
    fileCount,
    deletedConversationCount,
    deletedMessageCount,
    deletedProjectCount,
    deletedDocCount,
  }
}
