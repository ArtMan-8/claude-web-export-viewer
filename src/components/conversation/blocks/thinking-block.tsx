import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** thinking почти всегда скрыт в экспорте — показываем то, что есть: краткое summary. */
export function ThinkingBlock({
  summaries,
  text,
  isTruncated,
}: {
  summaries: string[]
  text: string
  isTruncated: boolean
}) {
  const { t } = useTranslation()
  const content = summaries.join(' ') || text
  if (!content) return null

  return (
    <p className="flex items-start gap-1.5 text-sm italic text-muted-foreground">
      <Sparkles className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {content}
        {isTruncated && <span className="ml-1 not-italic">({t('conversation.thinkingTruncated')})</span>}
      </span>
    </p>
  )
}
