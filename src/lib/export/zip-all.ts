import { strToU8, zipSync } from 'fflate'
import i18next from 'i18next'
import type { Archive, Project } from '~/lib/archive/model'
import { displayNameOf } from '~/lib/display-name'
import { conversationToMarkdown } from './markdown'

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // диакритика латиницы (после NFKD); кириллица не трогается
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'file'
}

function safeSegment(segment: string): string {
  const cleaned = segment.replace(/\.\./g, '').replace(/^[/\\]+/, '').trim()
  return cleaned || 'file'
}

function uniqueName(base: string, used: Set<string>): string {
  let candidate = base
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base}-${n}`
    n += 1
  }
  used.add(candidate)
  return candidate
}

export interface ZipAllOptions {
  includeTools: boolean
}

/** Собирает весь архив в один zip: беседы в .md, документы проектов, index.md со списком. */
export function buildFullExportZip(archive: Archive, options: ZipAllOptions): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  const usedConversationNames = new Set<string>()
  const projectByUuid = new Map(archive.projects.map((p) => [p.uuid, p]))
  const projectUuidByConversation = new Map(archive.projectLinks.map((l) => [l.conversationUuid, l.projectUuid]))

  const untitled = i18next.t('common.untitled')
  const indexLines: string[] = [`# ${i18next.t('export.archiveTitle')}`, '', `## ${i18next.t('export.conversationsHeading')}`, '']

  for (const conversation of archive.conversations) {
    const projectUuid = projectUuidByConversation.get(conversation.uuid)
    const project = projectUuid ? (projectByUuid.get(projectUuid) ?? null) : null
    const conversationName = displayNameOf(conversation.name, untitled)
    const datePart = conversation.createdAt.slice(0, 10) || '0000-00-00'
    const base = safeSegment(`${datePart}-${slugify(conversationName)}`)
    const name = uniqueName(base, usedConversationNames)
    const path = `conversations/${name}.md`

    files[path] = strToU8(conversationToMarkdown(conversation, { includeTools: options.includeTools, project }))
    const projectSuffix = project
      ? ` — ${i18next.t('export.projectSuffix', { name: displayNameOf(project.name, untitled) })}`
      : ''
    indexLines.push(`- [${conversationName}](${path})${projectSuffix}`)
  }

  indexLines.push('', `## ${i18next.t('export.projectsHeading')}`, '')
  const usedProjectDirs = new Set<string>()

  for (const project of archive.projects) {
    const projectName = displayNameOf(project.name, untitled)
    const dir = uniqueName(safeSegment(slugify(projectName)), usedProjectDirs)
    indexLines.push(`- ${projectName} (${i18next.t('export.docsCount', { count: project.docs.length })})`)

    for (const doc of project.docs) {
      const segments = doc.filename ? doc.filename.split('/').map(safeSegment) : [`${doc.uuid}.md`]
      files[`projects/${dir}/${segments.join('/')}`] = strToU8(doc.content)
    }
  }

  files['index.md'] = strToU8(indexLines.join('\n'))

  return zipSync(files)
}

/** Собирает документы одного проекта в zip: каждый документ — отдельный .md файл. */
export function buildProjectDocsZip(project: Project): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()

  for (const doc of project.docs) {
    const base = safeSegment(doc.filename?.trim() ? slugify(doc.filename) : doc.uuid)
    const name = uniqueName(base, used)
    files[`${name}.md`] = strToU8(doc.content)
  }

  return zipSync(files)
}
