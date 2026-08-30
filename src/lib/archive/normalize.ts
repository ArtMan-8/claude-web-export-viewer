import type {
  RawContentBlock,
  RawConversation,
  RawLoginEvent,
  RawMessage,
  RawProject,
  RawToolResultBlock,
  RawToolUseBlock,
  RawUser,
} from './raw-types'
import type {
  Block,
  Citation,
  Conversation,
  ConversationFile,
  ConversationFileRevision,
  FileReconstructionError,
  KnowledgeSource,
  LoadWarning,
  LoginEvent,
  Message,
  Project,
  ProjectDoc,
  ResultFile,
  ToolCall,
  ToolResult,
  UserProfile,
} from './model'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function domainFromUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  py: 'python',
  md: 'markdown',
  json: 'json',
  css: 'css',
  html: 'html',
  sh: 'bash',
  bash: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  rs: 'rust',
  go: 'go',
  java: 'java',
  rb: 'ruby',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  toml: 'toml',
  xml: 'xml',
}

function languageFromPath(path: string | null): string | null {
  if (!path) return null
  const ext = path.split('.').pop()
  if (!ext || ext === path) return null
  return EXTENSION_LANGUAGE[ext.toLowerCase()] ?? null
}

function languageFromDisplayContent(displayContent: unknown): string | null {
  if (!isObject(displayContent) || displayContent.type !== 'json_block') return null
  return typeof displayContent.language === 'string' ? displayContent.language : null
}

/** Ссылка-фолбэк для source, когда content[] не содержит knowledge-элементов. */
function sourceFromRichLink(displayContent: unknown): KnowledgeSource | null {
  if (!isObject(displayContent) || displayContent.type !== 'rich_link') return null
  const link = displayContent.link
  if (!isObject(link)) return null
  const url = typeof link.url === 'string' ? link.url : ''
  return {
    title: typeof link.title === 'string' && link.title ? link.title : url,
    url,
    finalUrl: null,
    domain: domainFromUrl(url),
    siteName: null,
    faviconUrl: null,
    publishedAt: null,
    snippet: Array.isArray(link.subtitles) ? link.subtitles.join(' · ') : '',
    isMissing: false,
    isCitable: true,
  }
}

function extractCitations(raw: RawContentBlock): Citation[] {
  if (raw.type !== 'text' || !Array.isArray(raw.citations)) return []
  const citations: Citation[] = []
  for (const c of raw.citations) {
    const url = c.details?.url
    if (typeof url === 'string' && url) {
      citations.push({ url, startIndex: c.start_index, endIndex: c.end_index })
    }
  }
  return citations
}

function extractResultFragments(content: RawToolResultBlock['content']): string[] {
  if (typeof content === 'string') return content ? [content] : []
  if (!Array.isArray(content)) return []
  const fragments: string[] = []
  for (const item of content) {
    if (isObject(item) && item.type === 'text' && typeof item.text === 'string') {
      fragments.push(item.text)
    }
  }
  return fragments
}

function extractResultFiles(content: RawToolResultBlock['content']): ResultFile[] {
  if (!Array.isArray(content)) return []
  const files: ResultFile[] = []
  for (const item of content) {
    if (isObject(item) && item.type === 'local_resource') {
      const path = typeof item.path === 'string' ? item.path : typeof item.file_path === 'string' ? item.file_path : ''
      const name =
        (typeof item.name === 'string' && item.name) || (typeof item.file_name === 'string' && item.file_name)
          ? ((item.name as string) || (item.file_name as string))
          : basename(path)
      const mimeType = typeof item.mime_type === 'string' ? item.mime_type : null
      const uuid = typeof item.uuid === 'string' ? item.uuid : typeof item.file_uuid === 'string' ? item.file_uuid : ''
      files.push({ path, name, mimeType, uuid })
    }
  }
  return files
}

