import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/ui/badge'
import { TruncatedCode } from '~/components/common/truncated-code'
import { conversationFileAnchorId } from '~/lib/archive/file-anchor'
import type { ToolResult } from '~/lib/archive/model'

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Рендер результата инструмента по форме `result` (см. §3.3, слой 2 плана) — не по имени инструмента. */
export function ToolResultView({ result }: { result: ToolResult }) {
  const { t } = useTranslation()

  switch (result.kind) {
    case 'command':
      return (
        <div className="space-y-2">
          <Badge variant={result.exitCode === 0 ? 'secondary' : 'destructive'}>
            {t('common.exitCode', { code: result.exitCode ?? '—' })}
          </Badge>
          {result.stdout && <TruncatedCode code={result.stdout} language={null} />}
          {result.stderr && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">{t('common.stderr')}</p>
              <TruncatedCode code={result.stderr} language={null} />
            </div>
          )}
        </div>
      )

    case 'files':
      return (
        <ul className="space-y-1">
          {result.files.map((file) => (
            <li key={file.uuid || file.path}>
              <a
                href={`#${conversationFileAnchorId(file.path)}`}
                className="font-mono text-xs text-foreground underline-offset-2 hover:underline"
              >
                {file.name}
              </a>
            </li>
          ))}
        </ul>
      )

    case 'sources':
      return (
        <ul className="space-y-1.5">
          {result.sources.map((source, i) => (
            <li key={`${source.url}-${i}`} className="text-sm">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-2 hover:underline"
              >
                {source.faviconUrl && <img src={source.faviconUrl} alt="" className="size-3.5 rounded-sm" />}
                {source.title || hostnameOf(source.url) || t('common.source')}
              </a>
              <span className="ml-1.5 text-xs text-muted-foreground">
                {source.siteName ?? source.domain}
                {source.publishedAt && ` · ${t('common.publishedAt', { date: source.publishedAt })}`}
              </span>
              {source.isMissing && <p className="text-xs text-muted-foreground">{t('common.sourceUnavailable')}</p>}
              {source.snippet && <p className="text-xs text-muted-foreground">{source.snippet}</p>}
            </li>
          ))}
        </ul>
      )

    case 'text':
      return result.text ? <TruncatedCode code={result.text} language={null} /> : null

    case 'none':
      return null
  }
}
