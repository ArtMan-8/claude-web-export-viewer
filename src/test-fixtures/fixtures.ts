// Анонимные фикстуры для тестов ядра — не настоящие данные пользователя.
import type { RawConversation, RawMessage, RawProject, RawTextBlock, RawToolResultBlock, RawToolUseBlock } from '~/lib/archive/raw-types'

const ROOT_PARENT = '00000000-0000-4000-8000-000000000000'

export function textBlock(text: string, citations?: RawTextBlock['citations']): RawTextBlock {
  return { type: 'text', text, citations }
}

export function toolUseBlock(id: string, name: string, input: unknown = {}): RawToolUseBlock {
  return { type: 'tool_use', id, name, input }
}

export function toolResultBlock(
  toolUseId: string,
  name: string,
  overrides: Partial<RawToolResultBlock> = {},
): RawToolResultBlock {
  return {
    type: 'tool_result',
    tool_use_id: toolUseId,
    name,
    content: [{ type: 'text', text: 'результат' }],
    is_error: false,
    ...overrides,
  }
}

let messageCounter = 0
export function makeMessage(overrides: Partial<RawMessage> = {}): RawMessage {
  messageCounter += 1
  return {
    uuid: `msg-${messageCounter}`,
    text: '',
    content: [],
    sender: 'human',
    created_at: `2026-01-01T00:00:${String(messageCounter).padStart(2, '0')}Z`,
    updated_at: `2026-01-01T00:00:${String(messageCounter).padStart(2, '0')}Z`,
    attachments: [],
    files: [],
    parent_message_uuid: ROOT_PARENT,
    ...overrides,
  }
}

export function makeConversation(overrides: Partial<RawConversation> = {}): RawConversation {
  return {
    uuid: 'conv-1',
    name: 'Тестовая беседа',
    summary: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:01:00Z',
    account: { uuid: 'account-1' },
    chat_messages: [],
    ...overrides,
  }
}

export function makeProject(overrides: Partial<RawProject> = {}): RawProject {
  return {
    uuid: 'project-1',
    name: 'Тестовый проект',
    description: '',
    is_private: true,
    is_starter_project: false,
    prompt_template: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    creator: { uuid: 'account-1', full_name: 'Тест' },
    docs: [],
    ...overrides,
  }
}

export function resetFixtureCounters(): void {
  messageCounter = 0
}
