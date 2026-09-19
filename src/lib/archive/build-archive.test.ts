import { strToU8, zipSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import { makeConversation } from '~/test-fixtures/fixtures'
import { buildArchive } from './build-archive'

function zipFile(name: string, entries: Record<string, string>) {
  const zipped: Record<string, Uint8Array> = {}
  for (const [entryName, data] of Object.entries(entries)) zipped[entryName] = strToU8(data)
  return { name, bytes: zipSync(zipped) }
}

describe('buildArchive', () => {
  test('html артефакта без artifact.json даёт предупреждение artifactMetaMissing', () => {
    const archive = buildArchive([
      zipFile('conversations-000.zip', { 'conversations.json': JSON.stringify([makeConversation()]) }),
      zipFile('frames-000.zip', { 'artifacts/orphan/versions/v1.html': '<p>x</p>' }),
    ])

    expect(archive.artifacts).toEqual([])
    expect(archive.warnings).toEqual([{ code: 'artifactMetaMissing', params: { file: 'artifacts/orphan/versions/v1.html' } }])
  })

  test('артефакт с версиями собирается в Archive.artifacts без предупреждений', () => {
    const meta = {
      id: 'art-1',
      kind: 'artifact',
      visibility: 'public',
      owner_account: 'a',
      updated_at: '2026-08-29T18:16:25+00:00',
      active_version: 'v1',
      versions: [{ id: 'v1', title: 'Радар', description: '', created_at: '2026-08-29T12:18:22+00:00' }],
    }
    const archive = buildArchive([
      zipFile('frames-000.zip', {
        'artifacts/art-1/artifact.json': JSON.stringify(meta),
        'artifacts/art-1/versions/v1.html': '<p>v1</p>',
      }),
    ])

    expect(archive.warnings).toEqual([])
    expect(archive.artifacts).toHaveLength(1)
    expect(archive.artifacts[0]).toMatchObject({ id: 'art-1', title: 'Радар', versions: [{ id: 'v1', html: '<p>v1</p>' }] })
  })
})