function extractSourcesFromContent(content: RawToolResultBlock['content']): KnowledgeSource[] {
  if (!Array.isArray(content)) return []
  const sources: KnowledgeSource[] = []
  for (const item of content) {
    if (isObject(item) && item.type === 'knowledge') {
      const url = typeof item.url === 'string' ? item.url : ''
      const metadata = isObject(item.metadata) ? item.metadata : undefined
      const promptMeta = isObject(item.prompt_context_metadata) ? item.prompt_context_metadata : undefined
      sources.push({
        title: typeof item.title === 'string' && item.title ? item.title : url,
        url,
        finalUrl: typeof promptMeta?.final_url === 'string' ? promptMeta.final_url : null,
        domain: (metadata?.site_domain as string | undefined) ?? domainFromUrl(url),
        siteName: typeof metadata?.site_name === 'string' ? metadata.site_name : null,
        faviconUrl: typeof metadata?.favicon_url === 'string' ? metadata.favicon_url : null,
        publishedAt: typeof promptMeta?.age === 'string' ? promptMeta.age : null,
        snippet: typeof item.text === 'string' ? item.text : '',
        isMissing: Boolean(item.is_missing),
        isCitable: Boolean(item.is_citable),
      })
    }
  }
  return sources
}

/**
 * Распознаёт вид вызова инструмента по форме `input`, а не по имени —
 * переживает инструменты из следующих выгрузок (см. §3.2 плана). Порядок
 * проверок существен: у create_file есть и path, и file_text, поэтому
 * fileWrite проверяется раньше fileRead.
 */
export function parseToolCall(input: unknown, displayContent: unknown): ToolCall {
  if (!isObject(input)) return { kind: 'raw', input }

  const filepaths = input.filepaths
  if (Array.isArray(filepaths) && filepaths.every((p) => typeof p === 'string')) {
    return { kind: 'filePresent', paths: filepaths }
  }

  const path = typeof input.path === 'string' ? input.path : null
  const description = typeof input.description === 'string' ? input.description : ''

  if (path && typeof input.old_str === 'string' && typeof input.new_str === 'string') {
    return { kind: 'fileEdit', path, oldText: input.old_str, newText: input.new_str, description }
  }

  if (path && typeof input.file_text === 'string') {
    const language = languageFromDisplayContent(displayContent) ?? languageFromPath(path)
    return { kind: 'fileWrite', path, text: input.file_text, language, description }
  }

  if (typeof input.command === 'string') {
    const language = languageFromDisplayContent(displayContent)
    return { kind: 'command', command: input.command, description, language }
  }

  if (typeof input.url === 'string') {
    return { kind: 'fetch', url: input.url }
  }

  if (typeof input.query === 'string') {
    const maxResults = typeof input.max_text_results === 'number' ? input.max_text_results : null
    return { kind: 'query', query: input.query, maxResults }
  }

  if (path) {
    const range =
      Array.isArray(input.view_range) &&
      input.view_range.length === 2 &&
      typeof input.view_range[0] === 'number' &&
      typeof input.view_range[1] === 'number'
        ? ([input.view_range[0], input.view_range[1]] as [number, number])
        : null
    return { kind: 'fileRead', path, range, description }
  }

  return { kind: 'raw', input }
}

function tryParseCommandOutput(text: string): { exitCode: number | null; stdout: string; stderr: string } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObject(parsed) || !('returncode' in parsed)) return null
  return {
    exitCode: typeof parsed.returncode === 'number' ? parsed.returncode : null,
    stdout: typeof parsed.stdout === 'string' ? parsed.stdout : '',
    stderr: typeof parsed.stderr === 'string' ? parsed.stderr : '',
  }
}

/**
 * Распознаёт вид результата по форме `content[]` (см. §3.3 плана).
 * Приоритет при (в данных не встречающейся) смеси форм: command > files >
 * sources > text. Часть bash-результатов не парсится JSON-ом («Command
 * output contains invalid UTF-8 data») — фолбэк на 'text' обязателен.
 */
export function parseToolResult(content: RawToolResultBlock['content'], displayContent: unknown): ToolResult {
  const fragments = extractResultFragments(content)

  if (fragments.length === 1) {
    const parsed = tryParseCommandOutput(fragments[0])
    if (parsed) return { kind: 'command', ...parsed, rawText: fragments[0] }
  }

  const files = extractResultFiles(content)
  if (files.length > 0) return { kind: 'files', files }

  const sources = extractSourcesFromContent(content)
  if (sources.length > 0) return { kind: 'sources', sources }

  if (fragments.length > 0) return { kind: 'text', text: fragments.join('\n\n'), fragments }

  const richLinkSource = sourceFromRichLink(displayContent)
  if (richLinkSource) return { kind: 'sources', sources: [richLinkSource] }

  return { kind: 'none' }
}

