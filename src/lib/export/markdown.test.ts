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

  it('рендерит command: фрагмент кода команды + код возврата и вывод результата', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [
              toolUseBlock('t1', 'bash_tool', { command: 'ls -la', description: '' }),
              toolResultBlock('t1', 'bash_tool', {
                content: [{ type: 'text', text: JSON.stringify({ returncode: 0, stdout: 'файл.txt', stderr: '' }) }],
              }),
            ],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: true })
    expect(markdown).toContain('```\nls -la\n```')
    expect(markdown).toContain('код возврата: 0')
    expect(markdown).toContain('файл.txt')
  })

  it('рендерит fileEdit: путь и diff-блок с удалённым/добавленным текстом', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [toolUseBlock('t1', 'str_replace', { description: '', path: 'a.md', old_str: 'было', new_str: 'стало' })],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: true })
    expect(markdown).toContain('`a.md`')
    expect(markdown).toContain('```diff')
    expect(markdown).toContain('- было')
    expect(markdown).toContain('+ стало')
  })

  it('рендерит fileRead: путь и диапазон строк', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [toolUseBlock('t1', 'view', { description: '', path: 'a.md', view_range: [1, 10] })],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: true })
    expect(markdown).toContain('`a.md` (1–10)')
  })

  it('рендерит fetch и query строкой без обёртки', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [
              toolUseBlock('t1', 'web_fetch', { url: 'https://example.com' }),
              toolResultBlock('t1', 'web_fetch'),
            ],
          }),
          makeMessage({
            sender: 'assistant',
            content: [toolUseBlock('t2', 'web_search', { query: 'тестовый запрос' }), toolResultBlock('t2', 'web_search')],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: true })
    expect(markdown).toContain('https://example.com')
    expect(markdown).toContain('тестовый запрос')
  })

  it('рендерит sources: список ссылок с датой публикации', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [
              toolUseBlock('t1', 'web_search', { query: 'тест' }),
              toolResultBlock('t1', 'web_search', {
                content: [
                  {
                    type: 'knowledge',
                    title: 'Заголовок',
                    url: 'https://example.com',
                    prompt_context_metadata: { age: 'October 24, 2024' },
                  },
                ],
              }),
            ],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: true })
    expect(markdown).toContain('- [Заголовок](https://example.com) — October 24, 2024')
  })

  it('рендерит files-результат present_files ссылкой на раздел «Файлы»', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [toolUseBlock('t1', 'create_file', { description: '', path: 'a.md', file_text: 'содержимое' })],
          }),
          makeMessage({
            sender: 'assistant',
            content: [
              toolUseBlock('t2', 'present_files', { filepaths: ['a.md'] }),
              toolResultBlock('t2', 'present_files', {
                content: [{ type: 'local_resource', path: 'a.md', name: 'a.md', uuid: 'f1' }],
              }),
            ],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: true })
    expect(markdown).toContain('[`a.md`](#amd)')
  })

  it('раздел «Файлы» — всегда в конце документа, с полным содержимым, независимо от includeTools', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [toolUseBlock('t1', 'create_file', { description: '', path: 'a.md', file_text: 'полное содержимое файла' })],
          }),
        ],
      }),
    )

    const withoutTools = conversationToMarkdown(conversation, { includeTools: false })
    expect(withoutTools).toContain('## Файлы')
    expect(withoutTools).toContain('### a.md')
    expect(withoutTools).toContain('полное содержимое файла')
  })

  it('при includeTools: true содержимое create_file печатается ровно один раз — блок инструмента даёт только якорь', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [toolUseBlock('t1', 'create_file', { description: '', path: 'a.md', file_text: 'уникальное_содержимое_файла' })],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: true })
    const occurrences = markdown.split('уникальное_содержимое_файла').length - 1
    expect(occurrences).toBe(1)
    expect(markdown).toContain('[`a.md`](#amd)')
  })

  it('реконструкция с ошибкой показывает пояснение в разделе «Файлы» вместо содержимого', () => {
    const conversation = normalizeConversation(
      makeConversation({
        chat_messages: [
          makeMessage({
            sender: 'assistant',
            content: [toolUseBlock('t1', 'str_replace', { description: '', path: 'a.md', old_str: 'x', new_str: 'y' })],
          }),
        ],
      }),
    )

    const markdown = conversationToMarkdown(conversation, { includeTools: false })
    expect(markdown).toContain('правка без исходного файла')
  })
})
