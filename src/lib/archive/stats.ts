import type { Archive } from './model'

export interface ToolUsage {
  name: string
  count: number
}

export interface ArchiveStats {
  conversationCount: number
  emptyConversationCount: number
  messageCount: number
  dateRange: { from: string; to: string } | null
  topTools: ToolUsage[]
  projectCount: number
  docCount: number
  docsCharacters: number
}

export function computeStats(archive: Archive): ArchiveStats {
  let messageCount = 0
  let minDate: string | null = null
  let maxDate: string | null = null
  const toolCounts = new Map<string, number>()

  for (const conversation of archive.conversations) {
    messageCount += conversation.messages.length

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

  let docCount = 0
  let docsCharacters = 0
  for (const project of archive.projects) {
    docCount += project.docs.length
    for (const doc of project.docs) docsCharacters += doc.content.length
  }

  return {
    conversationCount: archive.conversations.length,
    emptyConversationCount: archive.conversations.filter((c) => c.isEmpty).length,
    messageCount,
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    topTools,
    projectCount: archive.projects.length,
    docCount,
    docsCharacters,
  }
}
