import { describe, expect, test } from 'vitest'
import { parseManifest } from './manifest'

describe('parseManifest', () => {
  test('разбирает обычный манифест', () => {
    const manifest = parseManifest({
      instructions: '...',
      created_at: '2026-08-29T10:11:55.612791+00:00',
      total_files: 2,
      version: '1.0',
      data_files: [
        { batch_index: 0, export_url: 'https://x', category: 'conversations', part: 0, filename: 'conversations-000.zip' },
        { batch_index: 1, export_url: 'https://x', category: 'projects', part: 0, filename: 'projects-000.zip' },
      ],
    })

    expect(manifest.createdAt).toBe('2026-08-29T10:11:55.612791+00:00')
    expect(manifest.entries).toEqual([
      { category: 'conversations', part: 0, filename: 'conversations-000.zip' },
      { category: 'projects', part: 0, filename: 'projects-000.zip' },
    ])
  })

  test('поддерживает шардирование по part (несколько файлов одной категории)', () => {
    const manifest = parseManifest({
      instructions: '',
      created_at: '',
      total_files: 2,
      version: '1.0',
      data_files: [
        { batch_index: 0, export_url: '', category: 'conversations', part: 0, filename: 'conversations-000.zip' },
        { batch_index: 1, export_url: '', category: 'conversations', part: 1, filename: 'conversations-001.zip' },
      ],
    })

    expect(manifest.entries.map((e) => e.filename)).toEqual(['conversations-000.zip', 'conversations-001.zip'])
  })

  test('пропускает неизвестную категорию, а не отбрасывает файл', () => {
    const manifest = parseManifest({
      instructions: '',
      created_at: '',
      total_files: 1,
      version: '2.0',
      data_files: [{ batch_index: 0, export_url: '', category: 'memories', part: 0, filename: 'memories-000.zip' }],
    })

    expect(manifest.entries).toEqual([{ category: 'memories', part: 0, filename: 'memories-000.zip' }])
  })

  test('бросает ошибку, если это не манифест', () => {
    expect(() => parseManifest({ foo: 'bar' })).toThrow()
    expect(() => parseManifest(null)).toThrow()
    expect(() => parseManifest([1, 2, 3])).toThrow()
  })
})
