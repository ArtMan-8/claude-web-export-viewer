import { beforeAll, describe, expect, test } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import i18next from 'i18next'
import '~/i18n/config'
import type { Archive } from '~/lib/archive/model'
import { normalizeConversation, normalizeProject } from '~/lib/archive/normalize'
import { makeConversation, makeMessage, makeProject, textBlock } from '~/test-fixtures/fixtures'
import { buildFullExportZip } from './zip-all'

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

describe('buildFullExportZip', () => {
  beforeAll(async () => {
    await i18next.changeLanguage('ru')
  })

  test('удалённые беседы и проекты не попадают в файлы, но перечислены в index.md', () => {
    const live = normalizeConversation(
      makeConversation({ uuid: 'c-live', name: 'Живая', chat_messages: [makeMessage({ content: [textBlock('Привет')] })] }),
    )
    const deleted = normalizeConversation(
      makeConversation({
        uuid: 'c-deleted',
        name: '',
        updated_at: '2026-09-18T16:57:00Z',
        chat_messages: [makeMessage({ text: '', content: [] })],
      }),
    )
    const liveProject = normalizeProject(
      makeProject({ uuid: 'p-live', name: 'Проект', docs: [{ uuid: 'd1', filename: 'a.md', content: 'текст', created_at: '' }] }),
    )
    const deletedProject = normalizeProject(
      makeProject({ uuid: 'p-deleted', name: '', docs: [{ uuid: 'd2', filename: '', content: '', created_at: '' }] }),
    )

    const zip = unzipSync(
      buildFullExportZip(makeArchive({ conversations: [live, deleted], projects: [liveProject, deletedProject] }), {
        includeTools: false,
      }),
    )
    const names = Object.keys(zip)

    expect(names.filter((n) => n.startsWith('conversations/'))).toHaveLength(1)
    expect(names.filter((n) => n.startsWith('projects/'))).toEqual(['projects/проект/a.md'])

    const index = strFromU8(zip['index.md'])
    expect(index).toContain('## Удалённые')
    expect(index).toContain('| Беседа | `c-deleted` | 2026-01-01 | 2026-09-18 | 1 |')
    expect(index).toContain('| Проект | `p-deleted` |')
    expect(index).not.toContain('Без названия')
  })

  test('артефакты: html каждой версии в artifacts/<slug>/<version>.html и раздел в index.md', () => {
    const archive = makeArchive({
      artifacts: [
        {
          id: 'art-1',
          visibility: 'public',
          ownerAccountUuid: 'a',
          updatedAt: '2026-08-29T18:16:25+00:00',
          activeVersionId: 'v2',
          title: 'Хакатонный радар',
          versions: [
            { id: 'v2', title: 'Хакатонный радар', description: '', createdAt: '2026-08-29T12:18:22+00:00', html: '<p>v2</p>' },
            { id: 'v1', title: 'Хакатонный радар', description: '', createdAt: '2026-08-29T11:54:12+00:00', html: null },
          ],
        },
      ],
    })

    const zip = unzipSync(buildFullExportZip(archive, { includeTools: false }))

    expect(Object.keys(zip).filter((n) => n.startsWith('artifacts/'))).toEqual(['artifacts/хакатонный-радар/v2.html'])
    expect(strFromU8(zip['artifacts/хакатонный-радар/v2.html'])).toBe('<p>v2</p>')
    const index = strFromU8(zip['index.md'])
    expect(index).toContain('## Артефакты')
    expect(index).toContain('- Хакатонный радар (2 версий): [2026-08-29](artifacts/хакатонный-радар/v2.html)')
  })

  test('без удалённых записей раздела «Удалённые» в index.md нет', () => {
    const live = normalizeConversation(
      makeConversation({ uuid: 'c-live', chat_messages: [makeMessage({ content: [textBlock('Привет')] })] }),
    )
    const zip = unzipSync(buildFullExportZip(makeArchive({ conversations: [live] }), { includeTools: false }))
    expect(strFromU8(zip['index.md'])).not.toContain('## Удалённые')
  })
})
