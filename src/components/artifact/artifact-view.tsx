import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Download, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import type { Artifact, ArtifactVersion } from '~/lib/archive/model'
import { displayNameOf } from '~/lib/display-name'
import { prepareArtifactSrcdoc } from '~/lib/artifact-html'
import { downloadText } from '~/lib/download'

function formatDateTime(iso: string): string {
  return iso ? iso.replace('T', ' ').slice(0, 16) : ''
}

function versionLabel(version: ArtifactVersion): string {
  const date = formatDateTime(version.createdAt)
  return version.description && version.description !== version.title ? `${date} — ${version.description}` : date
}

/**
 * Просмотр артефакта: iframe в песочнице без единого allow-* (Q6). Кнопка
 * «Выполнять скрипты» перемонтирует iframe с allow-scripts, но без
 * allow-same-origin — скрипт не достаёт до страницы читалки, хотя сеть ему
 * доступна (Q19). Выбор действует до ухода с артефакта и не запоминается.
 */
export function ArtifactView({ artifact }: { artifact: Artifact }) {
  const { t } = useTranslation()
  const defaultVersion = artifact.versions.find((v) => v.id === artifact.activeVersionId) ?? artifact.versions[0] ?? null
  const [versionId, setVersionId] = useState(defaultVersion?.id ?? null)
  const [runScripts, setRunScripts] = useState(false)

  // Компонент маршрута переиспользуется между артефактами — состояние сбрасываем явно
  useEffect(() => {
    setVersionId(defaultVersion?.id ?? null)
    setRunScripts(false)
  }, [artifact.id])

  const version = artifact.versions.find((v) => v.id === versionId) ?? defaultVersion
  const title = displayNameOf(artifact.title, t('common.untitled'))

  // Якоря внутри артефакта работают только с <base href="about:srcdoc"> — см. prepareArtifactSrcdoc
  const srcdoc = useMemo(() => (version?.html != null ? prepareArtifactSrcdoc(version.html) : null), [version?.html])

  const handleDownload = () => {
    if (!version || version.html === null) return
    downloadText(`${title}-${version.id}.html`, version.html, 'text/html;charset=utf-8')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {artifact.visibility && <Badge variant="secondary">{t(`artifact.visibility.${artifact.visibility}`, artifact.visibility)}</Badge>}
            {version && version.id === artifact.activeVersionId && <span>{t('artifact.activeVersion')}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {artifact.versions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t('artifact.versions', { count: artifact.versions.length })}
                  {version && <span className="text-muted-foreground">· {formatDateTime(version.createdAt)}</span>}
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {artifact.versions.map((v) => (
                  <DropdownMenuItem key={v.id} onClick={() => setVersionId(v.id)} className={v.id === version?.id ? 'bg-accent' : ''}>
                    <span className="flex flex-col">
                      <span>{versionLabel(v)}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.id}
                        {v.id === artifact.activeVersionId ? ` · ${t('artifact.activeVersion')}` : ''}
                        {v.html === null ? ` · ${t('artifact.versionMissing')}` : ''}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!version || version.html === null}>
            <Download className="size-4" />
            {t('artifact.download')}
          </Button>

          <Button
            variant={runScripts ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRunScripts((v) => !v)}
            title={t('artifact.runScriptsHint')}
          >
            <Play className="size-4" />
            {t('artifact.runScripts')}
          </Button>
          <span className="text-xs text-muted-foreground">{t('artifact.runScriptsHint')}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-white">
        {version && srcdoc !== null ? (
          <iframe
            // key перемонтирует iframe при смене версии и режима — sandbox нельзя менять на лету
            key={`${version.id}:${runScripts ? 'scripts' : 'static'}`}
            title={title}
            sandbox={runScripts ? 'allow-scripts' : ''}
            srcDoc={srcdoc}
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('artifact.versionMissing')}
          </div>
        )}
      </div>
    </div>
  )
}
