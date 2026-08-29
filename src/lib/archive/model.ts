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
  domain: string
  snippet: string
  isMissing: boolean
}

export type Block =
  | { kind: 'text'; text: string; citations: Citation[] }
  | { kind: 'thinking'; summaries: string[]; text: string }
  | {
      kind: 'tool'
      toolUseId: string
      name: string
      input: unknown
      /** Текстовые фрагменты результата как есть (до склейки) — нужны для эвристики привязки к проекту */
      resultFragments: string[]
      resultText: string
      sources: KnowledgeSource[]
      isError: boolean
      /** tool_result без парного tool_use (или наоборот) — не должно случаться, но данные нестабильны */
      isPaired: boolean
    }
  | { kind: 'unknown'; blockType: string; raw: unknown }

export interface Message {
  uuid: string
  parentUuid: string | null
  sender: 'human' | 'assistant'
  createdAt: string
  updatedAt: string
  blocks: Block[]
  /** true, если у сообщения нет ни одного содержательного блока */
  isEmpty: boolean
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
  /** Исходный объект из projects/<uuid>.json — только для экспорта «сырой JSON» */
  raw: RawProject
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
  warnings: LoadWarning[]
}
