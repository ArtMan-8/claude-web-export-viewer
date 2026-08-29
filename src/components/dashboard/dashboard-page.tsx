import { useMemo } from 'react'
import { Download, MessageSquare, FolderOpen, FileText, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { computeStats } from '@/lib/archive/stats'
import { buildFullExportZip } from '@/lib/export/zip-all'
import { downloadBytes } from '@/lib/download'
import { useArchive } from '@/store/archive-store'
import { useSettings } from '@/store/settings-store'

function formatDate(iso: string): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { archive } = useArchive()
  const { showTools } = useSettings()
  const stats = useMemo(() => (archive ? computeStats(archive) : null), [archive])

  if (!archive || !stats) return null

  const handleExportAll = () => {
    const zip = buildFullExportZip(archive, { includeTools: showTools })
    downloadBytes('claude-archive-export.zip', zip)
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('dashboard.title')}</h1>
        <Button onClick={handleExportAll}>
          <Download />
          {t('dashboard.exportAll')}
        </Button>
      </div>

      {archive.warnings.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{t('dashboard.warningsTitle', { count: archive.warnings.length })}</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {archive.warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{t(`errors.${w.code}`, w.params)}</li>
              ))}
              {archive.warnings.length > 5 && (
                <li>{t('dashboard.andMore', { count: archive.warnings.length - 5 })}</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageSquare className="size-4" /> {t('dashboard.conversations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.conversationCount}</div>
            {stats.emptyConversationCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('dashboard.emptyOfThem', { count: stats.emptyConversationCount })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.messages')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.messageCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FolderOpen className="size-4" /> {t('dashboard.projects')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.projectCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="size-4" /> {t('dashboard.documents')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.docCount}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.thousandChars', { count: (stats.docsCharacters / 1000).toFixed(0) })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.dateRange')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.dateRange ? (
            <p className="text-sm">
              {formatDate(stats.dateRange.from)} — {formatDate(stats.dateRange.to)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.tools')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topTools.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.toolsNotUsed')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.topTools.map((tool) => (
                <Badge key={tool.name} variant="secondary">
                  {t(`tools.${tool.name}`, tool.name)} × {tool.count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