/**
 * Белые списки ключей по фактическим данным выгрузки (см. §2.1 плана) —
 * ключи вне списка сигналят, что в новой выгрузке появилось поле, которого
 * читалка не знает. `approval_*`, `context`, `is_mcp_app`, `mcp_server_url`,
 * `tool_identifier`, `flags`, `hidden_in_chat` присутствуют в данных (везде
 * `null`), но осознанно не тянутся в модель — не выдумываем предупреждение на
 * известную и намеренно неиспользуемую форму.
 */
const TEXT_BLOCK_KEYS = new Set(['type', 'text', 'citations', 'citations_grouping_mode', 'flags', 'start_timestamp', 'stop_timestamp'])
const THINKING_BLOCK_KEYS = new Set([
  'type', 'thinking', 'summaries', 'thinking_hidden', 'hidden', 'truncated', 'cut_off', 'signature',
  'alternative_display_type', 'flags', 'start_timestamp', 'stop_timestamp',
])
const TOOL_USE_KEYS = new Set([
  'type', 'id', 'name', 'input', 'message', 'integration_name', 'integration_icon_url', 'icon_name', 'tool_origin',
  'display_content', 'start_timestamp', 'stop_timestamp',
  'context', 'is_mcp_app', 'mcp_server_url', 'tool_identifier', 'flags', 'hidden_in_chat',
])
// tool_result зеркалит те же поля происхождения инструмента, что и tool_use (message/integration_*/icon_name/
// tool_origin/mcp_server_url/hidden_in_chat/flags) плюс structured_content — подтверждено на реальной выгрузке.
const TOOL_RESULT_KEYS = new Set([
  'type', 'tool_use_id', 'name', 'content', 'is_error', 'display_content', 'meta', 'start_timestamp', 'stop_timestamp',
  'message', 'integration_name', 'integration_icon_url', 'icon_name', 'tool_origin', 'mcp_server_url',
  'hidden_in_chat', 'flags', 'structured_content',
])
const KNOWN_RESULT_ITEM_TYPES = new Set(['text', 'knowledge', 'local_resource'])
const KNOWN_DISPLAY_CONTENT_TYPES = new Set(['text', 'json_block', 'table', 'rich_link', 'rich_content'])

/** Собирает предупреждения о незнакомых данных по ходу нормализации, схлопывая повторы в счётчик (§6.3 плана). */
export function createFieldDetector() {
  const blockTypes = new Map<string, number>()
  const resultItemTypes = new Map<string, number>()
  const unknownKeys = new Map<string, { context: string; key: string; count: number }>()
  let unverifiedAttachments = 0

  return {
    recordBlockType(type: string) {
      blockTypes.set(type, (blockTypes.get(type) ?? 0) + 1)
    },
    recordResultItemType(type: string) {
      resultItemTypes.set(type, (resultItemTypes.get(type) ?? 0) + 1)
    },
    recordUnknownKey(context: string, key: string) {
      const id = `${context} ${key}`
      const existing = unknownKeys.get(id)
      unknownKeys.set(id, { context, key, count: (existing?.count ?? 0) + 1 })
    },
    recordUnverifiedAttachment() {
      unverifiedAttachments += 1
    },
    toWarnings(): LoadWarning[] {
      const warnings: LoadWarning[] = []
      for (const [type, count] of blockTypes) warnings.push({ code: 'unknownBlockType', params: { type, count } })
      for (const [type, count] of resultItemTypes) warnings.push({ code: 'unknownResultItem', params: { type, count } })
      for (const { context, key, count } of unknownKeys.values()) {
        warnings.push({ code: 'unknownKeys', params: { context, key, count } })
      }
      if (unverifiedAttachments > 0) warnings.push({ code: 'unverifiedAttachments', params: { count: unverifiedAttachments } })
      return warnings
    },
  }
}

export type FieldDetector = ReturnType<typeof createFieldDetector>

function detectUnknownKeys(raw: object, whitelist: Set<string>, context: string, detector: FieldDetector): void {
  for (const key of Object.keys(raw)) {
    if (whitelist.has(key)) continue
    if (context === 'tool_use' && key.startsWith('approval_')) continue
    detector.recordUnknownKey(context, key)
  }
}

