import type {
  RawContentBlock,
  RawConversation,
  RawLoginEvent,
  RawProject,
  RawToolResultBlock,
  RawToolUseBlock,
  RawUser,
} from './raw-types'
import type {
  Block,
  Citation,
  Conversation,
  KnowledgeSource,
  LoginEvent,
  Message,
  Project,
  ProjectDoc,
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

function extractSources(result: RawToolResultBlock): KnowledgeSource[] {
  const sources: KnowledgeSource[] = []

  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (isObject(item) && item.type === 'knowledge') {
        const url = typeof item.url === 'string' ? item.url : ''
        const metadata = isObject(item.metadata) ? item.metadata : undefined
        sources.push({
          title: typeof item.title === 'string' && item.title ? item.title : url,
          url,
          domain: (metadata?.site_domain as string | undefined) ?? domainFromUrl(url),
          snippet: typeof item.text === 'string' ? item.text : '',
          isMissing: Boolean(item.is_missing),
        })
      }
    }
  }

  if (sources.length === 0 && isObject(result.display_content) && result.display_content.type === 'rich_link') {
    const link = result.display_content.link
    if (isObject(link)) {
      const url = typeof link.url === 'string' ? link.url : ''
      sources.push({
        title: typeof link.title === 'string' && link.title ? link.title : url,
        url,
        domain: domainFromUrl(url),
        snippet: Array.isArray(link.subtitles) ? link.subtitles.join(' · ') : '',
        isMissing: false,
      })
    }
  }

  return sources
}

/**
 * Схлопывает content[] сообщения в плоский список Block: text/thinking как
 * есть, tool_use+tool_result по tool_use_id — в один блок 'tool' (иначе
 * интерфейс распадается на пары карточек), неизвестные типы — в 'unknown'
 * вместо падения (формат экспорта нестабилен между версиями).
 */
function normalizeBlocks(rawBlocks: RawContentBlock[]): Block[] {
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
        const text = 'text' in raw && typeof raw.text === 'string' ? raw.text : ''
        blocks.push({ kind: 'text', text, citations: extractCitations(raw) })
        break
      }
      case 'thinking': {
        const summaries = Array.isArray(raw.summaries)
          ? raw.summaries.map((s) => s.summary).filter(Boolean)
          : []
        const text = typeof raw.thinking === 'string' ? raw.thinking : ''
        // thinking почти всегда скрыт (thinking_hidden: true) — реальный смысл в summaries
        blocks.push({ kind: 'thinking', summaries, text })
        break
      }
      case 'tool_use': {
        // Формат экспорта нестабилен (см. RawUnknownBlock) — TS не может сузить union
        // по нелитеральному `type` соседней ветки, приведение безопасно после case-проверки.
        const use = raw as RawToolUseBlock
        const result = resultsByUseId.get(use.id)
        if (result) consumedResultIds.add(use.id)
        const fragments = result ? extractResultFragments(result.content) : []
        blocks.push({
          kind: 'tool',
          toolUseId: use.id,
          name: use.name,
          input: use.input,
          resultFragments: fragments,
          resultText: fragments.join('\n\n'),
          sources: result ? extractSources(result) : [],
          isError: Boolean(result?.is_error),
          isPaired: Boolean(result),
        })
        break
      }
      case 'tool_result': {
        const result = raw as RawToolResultBlock
        if (consumedResultIds.has(result.tool_use_id)) break // уже показан вместе с tool_use
        // осиротевший результат без своего tool_use — редкость, но данные нестабильны
        const fragments = extractResultFragments(result.content)
        blocks.push({
          kind: 'tool',
          toolUseId: result.tool_use_id,
          name: result.name,
          input: undefined,
          resultFragments: fragments,
          resultText: fragments.join('\n\n'),
          sources: extractSources(result),
          isError: Boolean(result.is_error),
          isPaired: false,
        })
        break
      }
      default:
        blocks.push({ kind: 'unknown', blockType: raw.type, raw })
    }
  }

  return blocks
}

/** Фиктивный parent_message_uuid у самого первого сообщения беседы — не настоящая ссылка. */
const ROOT_PARENT_SENTINEL = '00000000-0000-4000-8000-000000000000'

export function normalizeConversation(raw: RawConversation): Conversation {
  const messages: Message[] = (raw.chat_messages ?? []).map((rawMessage) => {
    const blocks = normalizeBlocks(rawMessage.content ?? [])
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
