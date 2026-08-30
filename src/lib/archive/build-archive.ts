import { linkProjectsToConversations } from './link-projects'
import { loadRawArchive, type RawFileInput } from './load'
import type { Archive } from './model'
import { createFieldDetector, normalizeConversation, normalizeLoginEvent, normalizeProject, normalizeUser } from './normalize'

/** Собирает нормализованный Archive из набора файлов экспорта (zip и/или json). */
export function buildArchive(files: RawFileInput[]): Archive {
  const raw = loadRawArchive(files)
  const detector = createFieldDetector()

  const conversations = raw.conversations.map((c) => normalizeConversation(c, detector))
  const projects = raw.projects.map(normalizeProject)
  const users = raw.users.map(normalizeUser)
  const loginEvents = raw.loginEvents.map(normalizeLoginEvent)
  const projectLinks = linkProjectsToConversations(conversations, projects)

  return {
    conversations,
    projects,
    users,
    loginEvents,
    projectLinks,
    warnings: [...raw.warnings, ...detector.toWarnings()],
    exportedAt: raw.manifestCreatedAt,
  }
}
