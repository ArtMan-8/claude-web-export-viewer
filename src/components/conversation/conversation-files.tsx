import { useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { TruncatedCode } from '~/components/common/truncated-code'
import { conversationFileAnchorId } from '~/lib/archive/file-anchor'
import { downloadText } from '~/lib/download'
import type { ConversationFile } from '~/lib/archive/model'

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}

function ConversationFileCard({ file }: { file: ConversationFile }) {
  const { t } = useTranslation()
  const [previewOpen, setPreviewOpen] = useState(false)
  const firstRevision = file.revisions[0]
  const lastRevision = file.revisions[file.revisions.length - 1]

  const handleDownload = () => {
    if (file.content === null) return
    downloadText(file.name, file.content, file.mimeType ? `${file.mimeType};charset=utf-8` : 'text/plain;charset=utf-8')
  }

  return (
    <div id={conversationFileAnchorId(file.path)} className="rounded-md border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{file.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{file.path}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {file.isPresented && <Badge variant="secondary">{t('conversation.filePresented')}</Badge>}
          {file.content !== null ? (
            <Button variant="outline" size="icon-sm" onClick={handleDownload} title={t('conversation.fileReconstructed')}>
              <Download className="size-3.5" />
            </Button>
          ) : (
            file.reconstructionError && (
              <span className="text-xs text-destructive">{t(`conversation.fileError.${file.reconstructionError}`)}</span>
            )
          )}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>{t('conversation.fileRevisions', { count: file.revisions.length })}</span>
        {firstRevision && <span>{formatDate(firstRevision.at)}</span>}
        {lastRevision && lastRevision !== firstRevision && <span>→ {formatDate(lastRevision.at)}</span>}
        {file.finalSize !== null && <span>{t('conversation.fileSize', { count: file.finalSize })}</span>}
      </div>

      {file.content !== null && (
        <Collapsible open={previewOpen} onOpenChange={setPreviewOpen} className="mt-2">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronRight className={`size-3 shrink-0 transition-transform ${previewOpen ? 'rotate-90' : ''}`} />
            {t('conversation.filePreview')}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1.5">
            <TruncatedCode code={file.content} language={file.language} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

/** Секция «Файлы беседы» в шапке — сборка из create_file/str_replace, см. §3.5 плана. */
export function ConversationFiles({ files }: { files: ConversationFile[] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (files.length === 0) return null

  const presented = files.filter((f) => f.isPresented)
  const intermediate = files.filter((f) => !f.isPresented)
  const showSubheadings = presented.length > 0 && intermediate.length > 0

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b px-4 py-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
        {t('conversation.filesHeading', { count: files.length })}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        {presented.length > 0 && (
          <div className="space-y-2">
            {showSubheadings && (
              <p className="text-xs font-medium text-muted-foreground">{t('conversation.filesPresented')}</p>
            )}
            {presented.map((file) => (
              <ConversationFileCard key={file.path} file={file} />
            ))}
          </div>
        )}
        {intermediate.length > 0 && (
          <div className="space-y-2">
            {showSubheadings && (
              <p className="text-xs font-medium text-muted-foreground">{t('conversation.filesIntermediate')}</p>
            )}
            {intermediate.map((file) => (
              <ConversationFileCard key={file.path} file={file} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
