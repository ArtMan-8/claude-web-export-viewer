import { beforeAll, describe, expect, it } from 'vitest'
import i18next from 'i18next'
import '@/i18n/config'
import { normalizeConversation } from '@/lib/archive/normalize'
import { makeConversation, makeMessage, textBlock, toolResultBlock, toolUseBlock } from '@/test-fixtures/fixtures'
import { conversationToMarkdown } from './markdown'

describe('conversationToMarkdown', () => {
  beforeAll(async () => {
    await i18next.changeLanguage('ru')
  })

  it('рендерит frontmatter, реплики и сноски для цитат', () => {
    const conversation = normalizeConversation(
      makeConversation({
        uuid: 'conv-1',
        name: 'Тестовая беседа',
        chat_messages: [
          makeMessage({ sender: 'human', content: [textBlock('Привет')] }),
          makeMessage({
            sender: 'assistant',
            content: [
              textBlock('Ответ со ссылкой', [
                { uuid: 'c1', start_index: 0, end_index: 5, details: { type: 'web_search_citation', url: 'https://example.com' } },
              ]),
            ],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: false })

    expect(markdown).toContain('uuid: conv-1')
    expect(markdown).toContain('title: "Тестовая беседа"')
    expect(markdown).toContain('## Вы ·')
    expect(markdown).toContain('Привет')
    expect(markdown).toContain('## Claude ·')
    expect(markdown).toContain('Ответ со ссылкой [^1]')
    expect(markdown).toContain('[^1]: https://example.com')
  })

  it('скрывает блоки инструментов по умолчанию и показывает по флагу', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [toolUseBlock('t1', 'web_search', { query: 'тест' }), toolResultBlock('t1', 'web_search')],
          }),
        ],
      }),
    )

    const withoutTools = conversationToMarkdown(conversation, { includeTools: false })
    expect(withoutTools).not.toContain('<details>')

    const withTools = conversationToMarkdown(conversation, { includeTools: true })
    expect(withTools).toContain('<details>')
    expect(withTools).toContain('Поиск в вебе')
  })

  it('помечает пустые сообщения', () => {
    const conversation = normalizeConversation(makeConversation({ chat_messages: [makeMessage({ content: [] })] }))
    expect(conversationToMarkdown(conversation, { includeTools: false })).toContain('*(пустое сообщение)*')
  })

  it('беседа без названия получает заголовок "Без названия"', () => {
    const conversation = normalizeConversation(makeConversation({ name: '', chat_messages: [] }))
    const markdown = conversationToMarkdown(conversation, { includeTools: false })
    expect(markdown).toContain('title: "Без названия"')
    expect(markdown).toContain('# Без названия')
  })
})