function detectUnknownDisplayContentType(displayContent: unknown, context: string, detector: FieldDetector): void {
  if (!isObject(displayContent)) return
  const type = displayContent.type
  if (typeof type === 'string' && !KNOWN_DISPLAY_CONTENT_TYPES.has(type)) {
    detector.recordUnknownKey(context, `display_content.type=${type}`)
  }
}

function detectUnknownResultItems(content: RawToolResultBlock['content'], detector: FieldDetector): void {
  if (!Array.isArray(content)) return
  for (const item of content) {
    if (isObject(item) && typeof item.type === 'string' && !KNOWN_RESULT_ITEM_TYPES.has(item.type)) {
      detector.recordResultItemType(item.type)
    }
  }
}

/**
 * Схлопывает content[] сообщения в плоский список Block: text/thinking как
 * есть, tool_use+tool_result по tool_use_id — в один блок 'tool' (иначе
 * интерфейс распадается на пары карточек), неизвестные типы — в 'unknown'
 * вместо падения (формат экспорта нестабилен между версиями).
 */
function normalizeBlocks(rawBlocks: RawContentBlock[], detector: FieldDetector): Block[] {
  const resultsByUseId = new Map<string, RawToolResultBlock>()
  for (const raw of rawBlocks) {
    if (raw.type === 'tool_result') {
      resultsByUseId.set((raw as RawToolResultBlock).tool_use_id, raw as RawToolResultBlock)
    }
  }

  const consumedResultIds = new Set<string>()
  const blocks: Block[] = []

  for (const raw of rawBlocks) {
    switch (raw.type) {
      case 'text': {
        detectUnknownKeys(raw, TEXT_BLOCK_KEYS, 'text', detector)
        const text = 'text' in raw && typeof raw.text === 'string' ? raw.text : ''
        blocks.push({
          kind: 'text',
          text,
          citations: extractCitations(raw),
          citationsGroupingMode: typeof raw.citations_grouping_mode === 'string' ? raw.citations_grouping_mode : null,
        })
        break
      }
      case 'thinking': {
        detectUnknownKeys(raw, THINKING_BLOCK_KEYS, 'thinking', detector)
        const summaries = Array.isArray(raw.summaries)
          ? raw.summaries.map((s) => s.summary).filter(Boolean)
          : []
        const text = typeof raw.thinking === 'string' ? raw.thinking : ''
        // thinking почти всегда скрыт (thinking_hidden: true) — реальный смысл в summaries
        blocks.push({
          kind: 'thinking',
          summaries,
          text,
          isTruncated: Boolean(raw.truncated) || Boolean(raw.cut_off),
        })
        break
      }
      case 'tool_use': {
        // Формат экспорта нестабилен (см. RawUnknownBlock) — TS не может сузить union
        // по нелитеральному `type` соседней ветки, приведение безопасно после case-проверки.
        const use = raw as RawToolUseBlock
        detectUnknownKeys(use, TOOL_USE_KEYS, 'tool_use', detector)
        detectUnknownDisplayContentType(use.display_content, 'tool_use', detector)
        const result = resultsByUseId.get(use.id)
        if (result) {
          consumedResultIds.add(use.id)
          detectUnknownKeys(result, TOOL_RESULT_KEYS, 'tool_result', detector)
          detectUnknownDisplayContentType(result.display_content, 'tool_result', detector)
          detectUnknownResultItems(result.content, detector)
        }
        blocks.push({
          kind: 'tool',
          toolUseId: use.id,
          name: use.name,
          label: typeof use.message === 'string' ? use.message : null,
          integrationName: use.integration_name ?? null,
          integrationIconUrl: use.integration_icon_url ?? null,
          iconName: use.icon_name ?? null,
          toolOrigin: use.tool_origin ?? null,
          call: parseToolCall(use.input, use.display_content),
          result: result ? parseToolResult(result.content, result.display_content) : { kind: 'none' },
          rawInput: use.input,
          isError: Boolean(result?.is_error),
          isPaired: Boolean(result),
        })
        break
      }
      case 'tool_result': {
        const result = raw as RawToolResultBlock
        if (consumedResultIds.has(result.tool_use_id)) break // уже показан вместе с tool_use
        // осиротевший результат без своего tool_use — редкость, но данные нестабильны
        detectUnknownKeys(result, TOOL_RESULT_KEYS, 'tool_result', detector)
        detectUnknownDisplayContentType(result.display_content, 'tool_result', detector)
        detectUnknownResultItems(result.content, detector)
        blocks.push({
          kind: 'tool',
          toolUseId: result.tool_use_id,
          name: result.name,
          label: null,
          integrationName: null,
          integrationIconUrl: null,
          iconName: null,
          toolOrigin: null,
          call: { kind: 'none' },
          result: parseToolResult(result.content, result.display_content),
          rawInput: undefined,
          isError: Boolean(result.is_error),
          isPaired: false,
        })
        break
      }
      default:
        detector.recordBlockType(raw.type)
        blocks.push({ kind: 'unknown', blockType: raw.type, raw })
    }
  }

  return blocks
}

