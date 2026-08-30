import { describe, expect, test } from 'vitest'
import { linkProjectsToConversations } from './link-projects'
import { normalizeConversation, normalizeProject } from './normalize'
import { makeConversation, makeMessage, makeProject, toolResultBlock, toolUseBlock } from '~/test-fixtures/fixtures'

function conversationWithSearchHits(uuid: string, fragments: string[]) {
  return normalizeConversation(
    makeConversation({
      uuid,
      chat_messages: [
        makeMessage({
          sender: 'assistant',
          content: [
            toolUseBlock('t1', 'project_knowledge_search'),
            toolResultBlock('t1', 'project_knowledge_search', {
              content: fragments.map((text) => ({ type: 'text', text })),
            }),
          ],
        }),
      ],
    }),
  )
}

describe('linkProjectsToConversations', () => {
  test('находит проект по совпадению путей документов в project_knowledge_search', () => {
    const project = normalizeProject(
      makeProject({ uuid: 'p1', docs: [{ uuid: 'd1', filename: 'claude/skeleton.md', content: '...', created_at: '' }] }),
    )
    const conversation = conversationWithSearchHits('c1', ['claude/skeleton.md\nостальной текст'])

    const links = linkProjectsToConversations([conversation], [project])

    expect(links).toEqual([{ conversationUuid: 'c1', projectUuid: 'p1', matchCount: 1 }])
  })

  test('не создаёт связь, если совпадений нет', () => {
    const project = normalizeProject(makeProject({ uuid: 'p1', docs: [{ uuid: 'd1', filename: 'a.md', content: '', created_at: '' }] }))
    const conversation = conversationWithSearchHits('c1', ['b.md\nтекст'])

    expect(linkProjectsToConversations([conversation], [project])).toEqual([])
  })

  test('не гадает при ничьей между двумя проектами', () => {
    const p1 = normalizeProject(makeProject({ uuid: 'p1', docs: [{ uuid: 'd1', filename: 'a.md', content: '', created_at: '' }] }))
    const p2 = normalizeProject(makeProject({ uuid: 'p2', docs: [{ uuid: 'd2', filename: 'b.md', content: '', created_at: '' }] }))
    const conversation = conversationWithSearchHits('c1', ['a.md\nтекст', 'b.md\nтекст'])

    expect(linkProjectsToConversations([conversation], [p1, p2])).toEqual([])
  })

  test('игнорирует совпадение, если один и тот же filename встречается в нескольких проектах', () => {
    const p1 = normalizeProject(makeProject({ uuid: 'p1', docs: [{ uuid: 'd1', filename: 'shared.md', content: '', created_at: '' }] }))
    const p2 = normalizeProject(makeProject({ uuid: 'p2', docs: [{ uuid: 'd2', filename: 'shared.md', content: '', created_at: '' }] }))
    const conversation = conversationWithSearchHits('c1', ['shared.md\nтекст'])

    expect(linkProjectsToConversations([conversation], [p1, p2])).toEqual([])
  })
})
