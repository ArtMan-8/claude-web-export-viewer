import { unzipSync } from 'fflate'
import { parseManifest } from './manifest'
import type {
  RawConversation,
  RawLoginEvent,
  RawProject,
  RawUser,
} from './raw-types'
import type { LoadWarning } from './model'

export interface RawFileInput {
  name: string
  bytes: Uint8Array
}

export interface LoadedRawData {
  conversations: RawConversation[]
  projects: RawProject[]
  users: RawUser[]
  loginEvents: RawLoginEvent[]
  manifestCreatedAt: string | null
  warnings: LoadWarning[]
}

const decoder = new TextDecoder('utf-8')

function isManifestFilename(name: string): boolean {
  return /^manifest-.*\.json$/i.test(name)
}

function isZipFilename(name: string): boolean {
  return /\.zip$/i.test(name)
}

/** Плоская конверсия «имя файла внутри архива → байты», из zip или напрямую. */
function collectJsonEntries(files: RawFileInput[], warnings: LoadWarning[]): RawFileInput[] {
  const entries: RawFileInput[] = []

  for (const file of files) {
    if (isManifestFilename(file.name)) continue

    if (isZipFilename(file.name)) {
      try {
        const unzipped = unzipSync(file.bytes)
        for (const [innerName, bytes] of Object.entries(unzipped)) {
          if (innerName.endsWith('/')) continue // директория
          if (bytes.length === 0) continue
          entries.push({ name: `${file.name}:${innerName}`, bytes })
        }
      } catch (error) {
        warnings.push({
          message: `Не удалось распаковать ${file.name}`,
          detail: error instanceof Error ? error.message : String(error),
        })
      }
      continue
    }

    if (/\.json$/i.test(file.name)) {
      entries.push(file)
      continue
    }

    warnings.push({ message: `Файл ${file.name} пропущен: не .zip и не .json` })
  }

  return entries
}

function parseJson(entry: RawFileInput, warnings: LoadWarning[]): unknown | undefined {
  try {
    return JSON.parse(decoder.decode(entry.bytes))
  } catch (error) {
    warnings.push({
      message: `Не удалось разобрать JSON в ${entry.name}`,
      detail: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function looksLikeConversation(value: unknown): value is RawConversation {
  return isObject(value) && 'uuid' in value && 'chat_messages' in value
}

function looksLikeProject(value: unknown): value is RawProject {
  return isObject(value) && 'uuid' in value && 'docs' in value && 'prompt_template' in value
}

function looksLikeUser(value: unknown): value is RawUser {
  return isObject(value) && 'uuid' in value && 'email_address' in value
}

/**
 * Определяет тип файла по форме содержимого, а не по имени: имя файла в
 * экспорте claude.ai менялось между версиями формата и может измениться
 * снова (см. manifest.part — шардирование по частям). Поддерживает заодно
 * старый плоский формат экспорта, где `projects.json` — это массив проектов
 * целиком, а не по файлу на проект.
 */
function classifyAndCollect(
  json: unknown,
  entryName: string,
  out: LoadedRawData,
  warnings: LoadWarning[],
): void {
  if (Array.isArray(json)) {
    if (json.length === 0) return // пустой массив — беседа стартового проекта без сообщений

    if (looksLikeConversation(json[0])) {
      out.conversations.push(...(json as RawConversation[]).filter(looksLikeConversation))
      return
    }
    if (looksLikeProject(json[0])) {
      out.projects.push(...(json as RawProject[]).filter(looksLikeProject))
      return
    }
    if (looksLikeUser(json[0])) {
      out.users.push(...(json as RawUser[]).filter(looksLikeUser))
      return
    }

    warnings.push({ message: `Неизвестный формат массива в ${entryName}` })
    return
  }

  if (isObject(json)) {
    if (looksLikeProject(json)) {
      out.projects.push(json)
      return
    }
    if (looksLikeConversation(json)) {
      out.conversations.push(json)
      return
    }
    if (Array.isArray(json.login_events)) {
      out.loginEvents.push(...(json.login_events as RawLoginEvent[]))
      return
    }

    warnings.push({ message: `Неизвестный формат объекта в ${entryName}` })
    return
  }

  warnings.push({ message: `Неожиданное содержимое в ${entryName}` })
}

/** Загружает и классифицирует набор файлов экспорта (zip и/или json) в сырые коллекции. */
export function loadRawArchive(files: RawFileInput[]): LoadedRawData {
  const warnings: LoadWarning[] = []
  const out: LoadedRawData = {
    conversations: [],
    projects: [],
    users: [],
    loginEvents: [],
    manifestCreatedAt: null,
    warnings,
  }

  const manifestFiles = files.filter((file) => isManifestFilename(file.name))
  const providedNames = new Set(files.map((file) => file.name))

  for (const manifestFile of manifestFiles) {
    const json = parseJson(manifestFile, warnings)
    if (json === undefined) continue
    try {
      const manifest = parseManifest(json)
      out.manifestCreatedAt = manifest.createdAt
      for (const entry of manifest.entries) {
        if (!providedNames.has(entry.filename)) {
          warnings.push({
            message: `Манифест ссылается на ${entry.filename} (${entry.category}), но этот файл не был загружен`,
          })
        }
      }
    } catch (error) {
      warnings.push({
        message: `Не удалось разобрать манифест ${manifestFile.name}`,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const jsonEntries = collectJsonEntries(files, warnings)

  for (const entry of jsonEntries) {
    const json = parseJson(entry, warnings)
    if (json === undefined) continue
    classifyAndCollect(json, entry.name, out, warnings)
  }

  if (
    out.conversations.length === 0 &&
    out.projects.length === 0 &&
    out.users.length === 0 &&
    out.loginEvents.length === 0
  ) {
    throw new Error(
      'В загруженных файлах не найдено ни бесед, ни проектов, ни метаданных аккаунта. Проверьте, что выбраны файлы экспорта claude.ai.',
    )
  }

  return out
}