interface FileOp {
  path: string
  op: 'create' | 'edit'
  text: string // fileWrite: полное содержимое; fileEdit: newText
  oldText: string | null // только для edit
  timestamp: string
  messageUuid: string
  toolUseId: string
}

/**
 * Восстанавливает содержимое файлов беседы из create_file/str_replace.
 * Файл целиком встречается только в create_file.input.file_text; str_replace
 * хранит фрагменты. Каждый шаг верифицируется: old_str обязан встретиться в
 * текущем содержимом ровно один раз — иначе реконструкция отклоняется, а не
 * молча отдаёт неверные данные (см. §3.5 плана).
 */
export function collectConversationFiles(rawMessages: RawMessage[]): ConversationFile[] {
  const ops: FileOp[] = []
  const presentedPaths = new Set<string>()
  const metaByPath = new Map<string, { name: string; mimeType: string | null }>()

  for (const message of rawMessages) {
    const content = message.content ?? []
    const resultsByUseId = new Map<string, RawToolResultBlock>()
    for (const raw of content) {
      if (raw.type === 'tool_result') resultsByUseId.set((raw as RawToolResultBlock).tool_use_id, raw as RawToolResultBlock)
    }

    for (const raw of content) {
      if (raw.type !== 'tool_use') continue
      const use = raw as RawToolUseBlock
      const call = parseToolCall(use.input, use.display_content)
      const timestamp = use.start_timestamp ?? message.created_at

      if (call.kind === 'fileWrite') {
        ops.push({ path: call.path, op: 'create', text: call.text, oldText: null, timestamp, messageUuid: message.uuid, toolUseId: use.id })
      } else if (call.kind === 'fileEdit') {
        ops.push({ path: call.path, op: 'edit', text: call.newText, oldText: call.oldText, timestamp, messageUuid: message.uuid, toolUseId: use.id })
      } else if (call.kind === 'filePresent') {
        for (const path of call.paths) presentedPaths.add(path)
        const result = resultsByUseId.get(use.id)
        if (result) {
          for (const file of extractResultFiles(result.content)) {
            metaByPath.set(file.path, { name: file.name, mimeType: file.mimeType })
          }
        }
      }
    }
  }

  const opsByPath = new Map<string, FileOp[]>()
  for (const op of ops) {
    const list = opsByPath.get(op.path)
    if (list) list.push(op)
    else opsByPath.set(op.path, [op])
  }

  const files: ConversationFile[] = []

  for (const [path, pathOps] of opsByPath) {
    const revisions: ConversationFileRevision[] = []
    let content: string | null = null
    let reconstructionError: FileReconstructionError | null = null

    for (const op of pathOps) {
      if (op.op === 'create') {
        content = op.text
        revisions.push({ messageUuid: op.messageUuid, toolUseId: op.toolUseId, op: 'create', at: op.timestamp, sizeAfter: content.length })
        continue
      }

      // edit
      if (content === null) {
        reconstructionError = 'noCreate'
        revisions.push({ messageUuid: op.messageUuid, toolUseId: op.toolUseId, op: 'edit', at: op.timestamp, sizeAfter: 0 })
        break
      }

      const oldText = op.oldText ?? ''
      const occurrences = content.split(oldText).length - 1
      if (occurrences === 0) {
        reconstructionError = 'missingEdit'
        revisions.push({ messageUuid: op.messageUuid, toolUseId: op.toolUseId, op: 'edit', at: op.timestamp, sizeAfter: content.length })
        break
      }
      if (occurrences > 1) {
        reconstructionError = 'ambiguousEdit'
        revisions.push({ messageUuid: op.messageUuid, toolUseId: op.toolUseId, op: 'edit', at: op.timestamp, sizeAfter: content.length })
        break
      }

      content = content.replace(oldText, op.text)
      revisions.push({ messageUuid: op.messageUuid, toolUseId: op.toolUseId, op: 'edit', at: op.timestamp, sizeAfter: content.length })
    }

    if (reconstructionError) content = null

    const meta = metaByPath.get(path)
    files.push({
      path,
      name: meta?.name ?? basename(path),
      mimeType: meta?.mimeType ?? null,
      language: languageFromPath(path),
      revisions,
      isPresented: presentedPaths.has(path),
      content,
      reconstructionError,
      finalSize: content !== null ? content.length : null,
    })
  }

  return files
}

