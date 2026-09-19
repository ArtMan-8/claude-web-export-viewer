import { strToU8, zipSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import { makeConversation, makeProject } from '~/test-fixtures/fixtures'
import { loadRawArchive, type RawFileInput } from './load'

function jsonFile(name: string, data: unknown): RawFileInput {
  return { name, bytes: strToU8(JSON.stringify(data)) }
}

function zipFile(name: string, entries: Record<string, unknown>): RawFileInput {
  const zipped: Record<string, Uint8Array> = {}
  for (const [entryName, data] of Object.entries(entries)) {
    // строки кладутся как есть (html артефактов), остальное — как JSON
    zipped[entryName] = strToU8(typeof data === 'string' ? data : JSON.stringify(data))
  }
  return { name, bytes: zipSync(zipped) }
}

const artifactMeta = {
  id: 'art-1',
  kind: 'artifact',
  visibility: 'public',
  owner_account: 'account-1',
  updated_at: '2026-08-29T18:16:25+00:00',
  active_version: 'v2',
  versions: [
    { id: 'v2', title: 'Радар', description: 'Радар', created_at: '2026-08-29T12:18:22+00:00' },
    { id: 'v1', title: 'Радар', description: 'Первая версия', created_at: '2026-08-29T11:54:12+00:00' },
  ],
}

describe('loadRawArchive', () => {
  test('читает conversations.json и projects/*.json из zip-архивов', () => {
    const conversationsZip = zipFile('conversations-000.zip', {
      'conversations.json': [makeConversation({ uuid: 'a' }), makeConversation({ uuid: 'b' })],
    })
    const projectsZip = zipFile('projects-000.zip', {
      'projects/p1.json': makeProject({ uuid: 'p1' }),
    })

    const result = loadRawArchive([conversationsZip, projectsZip])

    expect(result.conversations.map((c) => c.uuid)).toEqual(['a', 'b'])
    expect(result.projects.map((p) => p.uuid)).toEqual(['p1'])
    expect(result.warnings).toEqual([])
  })

  test('читает users.json и login_history.json', () => {
    const metaZip = zipFile('light_metadata-000.zip', {
      'users.json': [{ uuid: 'u1', full_name: 'Тест', email_address: 't@example.com', verified_phone_number: null }],
      'login_history.json': {
        login_events: [
          {
            account_uuid: 'u1',
            timestamp: '2026-01-01T00:00:00Z',
            ip_address: '1.2.3.4',
            user_agent: {},
            method: 'magic_link',
            location_info: {},
          },
        ],
      },
    })

    const result = loadRawArchive([metaZip])

    expect(result.users).toHaveLength(1)
    expect(result.loginEvents).toHaveLength(1)
  })

  test('работает без манифеста, определяя тип файла по форме содержимого', () => {
    const result = loadRawArchive([jsonFile('conversations.json', [makeConversation()])])
    expect(result.conversations).toHaveLength(1)
  })

  test('поддерживает старый плоский формат: единый projects.json со списком проектов', () => {
    const result = loadRawArchive([jsonFile('projects.json', [makeProject({ uuid: 'p1' }), makeProject({ uuid: 'p2' })])])
    expect(result.projects.map((p) => p.uuid)).toEqual(['p1', 'p2'])
  })

  test('предупреждает о файле из манифеста, который не был загружен', () => {
    const manifest = jsonFile('manifest-x.json', {
      instructions: '',
      created_at: '',
      total_files: 2,
      version: '1.0',
      data_files: [
        { batch_index: 0, export_url: '', category: 'conversations', part: 0, filename: 'conversations-000.zip' },
        { batch_index: 1, export_url: '', category: 'projects', part: 0, filename: 'projects-000.zip' },
      ],
    })
    const conversationsZip = zipFile('conversations-000.zip', { 'conversations.json': [makeConversation()] })

    const result = loadRawArchive([manifest, conversationsZip])

    expect(result.warnings.some((w) => w.code === 'manifestEntryMissing' && w.params?.file === 'projects-000.zip')).toBe(
      true,
    )
  })

  test('не падает на битом JSON, а копит предупреждение и продолжает', () => {
    const broken: RawFileInput = { name: 'broken.json', bytes: strToU8('{ not json') }
    const good = jsonFile('conversations.json', [makeConversation()])

    const result = loadRawArchive([broken, good])

    expect(result.conversations).toHaveLength(1)
    expect(result.warnings.some((w) => w.code === 'jsonParseFailed' && w.params?.file === 'broken.json')).toBe(true)
  })

  test('бросает ошибку, если не найдено вообще ничего узнаваемого', () => {
    expect(() => loadRawArchive([jsonFile('random.json', { foo: 'bar' })])).toThrow()
  })

  test('frames: artifact.json и html версий читаются без предупреждений', () => {
    const framesZip = zipFile('frames-000.zip', {
      'artifacts/art-1/artifact.json': artifactMeta,
      'artifacts/art-1/versions/v1.html': '<!doctype html><p>v1</p>',
      'artifacts/art-1/versions/v2.html': '<!doctype html><p>v2</p>',
    })

    const result = loadRawArchive([framesZip])

    expect(result.artifacts).toEqual([{ path: 'artifacts/art-1/artifact.json', meta: artifactMeta }])
    expect([...result.artifactHtml.keys()].sort()).toEqual(['artifacts/art-1/versions/v1.html', 'artifacts/art-1/versions/v2.html'])
    expect(result.artifactHtml.get('artifacts/art-1/versions/v2.html')).toBe('<!doctype html><p>v2</p>')
    expect(result.warnings).toEqual([])
  })

  test('файл с незнакомым расширением внутри zip пропускается с предупреждением', () => {
    const zip = zipFile('frames-000.zip', {
      'artifacts/art-1/artifact.json': artifactMeta,
      'artifacts/art-1/preview.png': 'not really png',
    })

    const result = loadRawArchive([zip])
    expect(result.warnings).toEqual([{ code: 'fileSkipped', params: { file: 'frames-000.zip:artifacts/art-1/preview.png' } }])
  })
})
