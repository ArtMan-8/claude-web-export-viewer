import { unzipSync } from 'fflate'
import { parseManifest } from './manifest'
import type {
  RawArtifactMeta,
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
  /** artifact.json из frames-*.zip; путь внутри zip нужен, чтобы сопоставить версии с html */
  artifacts: { path: string; meta: RawArtifactMeta }[]
  /** HTML версий артефактов по пути внутри zip (`artifacts/<id>/versions/<ver>.html`) */
  artifactHtml: Map<string, string>
  manifestCreatedAt: string | null
  warnings: LoadWarning[]
}

/** Ошибка загрузки архива с кодом для перевода в UI (см. ru.json/en.json → errors.*). */
export class ArchiveLoadError extends Error {
  code: string
  params?: Record<string, string | number>

  constructor(code: string, params?: Record<string, string | number>) {
    super(code)
    this.code = code
    this.params = params
  }
}

const decoder = new TextDecoder('utf-8')

function isManifestFilename(name: string): boolean {
  return /^manifest-.*\.json$/i.test(name)
}

function isZipFilename(name: string): boolean {
  return /\.zip$/i.test(name)
}

/** Запись архива: `name` — имя для предупреждений (zip:путь), `innerPath` — путь внутри zip. */
interface ArchiveEntry extends RawFileInput {
  innerPath: string
}

/**
 * Плоская конверсия «имя файла внутри архива → байты», из zip или напрямую.
 * Из zip берутся записи с любым расширением — что с ними делать, решает
 * loadRawArchive по расширению (.json разбирается, .html — артефакт, прочее
 * пропускается с предупреждением).
 */
function collectEntries(files: RawFileInput[], warnings: LoadWarning[]): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []

  for (const file of files) {
    if (isManifestFilename(file.name)) continue

    if (isZipFilename(file.name)) {
      try {
        const unzipped = unzipSync(file.bytes)
        for (const [innerName, bytes] of Object.entries(unzipped)) {
          if (innerName.endsWith('/')) continue // директория
          if (bytes.length === 0) continue
          entries.push({ name: `${file.name}:${innerName}`, innerPath: innerName, bytes })
        }
      } catch (error) {
        warnings.push({
          code: 'unzipFailed',
          params: { file: file.name },
          detail: error instanceof Error ? error.message : String(error),
        })
      }
      continue
    }

    if (/\.json$/i.test(file.name)) {
      entries.push({ ...file, innerPath: file.name })
      continue
    }

    warnings.push({ code: 'fileSkipped', params: { file: file.name } })
  }

  return entries
}

function parseJson(entry: RawFileInput, warnings: LoadWarning[]): unknown | undefined {
  try {
    return JSON.parse(decoder.decode(entry.bytes))
  } catch (error) {
    warnings.push({
      code: 'jsonParseFailed',
      params: { file: entry.name },
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

// artifact.json распознаётся по kind === 'artifact' И массиву versions — иначе unknownObjectFormat, как раньше
function looksLikeArtifactMeta(value: unknown): value is RawArtifactMeta {
  return isObject(value) && value.kind === 'artifact' && Array.isArray(value.versions)
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
  entry: ArchiveEntry,
  out: LoadedRawData,
  warnings: LoadWarning[],
): void {
  const entryName = entry.name
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

    warnings.push({ code: 'unknownArrayFormat', params: { file: entryName } })
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
    if (looksLikeArtifactMeta(json)) {
      out.artifacts.push({ path: entry.innerPath, meta: json })
      return
    }

    warnings.push({ code: 'unknownObjectFormat', params: { file: entryName } })
    return
  }

  warnings.push({ code: 'unknownContent', params: { file: entryName } })
}

/** Загружает и классифицирует набор файлов экспорта (zip и/или json) в сырые коллекции. */
export function loadRawArchive(files: RawFileInput[]): LoadedRawData {
  const warnings: LoadWarning[] = []
  const out: LoadedRawData = {
    conversations: [],
    projects: [],
    users: [],
    loginEvents: [],
    artifacts: [],
    artifactHtml: new Map(),
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
            code: 'manifestEntryMissing',
            params: { file: entry.filename, category: entry.category },
          })
        }
      }
    } catch (error) {
      warnings.push({
        code: 'manifestParseFailed',
        params: { file: manifestFile.name },
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const entry of collectEntries(files, warnings)) {
    if (/\.html$/i.test(entry.innerPath)) {
      out.artifactHtml.set(entry.innerPath, decoder.decode(entry.bytes))
      continue
    }
    if (!/\.json$/i.test(entry.innerPath)) {
      warnings.push({ code: 'fileSkipped', params: { file: entry.name } })
      continue
    }
    const json = parseJson(entry, warnings)
    if (json === undefined) continue
    classifyAndCollect(json, entry, out, warnings)
  }

  if (
    out.conversations.length === 0 &&
    out.projects.length === 0 &&
    out.users.length === 0 &&
    out.loginEvents.length === 0 &&
    out.artifacts.length === 0
  ) {
    throw new ArchiveLoadError('archiveEmpty')
  }

  return out
}