/** Фиктивный parent_message_uuid у самого первого сообщения беседы — не настоящая ссылка. */
const ROOT_PARENT_SENTINEL = '00000000-0000-4000-8000-000000000000'

export function normalizeConversation(raw: RawConversation, detector: FieldDetector = createFieldDetector()): Conversation {
  const rawMessages = raw.chat_messages ?? []
  const messages: Message[] = rawMessages.map((rawMessage) => {
    if ((rawMessage.attachments?.length ?? 0) > 0 || (rawMessage.files?.length ?? 0) > 0) {
      detector.recordUnverifiedAttachment()
    }
    const blocks = normalizeBlocks(rawMessage.content ?? [], detector)
    return {
      uuid: rawMessage.uuid,
      parentUuid:
        rawMessage.parent_message_uuid && rawMessage.parent_message_uuid !== ROOT_PARENT_SENTINEL
          ? rawMessage.parent_message_uuid
          : null,
      sender: rawMessage.sender,
      createdAt: rawMessage.created_at,
      updatedAt: rawMessage.updated_at,
      blocks,
      isEmpty: blocks.length === 0,
    }
  })

  return {
    uuid: raw.uuid,
    name: raw.name ?? '',
    summary: raw.summary ?? '',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    accountUuid: raw.account?.uuid ?? '',
    messages,
    // Не только 0 сообщений, но и беседа, где каждое сообщение само по себе пусто —
    // такое встречается у сорвавшихся генераций (сбой без единого блока контента)
    isEmpty: messages.length === 0 || messages.every((m) => m.isEmpty),
    files: collectConversationFiles(rawMessages),
    raw,
  }
}

export function normalizeProject(raw: RawProject): Project {
  const docs: ProjectDoc[] = (raw.docs ?? [])
    // Документы-заглушки без имени и содержимого — мусор стартовых проектов, не показываем
    .filter((doc) => doc.filename?.trim() || doc.content?.trim())
    .map((doc) => ({
      uuid: doc.uuid,
      filename: doc.filename ?? '',
      content: doc.content ?? '',
      createdAt: doc.created_at,
    }))

  const description = raw.description ?? ''
  const promptTemplate = raw.prompt_template ?? ''

  return {
    uuid: raw.uuid,
    name: raw.name ?? '',
    description,
    isPrivate: Boolean(raw.is_private),
    isStarterProject: Boolean(raw.is_starter_project),
    promptTemplate,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    creatorName: raw.creator?.full_name ?? '',
    docs,
    // Пустой проект — это ровно "нечего показать": ни документов, ни описания, ни инструкций
    isEmpty: docs.length === 0 && !description.trim() && !promptTemplate.trim(),
    raw,
  }
}

export function normalizeUser(raw: RawUser): UserProfile {
  return {
    uuid: raw.uuid,
    fullName: raw.full_name ?? '',
    email: raw.email_address ?? '',
    phone: raw.verified_phone_number ?? null,
  }
}

export function normalizeLoginEvent(raw: RawLoginEvent): LoginEvent {
  const agent = raw.user_agent ?? {}
  return {
    accountUuid: raw.account_uuid,
    timestamp: raw.timestamp,
    ip: raw.ip_address ?? '',
    browser: [agent.browser_family, agent.browser_version].filter(Boolean).join(' '),
    os: [agent.os_family, agent.os_version].filter(Boolean).join(' '),
    method: raw.method ?? '',
    country: raw.location_info?.country ?? null,
    region: raw.location_info?.region ?? null,
    city: raw.location_info?.city ?? null,
  }
}
