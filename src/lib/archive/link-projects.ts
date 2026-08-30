import type { Conversation, Project, ProjectLink } from './model'

/**
 * Экспорт claude.ai не хранит связь беседа→проект (нет project_uuid). Она
 * восстанавливается эвристикой: когда беседа шла внутри проекта, инструмент
 * project_knowledge_search возвращает фрагменты документов, у которых первая
 * строка — путь файла (совпадает с docs[].filename). Проверено на реальном
 * архиве: даёт точное совпадение без ложных срабатываний.
 *
 * Побеждает проект с максимумом совпадений; при ничьей между несколькими
 * проектами связь не проставляется — лучше отсутствие ответа, чем угадывание.
 */
export function linkProjectsToConversations(conversations: Conversation[], projects: Project[]): ProjectLink[] {
  const projectsByFilename = new Map<string, string[]>() // filename -> project uuids
  for (const project of projects) {
    for (const doc of project.docs) {
      if (!doc.filename) continue
      const owners = projectsByFilename.get(doc.filename)
      if (owners) owners.push(project.uuid)
      else projectsByFilename.set(doc.filename, [project.uuid])
    }
  }

  const links: ProjectLink[] = []

  for (const conversation of conversations) {
    const tally = new Map<string, number>()

    for (const message of conversation.messages) {
      for (const block of message.blocks) {
        if (block.kind !== 'tool' || block.name !== 'project_knowledge_search') continue

        const fragments = block.result.kind === 'text' ? block.result.fragments : []
        for (const fragment of fragments) {
          const firstLine = fragment.split('\n', 1)[0]?.trim()
          if (!firstLine) continue

          const owners = projectsByFilename.get(firstLine)
          // filename уникален только для одного проекта — иначе совпадение неоднозначно
          if (!owners || owners.length !== 1) continue

          const projectUuid = owners[0]
          tally.set(projectUuid, (tally.get(projectUuid) ?? 0) + 1)
        }
      }
    }

    if (tally.size === 0) continue

    let bestUuid: string | null = null
    let bestCount = 0
    let isTie = false
    for (const [projectUuid, count] of tally) {
      if (count > bestCount) {
        bestUuid = projectUuid
        bestCount = count
        isTie = false
      } else if (count === bestCount) {
        isTie = true
      }
    }

    if (bestUuid && !isTie) {
      links.push({ conversationUuid: conversation.uuid, projectUuid: bestUuid, matchCount: bestCount })
    }
  }

  return links
}
