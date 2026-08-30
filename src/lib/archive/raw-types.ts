/**
 * Типы «как есть» в файлах экспорта claude.ai (формат manifest version "1.0",
 * проверено на реальном архиве от 2026-08-29). Экспорт нестабилен между
 * версиями — не доверяй этим типам как гарантии, всегда обрабатывай
 * отсутствующие/неизвестные поля в normalize.ts, а не здесь.
 */

export interface RawManifest {
  instructions: string
  created_at: string
  total_files: number
  version: string
  data_files: RawManifestDataFile[]
}

export interface RawManifestDataFile {
  batch_index: number
  export_url: string
  category: 'light_metadata' | 'projects' | 'conversations' | (string & {})
  part: number
  filename: string
}

export interface RawAccount {
  uuid: string
}

export interface RawConversation {
  uuid: string
  name: string
  summary: string
  created_at: string
  updated_at: string
  account: RawAccount
  chat_messages: RawMessage[]
}

export type RawSender = 'human' | 'assistant'

export interface RawMessage {
  uuid: string
  /** Мусорное поле у ассистента ("This block is not supported..."). Не использовать для рендера. */
  text: string
  content: RawContentBlock[]
  sender: RawSender
  created_at: string
  updated_at: string
  attachments: RawAttachment[]
  files: RawFile[]
  parent_message_uuid: string
}

export interface RawAttachment {
  file_name?: string
  file_type?: string
  extracted_content?: string
  [key: string]: unknown
}

export interface RawFile {
  file_name?: string
  [key: string]: unknown
}

export interface RawCitation {
  uuid: string
  start_index: number
  end_index: number
  details: {
    type: string
    url?: string
    [key: string]: unknown
  }
}

interface RawBlockCommon {
  start_timestamp?: string
  stop_timestamp?: string
}

export interface RawDisplayContent {
  type: string
  language?: string | null
  filename?: string | null
  code?: string | null
  text?: string | null
  link?: { title?: string; url?: string; subtitles?: string[] }
  content?: unknown[]
  [key: string]: unknown
}

export interface RawTextBlock extends RawBlockCommon {
  type: 'text'
  text: string
  citations?: RawCitation[]
  citations_grouping_mode?: string | null
}

export interface RawThinkingBlock extends RawBlockCommon {
  type: 'thinking'
  thinking: string
  summaries?: { summary: string }[]
  thinking_hidden?: boolean
  hidden?: boolean
  truncated?: boolean
  cut_off?: boolean
  signature?: string
  alternative_display_type?: string | null
}

export interface RawToolUseBlock extends RawBlockCommon {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
  message?: string | null
  integration_name?: string | null
  integration_icon_url?: string | null
  icon_name?: string | null
  tool_origin?: string | null
  display_content?: RawDisplayContent | null
}

export interface RawKnowledgeItem {
  type: string
  uuid?: string
  title?: string
  url?: string
  text?: string
  is_missing?: boolean
  is_citable?: boolean
  metadata?: {
    site_domain?: string
    site_name?: string
    favicon_url?: string
    [key: string]: unknown
  }
  prompt_context_metadata?: {
    age?: string
    final_url?: string
    search_provider?: string
    [key: string]: unknown
  }
}

export interface RawLocalResourceItem {
  type: 'local_resource'
  uuid?: string
  file_uuid?: string
  path?: string
  file_path?: string
  name?: string
  file_name?: string
  mime_type?: string
  [key: string]: unknown
}

export interface RawToolResultBlock extends RawBlockCommon {
  type: 'tool_result'
  tool_use_id: string
  name: string
  content:
    | (RawKnowledgeItem | RawLocalResourceItem | { type: 'text'; text: string; uuid?: string } | Record<string, unknown>)[]
    | string
    | null
  is_error?: boolean
  display_content?: RawDisplayContent | null
  meta?: { output_format_category?: string; [key: string]: unknown } | null
}

export interface RawUnknownBlock extends RawBlockCommon {
  type: string
  [key: string]: unknown
}

export type RawContentBlock =
  | RawTextBlock
  | RawThinkingBlock
  | RawToolUseBlock
  | RawToolResultBlock
  | RawUnknownBlock

export interface RawProjectDoc {
  uuid: string
  filename: string
  content: string
  created_at: string
}

export interface RawProject {
  uuid: string
  name: string
  description: string
  is_private: boolean
  is_starter_project: boolean
  prompt_template: string
  created_at: string
  updated_at: string
  creator: { uuid: string; full_name: string }
  docs: RawProjectDoc[]
}

export interface RawUser {
  uuid: string
  full_name: string
  email_address: string
  verified_phone_number: string | null
}

export interface RawLoginEvent {
  account_uuid: string
  timestamp: string
  ip_address: string
  user_agent: {
    browser_family?: string
    browser_version?: string
    os_family?: string
    os_version?: string
    device_family?: string
  }
  method: string
  location_info: { country?: string | null; region?: string | null; city?: string | null }
}

export interface RawLoginHistory {
  login_events: RawLoginEvent[]
}
