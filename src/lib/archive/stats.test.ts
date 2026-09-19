import { describe, expect, test } from 'vitest'
import { makeConversation, makeMessage, makeProject, textBlock } from '~/test-fixtures/fixtures'
import type { Archive } from './model'
import { normalizeConversation, normalizeProject } from './normalize'
import { computeStats } from './stats'

function makeArchive(overrides: Partial<Archive> = {}): Archive {
  return {
    conversations: [],
    projects: [],
    users: [],
    loginEvents: [],
    projectLinks: [],
    artifacts: [],
    warnings: [],
    exportedAt: null,
    ...overrides,
  }
}

describe('computeStats', () => {
  test('удалённые беседы и проекты считаются отдельно и не входят в основные счётчики', () => {
    const live = normalizeConversation(
      makeConversation({ uuid: 'c-live', chat_messages: [makeMessage({ content: [textBlock('Привет')] })] }),
    )
    const deleted = normalizeConversation(
      makeConversation({
        uuid: 'c-deleted',
        name: '',
        chat_messages: [makeMessage({ text: '', content: [] }), makeMessage({ text: '', content: [] })],
      }),
    )
    const emptyConv = normalizeConversation(makeConversation({ uuid: 'c-empty', chat_messages: [] }))

    const liveProject = normalizeProject(
      makeProject({ uuid: 'p-live', docs: [{ uuid: 'd1', filename: 'a.md', content: 'текст', created_at: '' }] }),
    )
    const deletedProject = normalizeProject(
      makeProject({
        uuid: 'p-deleted',
        name: '',
        docs: [
          { uuid: 'd2', filename: '', content: '', created_at: '' },
          { uuid: 'd3', filename: '', content: '', created_at: '' },
        ],
      }),
    )

    const stats = computeStats(
      makeArchive({ conversations: [live, deleted, emptyConv], projects: [liveProject, deletedProject] }),
    )

    expect(stats.conversationCount).toBe(2)
    expect(stats.messageCount).toBe(1)
    expect(stats.emptyConversationCount).toBe(1)
    expect(stats.deletedConversationCount).toBe(1)
    expect(stats.deletedMessageCount).toBe(2)

    expect(stats.projectCount).toBe(1)
    expect(stats.docCount).toBe(1)
    expect(stats.deletedProjectCount).toBe(1)
    expect(stats.deletedDocCount).toBe(2)
  })
})
