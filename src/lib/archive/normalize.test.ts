import { describe, expect, it } from 'vitest'
import { makeConversation, makeMessage, makeProject, textBlock, toolResultBlock, toolUseBlock } from '@/test-fixtures/fixtures'
import { collectConversationFiles, normalizeConversation, normalizeProject, parseToolCall, parseToolResult } from './normalize'
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
      isPaired: true,
      isError: false,
    })
    if (block.kind === 'tool') {
      expect(block.result).toEqual({
        kind: 'sources',
        sources: [
          {
            title: 'Заголовок',
            url: 'https://example.com',
            finalUrl: null,
            domain: 'example.com',
            siteName: null,
            faviconUrl: null,
            publishedAt: null,
            snippet: 'сниппет',
            isMissing: false,
            isCitable: false,
          },
        ],
      })
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
    expect(resultEmpty.name).toBe('')
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

describe('parseToolCall', () => {
  it('filePresent: filepaths[]', () => {
    expect(parseToolCall({ filepaths: ['a.md', 'b.md'] }, null)).toEqual({ kind: 'filePresent', paths: ['a.md', 'b.md'] })
  })

  it('fileEdit: description + old_str + new_str + path', () => {
    expect(parseToolCall({ description: 'правка', old_str: 'было', new_str: 'стало', path: 'a.md' }, null)).toEqual({
      kind: 'fileEdit',
      path: 'a.md',
      oldText: 'было',
      newText: 'стало',
      description: 'правка',
    })
  })

  it('fileWrite: description + file_text + path, язык из display_content', () => {
    const result = parseToolCall(
      { description: 'создание', file_text: 'содержимое', path: 'src/a.py' },
      { type: 'json_block', language: 'python' },
    )
    expect(result).toEqual({ kind: 'fileWrite', path: 'src/a.py', text: 'содержимое', language: 'python', description: 'создание' })
  })

  it('fileWrite: язык по расширению пути, если display_content нет', () => {
    const result = parseToolCall({ description: '', file_text: 'x', path: 'a.ts' }, null)
    expect(result).toMatchObject({ kind: 'fileWrite', language: 'typescript' })
  })

  it('command: command + description', () => {
    expect(parseToolCall({ command: 'ls -la', description: 'листинг' }, null)).toEqual({
      kind: 'command',
      command: 'ls -la',
      description: 'листинг',
      language: null,
    })
  })

  it('fetch: url', () => {
    expect(parseToolCall({ url: 'https://example.com' }, null)).toEqual({ kind: 'fetch', url: 'https://example.com' })
  })

  it('query: query [,max_text_results]', () => {
    expect(parseToolCall({ query: 'тест', max_text_results: 5 }, null)).toEqual({ kind: 'query', query: 'тест', maxResults: 5 })
  })

  it('fileRead: description + path [,view_range]', () => {
    expect(parseToolCall({ description: 'чтение', path: 'a.md', view_range: [1, 10] }, null)).toEqual({
      kind: 'fileRead',
      path: 'a.md',
      range: [1, 10],
      description: 'чтение',
    })
  })

  it('raw: незнакомая форма input', () => {
    expect(parseToolCall({ foo: 'bar' }, null)).toEqual({ kind: 'raw', input: { foo: 'bar' } })
  })
})

describe('parseToolResult', () => {
  it('command: единственный текстовый фрагмент — валидный JSON {returncode, stdout, stderr}', () => {
    const rawText = JSON.stringify({ returncode: 0, stdout: 'ok', stderr: '' })
    expect(parseToolResult([{ type: 'text', text: rawText }], null)).toEqual({
      kind: 'command',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      rawText,
    })
  })

  it('command: невалидный JSON («invalid UTF-8») даёт фолбэк на text, а не падает', () => {
    const rawText = 'Command output contains invalid UTF-8 data'
    expect(parseToolResult([{ type: 'text', text: rawText }], null)).toEqual({
      kind: 'text',
      text: rawText,
      fragments: [rawText],
    })
  })

  it('files: элементы local_resource', () => {
    const result = parseToolResult(
      [{ type: 'local_resource', path: 'src/a.md', name: 'a.md', mime_type: 'text/markdown', uuid: 'file-1' }],
      null,
    )
    expect(result).toEqual({
      kind: 'files',
      files: [{ path: 'src/a.md', name: 'a.md', mimeType: 'text/markdown', uuid: 'file-1' }],
    })
  })

  it('sources: элементы knowledge с полным набором метаданных', () => {
    const result = parseToolResult(
      [
        {
          type: 'knowledge',
          title: 'Заголовок',
          url: 'https://example.com/page',
          text: 'сниппет',
          is_missing: false,
          is_citable: true,
          metadata: { site_domain: 'example.com', site_name: 'Example', favicon_url: 'https://example.com/favicon.ico' },
          prompt_context_metadata: { age: 'October 24, 2024', final_url: 'https://example.com/page?utm=1' },
        },
      ],
      null,
    )
    expect(result).toEqual({
      kind: 'sources',
      sources: [
        {
          title: 'Заголовок',
          url: 'https://example.com/page',
          finalUrl: 'https://example.com/page?utm=1',
          domain: 'example.com',
          siteName: 'Example',
          faviconUrl: 'https://example.com/favicon.ico',
          publishedAt: 'October 24, 2024',
          snippet: 'сниппет',
          isMissing: false,
          isCitable: true,
        },
      ],
    })
  })

  it('text: обычный текстовый результат без JSON-формы', () => {
    expect(parseToolResult([{ type: 'text', text: 'просто текст' }], null)).toEqual({
      kind: 'text',
      text: 'просто текст',
      fragments: ['просто текст'],
    })
  })

  it('none: пустой результат без content и без rich_link', () => {
    expect(parseToolResult(null, null)).toEqual({ kind: 'none' })
  })
})

describe('collectConversationFiles (через normalizeConversation)', () => {
  it('воспроизводит файл, правившийся трижды', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t1', 'create_file', { description: '', path: 'a.md', file_text: 'v0' })],
        }),
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t2', 'str_replace', { description: '', path: 'a.md', old_str: 'v0', new_str: 'v1' })],
        }),
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t3', 'str_replace', { description: '', path: 'a.md', old_str: 'v1', new_str: 'v2' })],
        }),
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t4', 'str_replace', { description: '', path: 'a.md', old_str: 'v2', new_str: 'v3' })],
        }),
      ],
    })

    const result = normalizeConversation(conversation)
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({ path: 'a.md', content: 'v3', reconstructionError: null, finalSize: 2 })
    expect(result.files[0].revisions).toHaveLength(4)
  })

  it('noCreate: правка без предшествующего create_file', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t1', 'str_replace', { description: '', path: 'a.md', old_str: 'x', new_str: 'y' })],
        }),
      ],
    })
    const result = normalizeConversation(conversation)
    expect(result.files[0]).toMatchObject({ content: null, reconstructionError: 'noCreate' })
  })

  it('missingEdit: old_str не встречается в текущем содержимом', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t1', 'create_file', { description: '', path: 'a.md', file_text: 'привет' })],
        }),
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t2', 'str_replace', { description: '', path: 'a.md', old_str: 'нет такого', new_str: 'y' })],
        }),
      ],
    })
    const result = normalizeConversation(conversation)
    expect(result.files[0]).toMatchObject({ content: null, reconstructionError: 'missingEdit' })
  })

  it('ambiguousEdit: old_str встречается более одного раза', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t1', 'create_file', { description: '', path: 'a.md', file_text: 'а а а' })],
        }),
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t2', 'str_replace', { description: '', path: 'a.md', old_str: 'а', new_str: 'б' })],
        }),
      ],
    })
    const result = normalizeConversation(conversation)
    expect(result.files[0]).toMatchObject({ content: null, reconstructionError: 'ambiguousEdit' })
  })

  it('present_files помечает файл как предъявленный и обогащает имя/mime из local_resource', () => {
    const conversation = makeConversation({
      chat_messages: [
        makeMessage({
          sender: 'assistant',
          content: [toolUseBlock('t1', 'create_file', { description: '', path: 'a.md', file_text: 'текст' })],
        }),
        makeMessage({
          sender: 'assistant',
          content: [
            toolUseBlock('t2', 'present_files', { filepaths: ['a.md'] }),
            toolResultBlock('t2', 'present_files', {
              content: [{ type: 'local_resource', path: 'a.md', name: 'a.md', mime_type: 'text/markdown', uuid: 'f1' }],
            }),
          ],
        }),
      ],
    })
    const result = normalizeConversation(conversation)
    expect(result.files[0]).toMatchObject({ isPresented: true, name: 'a.md', mimeType: 'text/markdown' })
  })

  it('collectConversationFiles напрямую: беседа без файловых операций даёт пустой список', () => {
    expect(collectConversationFiles([makeMessage({ content: [textBlock('привет')] })])).toEqual([])
  })
})
