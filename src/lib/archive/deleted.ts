import type { Archive } from './model'

/**
 * Строка таблицы удалённых записей — одна и та же для карточки на дашборде и
 * раздела в index.md экспорта (Q2/Q18 плана 2026-09). `deletedAt` — это
 * `updatedAt` записи: у скелета без содержимого он совпадает с моментом удаления.
 */
export interface DeletedRecord {
  kind: 'conversation' | 'project'
  uuid: string
  createdAt: string
  deletedAt: string
  /** Сообщений у беседы, документов у проекта — до фильтрации заглушек */
  itemCount: number
}

/** Удалённые беседы и проекты архива, новые (по дате удаления) первыми. */
export function collectDeletedRecords(archive: Archive): DeletedRecord[] {
  const records: DeletedRecord[] = []

  for (const conversation of archive.conversations) {
    if (!conversation.isDeleted) continue
    records.push({
      kind: 'conversation',
      uuid: conversation.uuid,
      createdAt: conversation.createdAt,
      deletedAt: conversation.updatedAt,
      itemCount: conversation.messages.length,
    })
  }

  for (const project of archive.projects) {
    if (!project.isDeleted) continue
    records.push({
      kind: 'project',
      uuid: project.uuid,
      createdAt: project.createdAt,
      deletedAt: project.updatedAt,
      itemCount: project.rawDocCount,
    })
  }

  return records.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}
