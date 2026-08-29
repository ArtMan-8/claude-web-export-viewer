import type { Conversation, Project } from '@/lib/archive/model'

export interface JsonExportOptions {
  project?: Project | null
}

export function conversationToJson(conversation: Conversation, options: JsonExportOptions = {}): string {
  const { raw: _raw, ...normalized } = conversation
  const payload = options.project
    ? { ...normalized, project: { uuid: options.project.uuid, name: options.project.displayName } }
    : normalized

  return JSON.stringify(payload, null, 2)
}

export function projectToJson(project: Project): string {
  const { raw: _raw, ...normalized } = project
  return JSON.stringify(normalized, null, 2)
}
