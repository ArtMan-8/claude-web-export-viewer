/**
 * Нормализованная доменная модель архива. Компоненты работают только с этими
 * типами — сырые типы экспорта (raw-types.ts) наружу lib/archive не выходят,
 * кроме поля `raw` у Conversation/Project, которое существует только для
 * режима «сырой JSON как в архиве» в экспорте и не должно читаться в UI.
 */

import type { RawConversation, RawProject } from './raw-types'

export interface Citation {
  url: string
  startIndex: number
  endIndex: number
}

export interface KnowledgeSource {
  title: string
  url: string
  finalUrl: string | null
  domain: string
  siteName: string | null
  faviconUrl: string | null
  publishedAt: string | null
  snippet: string
  isMissing: boolean
  isCitable: boolean
}

export interface ResultFile {
  path: string
  name: string
  mimeType: string | null
  uuid: string
  /** local_resource.artifact_publishable — файл можно было опубликовать как артефакт */
  isPublishable: boolean
}

/** Распознавание по форме `input` — см. docs/29-08-2026_plan-export-format.md §3.2 */
export type ToolCall =
  | { kind: 'filePresent'; paths: string[] }
  | { kind: 'fileEdit'; path: string; oldText: string; newText: string; description: string }
  | { kind: 'fileWrite'; path: string; text: string; language: string | null; description: string }
  | { kind: 'command'; command: string; description: string; language: string | null }
  | { kind: 'fetch'; url: string }
  | { kind: 'query'; query: string; maxResults: number | null }
  | { kind: 'fileRead'; path: string; range: [number, number] | null; description: string }
  | { kind: 'raw'; input: unknown }
  | { kind: 'none' }

/** Распознавание по форме `content[]` — см. docs/29-08-2026_plan-export-format.md §3.3 */
export type ToolResult =
  | { kind: 'command'; exitCode: number | null; stdout: string; stderr: string; rawText: string }
  | { kind: 'files'; files: ResultFile[] }
  | { kind: 'sources'; sources: KnowledgeSource[] }
  | { kind: 'text'; text: string; fragments: string[] }
  | { kind: 'none' }

export type Block =
  | { kind: 'text'; text: string; citations: Citation[]; citationsGroupingMode: string | null }
  | { kind: 'thinking'; summaries: string[]; text: string; isTruncated: boolean }
  | {
      kind: 'tool'
      toolUseId: string
      name: string // 'bash_tool', 'web_search', …
      label: string | null // tool_use.message — человекочитаемая подпись
      integrationName: string | null
      integrationIconUrl: string | null
      iconName: string | null // icon_name из архива — запасной источник иконки
      toolOrigin: string | null
      call: ToolCall
      result: ToolResult
      rawInput: unknown // для режима «показать как есть»
      isError: boolean
      /** tool_result без парного tool_use (или наоборот) — не должно случаться, но данные нестабильны */
      isPaired: boolean
    }
  | { kind: 'unknown'; blockType: string; raw: unknown }

/** Вложение пользователя: текст, который Claude прочитал из файла (§4.3 плана 18-09-2026) */
export interface MessageAttachment {
  name: string // file_name; пустое — UI подставит «Вложение»
  type: string // file_type: 'txt', …
  size: number | null // file_size, байты
  extractedText: string // extracted_content — то, что прочитал Claude
}

/** Файл пользователя, содержимого которого в экспорте нет */
export interface MessageFile {
  uuid: string // file_uuid
  name: string | null // file_name
}

export interface Message {
  uuid: string
  parentUuid: string | null
  sender: 'human' | 'assistant'
  createdAt: string
  updatedAt: string
  blocks: Block[]
  attachments: MessageAttachment[]
  files: MessageFile[]
  /** true, если у сообщения нет ни одного содержательного блока и ни одного вложения */
  isEmpty: boolean
}

export type FileReconstructionError = 'noCreate' | 'ambiguousEdit' | 'missingEdit'

export interface ConversationFileRevision {
  messageUuid: string
  toolUseId: string
  op: 'create' | 'edit'
  at: string // start_timestamp
  sizeAfter: number
}

export interface ConversationFile {
  path: string
  name: string // basename либо local_resource.name
  mimeType: string | null
  language: string | null
  revisions: ConversationFileRevision[]
  isPresented: boolean // был ли present_files
  content: string | null // null, если реконструкция не прошла проверку
  reconstructionError: FileReconstructionError | null
  finalSize: number | null
}

export interface Conversation {
  uuid: string
  name: string
  summary: string
  createdAt: string
  updatedAt: string
  accountUuid: string
  messages: Message[]
  isEmpty: boolean
  /** Сообщения есть, но содержимое у всех стёрто — беседа удалена; updatedAt = момент удаления */
  isDeleted: boolean
  files: ConversationFile[]
  /** Исходный объект из conversations.json — только для экспорта «сырой JSON» */
  raw: RawConversation
}

export interface ProjectDoc {
  uuid: string
  filename: string
  content: string
  createdAt: string
}

export interface Project {
  uuid: string
  name: string
  description: string
  isPrivate: boolean
  isStarterProject: boolean
  promptTemplate: string
  createdAt: string
  updatedAt: string
  creatorName: string
  docs: ProjectDoc[]
  /** Нет ни документов, ни описания, ни инструкций — типично для служебных стартовых проектов */
  isEmpty: boolean
  /** Документы есть, но у всех пусты имя и содержимое — проект удалён; updatedAt = момент удаления */
  isDeleted: boolean
  /** Число документов в архиве до фильтрации заглушек (у живого проекта совпадает с docs.length) */
  rawDocCount: number
  /** Исходный объект из projects/<uuid>.json — только для экспорта «сырой JSON» */
  raw: RawProject
}

export interface ArtifactVersion {
  id: string
  title: string
  description: string
  createdAt: string
  /** null, если версия объявлена в artifact.json, но файла versions/<id>.html в архиве нет */
  html: string | null
}

/** Артефакт из категории `frames`; с беседой не связывается — связи в данных нет (Q8 плана 18-09-2026) */
export interface Artifact {
  id: string
  visibility: string
  ownerAccountUuid: string
  updatedAt: string
  activeVersionId: string | null
  /** По createdAt, новые первыми */
  versions: ArtifactVersion[]
  /** Заголовок активной версии, иначе последней */
  title: string
}

export interface UserProfile {
  uuid: string
  fullName: string
  email: string
  phone: string | null
}

export interface LoginEvent {
  accountUuid: string
  timestamp: string
  ip: string
  browser: string
  os: string
  method: string
  country: string | null
  region: string | null
  city: string | null
}

/** Связь беседа → проект, восстановленная эвристикой (см. link-projects.ts) */
export interface ProjectLink {
  conversationUuid: string
  projectUuid: string
  /** Число совпавших фрагментов документов — мера уверенности, не абсолютная гарантия */
  matchCount: number
}

export interface LoadWarning {
  code: string
  params?: Record<string, string | number>
  detail?: string
}

export interface Archive {
  conversations: Conversation[]
  projects: Project[]
  users: UserProfile[]
  loginEvents: LoginEvent[]
  projectLinks: ProjectLink[]
  artifacts: Artifact[]
  warnings: LoadWarning[]
  exportedAt: string | null // manifest.created_at
}
