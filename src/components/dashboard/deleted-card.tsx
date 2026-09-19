import { useMemo, useState } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { collectDeletedRecords } from '~/lib/archive/deleted'
import type { Archive } from '~/lib/archive/model'
import type { ArchiveStats } from '~/lib/archive/stats'

function formatDate(iso: string): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

/**
 * Удалённые беседы и проекты живут только здесь: в списках, маршрутах, поиске
 * и экспорте их нет (Q2 плана 18-09-2026). Карточка — единственный способ понять,
 * что записи удалены на claude.ai, а не спрятаны читалкой. Причины не объясняем.
 */
export function DeletedCard({ archive, stats }: { archive: Archive; stats: ArchiveStats }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const records = useMemo(() => collectDeletedRecords(archive), [archive])

  if (stats.deletedConversationCount === 0 && stats.deletedProjectCount === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Trash2 className="size-4" /> {t('dashboard.deleted')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {stats.deletedConversationCount > 0 && (
            <span>
              {t('dashboard.deletedConversations', {
                count: stats.deletedConversationCount,
                messages: stats.deletedMessageCount,
              })}
            </span>
          )}
          {stats.deletedProjectCount > 0 && (
            <span>
              {t('dashboard.deletedProjects', { count: stats.deletedProjectCount, docs: stats.deletedDocCount })}
            </span>
          )}
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
            {t('dashboard.deletedTable.show')}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.deletedTable.type')}</TableHead>
                    <TableHead>{t('dashboard.deletedTable.uuid')}</TableHead>
                    <TableHead>{t('dashboard.deletedTable.createdAt')}</TableHead>
                    <TableHead>{t('dashboard.deletedTable.deletedAt')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.deletedTable.items')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.uuid}>
                      <TableCell>{t(`dashboard.deletedTable.kind.${record.kind}`)}</TableCell>
                      <TableCell className="font-mono text-xs">{record.uuid}</TableCell>
                      <TableCell>{formatDate(record.createdAt)}</TableCell>
                      <TableCell>{formatDate(record.deletedAt)}</TableCell>
                      <TableCell className="text-right">{record.itemCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
