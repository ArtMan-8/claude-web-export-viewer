import { describe, expect, test } from 'vitest'
import { makeConversation, makeMessage, makeProject, textBlock, toolResultBlock, toolUseBlock } from '~/test-fixtures/fixtures'
import { normalizeConversation, normalizeProject } from '~/lib/archive/normalize'
import { buildDocIndex, buildSearchIndex, runProjectSearch, runSearch } from './index'

describe('buildSearchIndex / runSearch', () => {
  test('индексирует только text-блоки — thinking и tool не попадают в индекс', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [
              textBlock('дневник сновидений'),
              { type: 'thinking', thinking: '', summaries: [{ summary: 'дневник сновидений в размышлении' }] },
              toolUseBlock('t1', 'web_search', { query: 'дневник сновидений' }),
              toolResultBlock('t1', 'web_search', { content: [{ type: 'text', text: 'дневник сновидений в результате' }] }),
            ] as never,
          }),
        ],
      }),
    )

    const index = buildSearchIndex([conversation])
    expect(index).toHaveLength(1)
    expect(index[0].text).toBe('дневник сновидений')

    expect(runSearch(index, 'дневник сновидений')).toEqual([{ conversationUuid: conversation.uuid, matchCount: 1 }])
  })

  test('пустой запрос не возвращает результатов', () => {
    const conversation = normalizeConversation(makeConversation({ chat_messages: [makeMessage({ content: [textBlock('текст')] })] }))
    expect(runSearch(buildSearchIndex([conversation]), '')).toEqual([])
  })
})

describe('buildDocIndex / runProjectSearch', () => {
  test('находит проект по содержимому документа, счётчик — число совпавших документов', () => {
    const project = normalizeProject(
      makeProject({
        uuid: 'p1',
        docs: [
          { uuid: 'd1', filename: 'a.md', content: 'дневник сновидений', created_at: '' },
          { uuid: 'd2', filename: 'b.md', content: 'дневник сновидений тоже здесь', created_at: '' },
          { uuid: 'd3', filename: 'c.md', content: 'ничего похожего', created_at: '' },
        ],
      }),
    )

    const results = runProjectSearch([project], buildDocIndex([project]), 'дневник сновидений')
    expect(results).toEqual([{ projectUuid: 'p1', matchCount: 2 }])
  })

  test('находит проект по имени или описанию даже без совпавших документов', () => {
    const project = normalizeProject(makeProject({ uuid: 'p1', name: 'Дневник снов', docs: [] }))
    const results = runProjectSearch([project], buildDocIndex([project]), 'дневник снов')
    expect(results).toEqual([{ projectUuid: 'p1', matchCount: 0 }])
  })

  test('пустой запрос не возвращает результатов', () => {
    const project = normalizeProject(makeProject({ uuid: 'p1' }))
    expect(runProjectSearch([project], buildDocIndex([project]), '')).toEqual([])
  })
})
