import { linkProjectsToConversations } from './link-projects'
import { loadRawArchive, type RawFileInput } from './load'
import type { Archive, LoadWarning } from './model'
import {
  createFieldDetector,
  normalizeArtifact,
  normalizeConversation,
  normalizeLoginEvent,
  normalizeProject,
  normalizeUser,
} from './normalize'

/** Собирает нормализованный Archive из набора файлов экспорта (zip и/или json). */
export function buildArchive(files: RawFileInput[]): Archive {
  const raw = loadRawArchive(files)
  const detector = createFieldDetector()

  const conversations = raw.conversations.map((c) => normalizeConversation(c, detector))
  const projects = raw.projects.map(normalizeProject)
  const users = raw.users.map(normalizeUser)
  const loginEvents = raw.loginEvents.map(normalizeLoginEvent)
  const projectLinks = linkProjectsToConversations(conversations, projects)

  const artifactWarnings: LoadWarning[] = []
  const htmlByPath = new Map(raw.artifactHtml)
  const artifacts = raw.artifacts.map((a) => normalizeArtifact(a.meta, a.path, htmlByPath, artifactWarnings))
  // Что осталось — html без своего artifact.json
  for (const path of htmlByPath.keys()) artifactWarnings.push({ code: 'artifactMetaMissing', params: { file: path } })

  return {
    conversations,
    projects,
    users,
    loginEvents,
    projectLinks,
    artifacts,
    warnings: [...raw.warnings, ...detector.toWarnings(), ...artifactWarnings],
    exportedAt: raw.manifestCreatedAt,
  }
}
