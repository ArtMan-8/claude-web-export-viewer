import { describe, expect, it } from 'vitest'
import { buildThread, resolveDisplayPath } from './thread'
import type { Message } from './model'

function msg(uuid: string, parentUuid: string | null, createdAt: string): Message {
  return { uuid, parentUuid, sender: 'human', createdAt, updatedAt: createdAt, blocks: [], isEmpty: true }
}

describe('buildThread', () => {
  it('линейная беседа возвращается как есть', () => {
    const messages = [
      msg('a', null, '2026-01-01T00:00:00Z'),
      msg('b', 'a', '2026-01-01T00:01:00Z'),
      msg('c', 'b', '2026-01-01T00:02:00Z'),
    ]

    const result = buildThread(messages)

    expect(result.fallbackToArrayOrder).toBe(false)
    expect(result.mainBranch.map((m) => m.uuid)).toEqual(['a', 'b', 'c'])
    expect(result.branches.size).toBe(0)
  })

  it('при ветвлении выбирает ветку с самой поздней активностью', () => {
    const messages = [
      msg('a', null, '2026-01-01T00:00:00Z'),
      // редактирование: у 'a' два ребёнка
      msg('b-old', 'a', '2026-01-01T00:01:00Z'),
      msg('b-new', 'a', '2026-01-01T00:02:00Z'),
      msg('c-new', 'b-new', '2026-01-01T00:03:00Z'),
    ]

    const result = buildThread(messages)

    expect(result.fallbackToArrayOrder).toBe(false)
    expect(result.mainBranch.map((m) => m.uuid)).toEqual(['a', 'b-new', 'c-new'])
    expect(result.branches.get('a')?.map((m) => m.uuid)).toEqual(['b-old', 'b-new'])
  })

  it('откатывается на порядок массива при цикле в parent_message_uuid', () => {
    const messages = [msg('a', 'b', '2026-01-01T00:00:00Z'), msg('b', 'a', '2026-01-01T00:01:00Z')]

    const result = buildThread(messages)

    expect(result.fallbackToArrayOrder).toBe(true)
    expect(result.warning).toBeTruthy()
    expect(result.mainBranch).toHaveLength(2)
  })

  it('откатывается на порядок массива при битой ссылке (сироте)', () => {
    const messages = [msg('a', null, '2026-01-01T00:00:00Z'), msg('b', 'no-such-parent', '2026-01-01T00:01:00Z')]

    const result = buildThread(messages)

    expect(result.fallbackToArrayOrder).toBe(true)
    expect(result.mainBranch).toHaveLength(2)
  })

  it('пустой список сообщений не падает', () => {
    const result = buildThread([])
    expect(result.mainBranch).toEqual([])
    expect(result.fallbackToArrayOrder).toBe(false)
  })
})

describe('resolveDisplayPath', () => {
  it('без переключений совпадает с главной веткой', () => {
    const messages = [
      msg('a', null, '2026-01-01T00:00:00Z'),
      msg('b-old', 'a', '2026-01-01T00:01:00Z'),
      msg('b-new', 'a', '2026-01-01T00:02:00Z'),
    ]
    const thread = buildThread(messages)
    expect(resolveDisplayPath(thread, {}).map((m) => m.uuid)).toEqual(['a', 'b-new'])
  })

  it('переключение на альтернативную ветку меняет хвост пути', () => {
    const messages = [
      msg('a', null, '2026-01-01T00:00:00Z'),
      msg('b-old', 'a', '2026-01-01T00:01:00Z'),
      msg('b-new', 'a', '2026-01-01T00:02:00Z'),
    ]
    const thread = buildThread(messages)
    expect(resolveDisplayPath(thread, { a: 'b-old' }).map((m) => m.uuid)).toEqual(['a', 'b-old'])
  })

  it('поддерживает вложенное переключение на второй развилке внутри альтернативной ветки', () => {
    const messages = [
      msg('a', null, '2026-01-01T00:00:00Z'),
      msg('b-old', 'a', '2026-01-01T00:01:00Z'),
      msg('b-new', 'a', '2026-01-01T00:02:00Z'),
      msg('c-old', 'b-old', '2026-01-01T00:03:00Z'),
      msg('c-new', 'b-old', '2026-01-01T00:04:00Z'),
    ]
    const thread = buildThread(messages)
    const path = resolveDisplayPath(thread, { a: 'b-old', 'b-old': 'c-old' })
    expect(path.map((m) => m.uuid)).toEqual(['a', 'b-old', 'c-old'])
  })

  it('в режиме фолбэка возвращает mainBranch как есть', () => {
    const messages = [msg('a', 'b', '2026-01-01T00:00:00Z'), msg('b', 'a', '2026-01-01T00:01:00Z')]
    const thread = buildThread(messages)
    expect(resolveDisplayPath(thread, { a: 'b' })).toEqual(thread.mainBranch)
  })
})
