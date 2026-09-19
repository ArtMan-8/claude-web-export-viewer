import { useState } from 'react'
import { ChevronRight, File, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { TruncatedCode } from '~/components/common/truncated-code'
import type { MessageAttachment, MessageFile } from '~/lib/archive/model'

function formatSize(bytes: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (bytes < 1024) return t('common.sizeBytes', { count: bytes })
  return t('common.sizeKb', { count: Math.round(bytes / 1024) })
}

const chipClass =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground'

function AttachmentChip({ attachment }: { attachment: MessageAttachment }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const label = [
    attachment.name || t('conversation.attachmentUntitled'),
    attachment.type,
    attachment.size !== null ? formatSize(attachment.size, t) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
      <CollapsibleTrigger className={`${chipClass} hover:text-foreground`} title={t('conversation.attachment')}>
        <Paperclip className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 text-xs">
        <TruncatedCode code={attachment.extractedText} language={null} />
      </CollapsibleContent>
    </Collapsible>
  )
}

function FileChip({ file }: { file: MessageFile }) {
  const { t } = useTranslation()
  return (
    <span className={chipClass} title={file.uuid}>
      <File className="size-3 shrink-0" />
      <span className="truncate">
        {file.name ?? t('conversation.file')} · {t('conversation.fileNotExported')}
      </span>
    </span>
  )
}

/**
 * Чипы вложений над текстом сообщения (Q9/Q10 плана 2026-09): у attachments
 * есть извлечённый текст — раскрывается по клику; у files содержимого в
 * экспорте нет, и читалка говорит об этом прямо, а не молчит.
 */
export function MessageAttachments({ attachments, files }: { attachments: MessageAttachment[]; files: MessageFile[] }) {
  if (attachments.length === 0 && files.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {attachments.map((attachment, i) => (
        <AttachmentChip key={`a-${i}`} attachment={attachment} />
      ))}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((file, i) => (
            <FileChip key={file.uuid || `f-${i}`} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
