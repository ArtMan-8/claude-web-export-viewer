import type { RawManifest, RawManifestDataFile } from './raw-types'

export type ArchiveCategory = 'light_metadata' | 'projects' | 'conversations'

/**
 * Один ожидаемый файл данных архива. `category` — категория как она есть в
 * манифесте: может быть неизвестной (формат экспорта нестабилен), тогда
 * load.ts определяет её по форме содержимого.
 */
export interface ManifestEntry {
  category: string
  part: number
  filename: string
}

export interface ParsedManifest {
  entries: ManifestEntry[]
  createdAt: string | null
}

export const KNOWN_CATEGORIES: ReadonlySet<ArchiveCategory> = new Set([
  'light_metadata',
  'projects',
  'conversations',
])

function isRawManifest(value: unknown): value is RawManifest {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Partial<RawManifest>).data_files)
  )
}

/**
 * Парсит manifest-*.json. Манифест — источник истины для имён файлов архива:
 * поле `part` означает, что при большом аккаунте будут conversations-001.zip
 * и т.д., поэтому имена никогда не хардкодятся в другом месте.
 */
export function parseManifest(json: unknown): ParsedManifest {
  if (!isRawManifest(json)) {
    throw new Error('Файл не похож на манифест экспорта claude.ai: нет поля data_files')
  }

  const entries: ManifestEntry[] = json.data_files
    .filter((file): file is RawManifestDataFile => Boolean(file?.filename && file?.category))
    .map((file) => ({
      category: file.category,
      part: file.part ?? 0,
      filename: file.filename,
    }))

  return { entries, createdAt: json.created_at ?? null }
}
