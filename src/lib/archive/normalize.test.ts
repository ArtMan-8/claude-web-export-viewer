import { describe, expect, it } from 'vitest'
import { makeConversation, makeMessage, makeProject, textBlock, toolResultBlock, toolUseBlock } from '@/test-fixtures/fixtures'
import { normalizeConversation, normalizeProject } from './normalize'
import type { RawContentBlock } from './raw-types'

describe('normalizeConversation', () => {
  it('игнорирует мусорное плоское поле text и берёт контент только из content[]', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          sender: 'assistant',
          text: 'This block is not supported on your current device yet.',
          content: [textBlock('Настоящий ответ')],
        }),
      ],
    })

    const result = normalizeConversation(conversation)
    const block = result.messages[0].blocks[0]

    expect(block.kind).toBe('text')
    expect(block).toMatchObject({ text: 'Настоящий ответ' })
  })

  it('для thinking берёт summaries, а не пустое поле thinking', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          content: [
            {
              type: 'thinking',
              thinking: '',
              summaries: [{ summary: 'Кратко о ходе рассуждений' }],
              thinking_hidden: true,
            } as RawContentBlock,
          ],
        }),
      ],
    })

    const result = normalizeConversation(conversation)
    const block = result.messages[0].blocks[0]

    expect(block).toMatchObject({ kind: 'thinking', summaries: ['Кратко о ходе рассуждений'], text: '' })
  })

  it('схлопывает tool_use и tool_result в один блок tool', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          sender: 'assistant',
          content: [
            toolUseBlock('tool-1', 'web_search', { query: 'тест' }),
            toolResultBlock('tool-1', 'web_search', {
              content: [{ type: 'knowledge', title: 'Заголовок', url: 'https://example.com', text: 'сниппет' }],
            }),
          ],
        }),
      ],
    })

    const result = normalizeConversation(conversation)
    expect(result.messages[0].blocks).toHaveLength(1)

    const block = result.messages[0].blocks[0]
    expect(block).toMatchObject({
      kind: 'tool',
      name: 'web_search',
      label: 'Поиск в вебе',
      isPaired: true,
      isError: false,
    })
    if (block.kind === 'tool') {
      expect(block.sources).toEqual([
        { title: 'Заголовок', url: 'https://example.com', domain: 'example.com', snippet: 'сниппет', isMissing: false },
      ])
    }
  })

  it('неизвестный тип блока не роняет нормализацию, а даёт unknown', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          content: [{ type: 'from_the_future', payload: 42 } as unknown as RawContentBlock],
        }),
      ],
    })

    const result = normalizeConversation(conversation)
    expect(result.messages[0].blocks[0]).toMatchObject({ kind: 'unknown', blockType: 'from_the_future' })
  })

  it('помечает пустые сообщения и пустые беседы, не выбрасывая ошибку', () => {
    const emptyMessageConv = makeConversation({ chat_messages: [makeMessage({ text: '', content: [] })] })
    const result = normalizeConversation(emptyMessageConv)
    expect(result.messages[0].isEmpty).toBe(true)

    const emptyConv = makeConversation({ name: '', chat_messages: [] })
    const resultEmpty = normalizeConversation(emptyConv)
    expect(resultEmpty.isEmpty).toBe(true)
    expect(resultEmpty.displayName).toBe('Без названия')
  })

  it('беседа, где каждое сообщение пусто по отдельности, тоже считается пустой целиком', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({ sender: 'human', text: '', content: [] }),
        makeMessage({ sender: 'assistant', text: '', content: [] }),
        makeMessage({ sender: 'human', text: '', content: [] }),
        makeMessage({ sender: 'assistant', text: '', content: [] }),
      ],
    })

    const result = normalizeConversation(conversation)
    expect(result.messages).toHaveLength(4)
    expect(result.isEmpty).toBe(true)
  })

  it('беседа хотя бы с одним содержательным сообщением не считается пустой', () => {
    const conversation = makeConversation({
      chat_messages: [makeMessage({ text: '', content: [] }), makeMessage({ content: [textBlock('Привет')] })],
    })

    const result = normalizeConversation(conversation)
    expect(result.isEmpty).toBe(false)
  })

  it('превращает фиктивный parent_message_uuid корня в null', () => {
    const conversation = makeConversation({
      chat_messages: [makeMessage({ parent_message_uuid: '00000000-0000-4000-8000-000000000000' })],
    })
    const result = normalizeConversation(conversation)
    expect(result.messages[0].parentUuid).toBeNull()
  })
})

describe('normalizeProject', () => {
  it('отфильтровывает документы-заглушки без имени и содержимого', () => {
    const project = normalizeProject(
      makeProject({
        docs: [
          { uuid: 'd1', filename: '', content: '', created_at: '' },
          { uuid: 'd2', filename: 'a.md', content: 'текст', created_at: '' },
        ],
      }),
    )

    expect(project.docs.map((d) => d.uuid)).toEqual(['d2'])
  })

  it('проект без документов, описания и инструкций считается пустым', () => {
    const project = normalizeProject(
      makeProject({
        docs: [{ uuid: 'd1', filename: '', content: '', created_at: '' }],
        description: '',
        prompt_template: '',
      }),
    )

    expect(project.isEmpty).toBe(true)
  })

  it('проект без документов, но с описанием или инструкциями не считается пустым', () => {
    const withDescription = normalizeProject(makeProject({ docs: [], description: 'Что-то полезное' }))
    expect(withDescription.isEmpty).toBe(false)

    const withPrompt = normalizeProject(makeProject({ docs: [], description: '', prompt_template: 'Инструкции' }))
    expect(withPrompt.isEmpty).toBe(false)
  })

  it('проект с реальным документом не считается пустым', () => {
    const project = normalizeProject(
      makeProject({ docs: [{ uuid: 'd1', filename: 'a.md', content: 'текст', created_at: '' }] }),
    )
    expect(project.isEmpty).toBe(false)
  })
})
